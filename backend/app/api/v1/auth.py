from datetime import datetime

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, get_current_principal, require_csrf
from app.core.database import get_db
from app.core.security_config import CSRF_COOKIE_NAME, SESSION_COOKIE_NAME
from app.models.entities import Session as UserSession
from app.schemas.auth import ChangeLanguageRequest, ChangePasswordRequest, LoginRequest, LoginResponse, MeResponse, MfaCodeRequest, MfaSetupResponse, UpdateProfilePreferencesRequest
from app.security.rbac import permissions_for_roles
from app.services.auth_service import (
    authenticate,
    change_password,
    confirm_mfa,
    disable_mfa,
    get_session,
    rotate_session,
    set_session_cookies,
    setup_mfa,
    verify_totp,
)


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response, request: Request, db: Session = Depends(get_db)) -> LoginResponse:
    result = authenticate(
        db,
        payload.username,
        payload.password,
        payload.mfa_code,
        ip_context=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )
    if result == "MFA_REQUIRED":
        return LoginResponse(mfa_required=True)
    set_session_cookies(response, result)
    return LoginResponse(mfa_required=False, user_id=result.user.public_id, csrf_token=result.csrf_token)


@router.post("/logout", dependencies=[Depends(require_csrf)])
def logout(response: Response, db: Session = Depends(get_db), token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME)) -> dict:
    from app.services.auth_service import revoke_session

    revoke_session(db, token)
    response.delete_cookie(SESSION_COOKIE_NAME)
    response.delete_cookie(CSRF_COOKIE_NAME)
    return {"status": "logged_out"}


@router.post("/refresh", dependencies=[Depends(require_csrf)], response_model=LoginResponse)
def refresh(response: Response, db: Session = Depends(get_db), token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME)) -> LoginResponse:
    rotated = rotate_session(db, token or "")
    set_session_cookies(response, rotated)
    return LoginResponse(mfa_required=False, user_id=rotated.user.public_id, csrf_token=rotated.csrf_token)


@router.get("/me", response_model=MeResponse)
def me(principal: CurrentPrincipal = Depends(get_current_principal)) -> MeResponse:
    return MeResponse(
        public_id=principal.user.public_id,
        username=principal.user.username,
        display_name=principal.user.display_name,
        preferred_language=principal.user.preferred_language or "fr",
        preferred_theme=principal.user.preferred_theme or "system",
        roles=sorted(principal.role_codes),
        permissions=sorted(permissions_for_roles(principal.role_codes)),
        scopes=[
            {"scope_type": s.scope_type, "region_id": s.region_id, "department_id": s.department_id, "school_id": s.school_id}
            for s in principal.scopes
        ],
    )


@router.patch("/me", dependencies=[Depends(require_csrf)])
def update_me_preferences(
    payload: UpdateProfilePreferencesRequest,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
) -> dict:
    principal.user.preferred_theme = payload.preferred_theme
    db.commit()
    return {"status": "preferences_updated", "preferred_theme": principal.user.preferred_theme}


@router.post("/change-password", dependencies=[Depends(require_csrf)])
def change_password_route(payload: ChangePasswordRequest, principal: CurrentPrincipal = Depends(get_current_principal), db: Session = Depends(get_db)) -> dict:
    change_password(db, principal.user, payload.current_password, payload.new_password)
    return {"status": "password_changed"}


@router.post("/language", dependencies=[Depends(require_csrf)])
def change_language(payload: ChangeLanguageRequest, principal: CurrentPrincipal = Depends(get_current_principal), db: Session = Depends(get_db)) -> dict:
    principal.user.preferred_language = payload.preferred_language
    db.commit()
    return {"status": "language_changed", "preferred_language": principal.user.preferred_language}


@router.post("/mfa/setup", response_model=MfaSetupResponse, dependencies=[Depends(require_csrf)])
def mfa_setup(principal: CurrentPrincipal = Depends(get_current_principal), db: Session = Depends(get_db)) -> MfaSetupResponse:
    secret, uri = setup_mfa(db, principal.user)
    return MfaSetupResponse(provisioning_uri=uri, secret_preview=secret)


@router.post("/mfa/confirm", dependencies=[Depends(require_csrf)])
def mfa_confirm(payload: MfaCodeRequest, principal: CurrentPrincipal = Depends(get_current_principal), db: Session = Depends(get_db)) -> dict:
    confirm_mfa(db, principal.user, payload.code)
    return {"status": "mfa_enabled"}


@router.post("/mfa/verify")
def mfa_verify(payload: MfaCodeRequest, principal: CurrentPrincipal = Depends(get_current_principal), db: Session = Depends(get_db)) -> dict:
    return {"valid": verify_totp(db, principal.user.id, payload.code)}


@router.post("/mfa/disable", dependencies=[Depends(require_csrf)])
def mfa_disable(payload: MfaCodeRequest, principal: CurrentPrincipal = Depends(get_current_principal), db: Session = Depends(get_db)) -> dict:
    disable_mfa(db, principal.user, principal.user, payload.code)
    return {"status": "mfa_disabled"}


def _session_public_id(session_id: int) -> str:
    return f"sess_{session_id:08d}"


def _session_id(value: str) -> int:
    try:
        return int(value.removeprefix("sess_"))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Session not found") from exc


@router.get("/sessions")
def list_sessions(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
    token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> list[dict]:
    current = get_session(db, token)
    rows = db.execute(
        select(UserSession).where(
            UserSession.user_id == principal.user.id,
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > datetime.utcnow(),
        ).order_by(UserSession.last_active_at.desc())
    ).scalars()
    return [
        {
            "session_id": _session_public_id(row.id),
            "user_agent": row.user_agent_summary or "Navigateur non identifié",
            "ip_address": row.ip_context,
            "created_at": row.created_at,
            "last_active_at": row.last_active_at,
            "is_current": bool(current and row.id == current.id),
        }
        for row in rows
    ]


@router.delete("/sessions/others", dependencies=[Depends(require_csrf)])
def revoke_other_sessions(
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
    token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> dict:
    current = get_session(db, token)
    if not current:
        raise HTTPException(status_code=401, detail="Authentication required")
    result = db.execute(
        update(UserSession).where(
            UserSession.user_id == principal.user.id,
            UserSession.id != current.id,
            UserSession.revoked_at.is_(None),
        ).values(revoked_at=datetime.utcnow())
    )
    db.commit()
    return {"status": "revoked", "count": result.rowcount}


@router.delete("/sessions/{session_public_id}", dependencies=[Depends(require_csrf)])
def revoke_named_session(
    session_public_id: str,
    principal: CurrentPrincipal = Depends(get_current_principal),
    db: Session = Depends(get_db),
    token: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> dict:
    session = db.get(UserSession, _session_id(session_public_id))
    if not session or session.user_id != principal.user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    current = get_session(db, token)
    if current and current.id == session.id:
        raise HTTPException(status_code=409, detail="Current session cannot be revoked from this action")
    session.revoked_at = datetime.utcnow()
    db.commit()
    return {"status": "revoked"}

from fastapi import APIRouter, Cookie, Depends, Request, Response
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, get_current_principal, require_csrf
from app.core.database import get_db
from app.core.security_config import CSRF_COOKIE_NAME, SESSION_COOKIE_NAME
from app.schemas.auth import ChangeLanguageRequest, ChangePasswordRequest, LoginRequest, LoginResponse, MeResponse, MfaCodeRequest, MfaSetupResponse
from app.security.rbac import permissions_for_roles
from app.services.auth_service import (
    authenticate,
    change_password,
    confirm_mfa,
    disable_mfa,
    rotate_session,
    set_session_cookies,
    setup_mfa,
    verify_totp,
)


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, response: Response, request: Request, db: Session = Depends(get_db)) -> LoginResponse:
    result = authenticate(db, payload.username, payload.password, payload.mfa_code, ip_context=request.client.host if request.client else None)
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
        roles=sorted(principal.role_codes),
        permissions=sorted(permissions_for_roles(principal.role_codes)),
        scopes=[
            {"scope_type": s.scope_type, "region_id": s.region_id, "department_id": s.department_id, "school_id": s.school_id}
            for s in principal.scopes
        ],
    )


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

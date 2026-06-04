import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta
from uuid import uuid4

import pyotp
from fastapi import HTTPException, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.security_config import CSRF_COOKIE_NAME, LOCKOUT_MINUTES, MAX_LOGIN_ATTEMPTS, SESSION_COOKIE_NAME, SESSION_TTL
from app.models.entities import MfaMethod, PasswordHistory, Role, Session as UserSession, User, UserRole
from app.security.crypto import decrypt_text, encrypt_text
from app.security.passwords import hash_password, verify_password
from app.security.rbac import is_privileged
from app.services.security_events import record_login_attempt, record_security_event


@dataclass
class AuthenticatedSession:
    user: User
    token: str
    csrf_token: str


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def role_codes_for_user(db: Session, user_id: int) -> set[str]:
    rows = db.execute(
        select(Role.code).join(UserRole, UserRole.role_id == Role.id).where(UserRole.user_id == user_id)
    ).all()
    return {row[0] for row in rows}


def active_mfa_method(db: Session, user_id: int) -> MfaMethod | None:
    return db.execute(
        select(MfaMethod).where(MfaMethod.user_id == user_id, MfaMethod.disabled_at.is_(None))
    ).scalar_one_or_none()


def verify_totp(db: Session, user_id: int, code: str) -> bool:
    method = active_mfa_method(db, user_id)
    if not method:
        return False
    secret = decrypt_text(method.secret_encrypted)
    return pyotp.TOTP(secret).verify(code, valid_window=1)


def authenticate(db: Session, username: str, password: str, mfa_code: str | None, ip_context: str | None = None) -> AuthenticatedSession | str:
    user = db.execute(select(User).where(User.username == username)).scalar_one_or_none()
    if not user or user.status != "ACTIVE" or not verify_password(password, user.password_hash):
        record_login_attempt(db, username=username, result="FAILED", user_id=user.id if user else None, ip_context=ip_context)
        if user:
            failures = db.execute(
                select(func.count(LoginAttemptProxy.id)).select_from(LoginAttemptProxy).where(
                    LoginAttemptProxy.user_id == user.id,
                    LoginAttemptProxy.result == "FAILED",
                    LoginAttemptProxy.attempted_at >= datetime.utcnow() - timedelta(minutes=LOCKOUT_MINUTES),
                )
            ).scalar()
            if failures + 1 >= MAX_LOGIN_ATTEMPTS:
                user.status = "LOCKED"
                record_security_event(db, "ACCOUNT_LOCKED", "HIGH", user_id=user.id)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    role_codes = role_codes_for_user(db, user.id)
    mfa_method = active_mfa_method(db, user.id)
    if (user.mfa_required or is_privileged(role_codes) or mfa_method) and not mfa_code:
        record_login_attempt(db, username=username, result="MFA_REQUIRED", user_id=user.id, ip_context=ip_context)
        db.commit()
        return "MFA_REQUIRED"
    if (user.mfa_required or is_privileged(role_codes) or mfa_method) and not verify_totp(db, user.id, mfa_code or ""):
        record_login_attempt(db, username=username, result="MFA_FAILED", user_id=user.id, ip_context=ip_context)
        record_security_event(db, "MFA_FAILED", "MEDIUM", user_id=user.id)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid MFA code")

    return create_session(db, user, ip_context=ip_context)


def create_session(db: Session, user: User, ip_context: str | None = None) -> AuthenticatedSession:
    raw_token = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    session = UserSession(
        user_id=user.id,
        session_token_hash=_hash_token(raw_token),
        csrf_token_hash=_hash_token(csrf_token),
        ip_context=ip_context,
        expires_at=datetime.utcnow() + SESSION_TTL,
    )
    user.last_login_at = datetime.utcnow()
    db.add(session)
    record_login_attempt(db, username=user.username, result="SUCCESS", user_id=user.id, ip_context=ip_context)
    db.commit()
    return AuthenticatedSession(user=user, token=raw_token, csrf_token=csrf_token)


def set_session_cookies(response: Response, auth_session: AuthenticatedSession) -> None:
    response.set_cookie(SESSION_COOKIE_NAME, auth_session.token, httponly=True, samesite="strict", secure=False, max_age=int(SESSION_TTL.total_seconds()))
    response.set_cookie(CSRF_COOKIE_NAME, auth_session.csrf_token, httponly=False, samesite="strict", secure=False, max_age=int(SESSION_TTL.total_seconds()))


def revoke_session(db: Session, token: str | None) -> None:
    if not token:
        return
    db.execute(
        update(UserSession)
        .where(UserSession.session_token_hash == _hash_token(token), UserSession.revoked_at.is_(None))
        .values(revoked_at=datetime.utcnow())
    )
    db.commit()


def rotate_session(db: Session, token: str) -> AuthenticatedSession:
    session = get_session(db, token)
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    session.revoked_at = datetime.utcnow()
    user = db.get(User, session.user_id)
    if not user or user.status != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    return create_session(db, user, ip_context=session.ip_context)


def get_session(db: Session, token: str | None) -> UserSession | None:
    if not token:
        return None
    return db.execute(
        select(UserSession).where(
            UserSession.session_token_hash == _hash_token(token),
            UserSession.revoked_at.is_(None),
            UserSession.expires_at > datetime.utcnow(),
        )
    ).scalar_one_or_none()


def change_password(db: Session, user: User, current_password: str, new_password: str) -> None:
    if not verify_password(current_password, user.password_hash):
        record_security_event(db, "PASSWORD_CHANGE_FAILED", "MEDIUM", user_id=user.id)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is invalid")
    db.add(PasswordHistory(user_id=user.id, password_hash=user.password_hash))
    user.password_hash = hash_password(new_password)
    db.execute(update(UserSession).where(UserSession.user_id == user.id, UserSession.revoked_at.is_(None)).values(revoked_at=datetime.utcnow()))
    record_security_event(db, "PASSWORD_CHANGED", "MEDIUM", user_id=user.id)
    db.commit()


def setup_mfa(db: Session, user: User) -> tuple[str, str]:
    secret = pyotp.random_base32()
    existing = active_mfa_method(db, user.id)
    if existing:
        existing.disabled_at = datetime.utcnow()
    method = MfaMethod(user_id=user.id, method_type="TOTP_PENDING", secret_encrypted=encrypt_text(secret))
    db.add(method)
    record_security_event(db, "MFA_SETUP_STARTED", "MEDIUM", user_id=user.id)
    db.commit()
    uri = pyotp.TOTP(secret).provisioning_uri(name=user.username, issuer_name="EduCard Secure")
    return secret, uri


def confirm_mfa(db: Session, user: User, code: str) -> None:
    method = active_mfa_method(db, user.id)
    if not method or method.method_type != "TOTP_PENDING":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No pending MFA setup")
    if not pyotp.TOTP(decrypt_text(method.secret_encrypted)).verify(code, valid_window=1):
        record_security_event(db, "MFA_CONFIRM_FAILED", "MEDIUM", user_id=user.id)
        db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid MFA code")
    method.method_type = "TOTP"
    method.enabled_at = datetime.utcnow()
    user.mfa_required = True
    record_security_event(db, "MFA_ENABLED", "HIGH", user_id=user.id)
    db.commit()


def disable_mfa(db: Session, actor: User, target_user: User, code: str | None = None) -> None:
    if actor.id == target_user.id and not verify_totp(db, target_user.id, code or ""):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valid MFA code required")
    method = active_mfa_method(db, target_user.id)
    if method:
        method.disabled_at = datetime.utcnow()
    target_user.mfa_required = False
    record_security_event(db, "MFA_DISABLED", "HIGH", user_id=target_user.id)
    db.commit()


# Alias used to avoid circular import in authenticate count query.
from app.models.entities import LoginAttempt as LoginAttemptProxy  # noqa: E402

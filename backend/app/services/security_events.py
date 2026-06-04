from sqlalchemy.orm import Session

from app.models.entities import LoginAttempt, SecurityEvent


def record_login_attempt(db: Session, username: str, result: str, user_id: int | None = None, ip_context: str | None = None) -> None:
    db.add(LoginAttempt(username=username, user_id=user_id, result=result, ip_context=ip_context))


def record_security_event(
    db: Session,
    event_type: str,
    severity: str,
    user_id: int | None = None,
    resource_type: str | None = None,
    resource_public_id: str | None = None,
    details_minimized: str | None = None,
) -> None:
    db.add(
        SecurityEvent(
            event_type=event_type,
            severity=severity,
            user_id=user_id,
            resource_type=resource_type,
            resource_public_id=resource_public_id,
            details_minimized=details_minimized,
        )
    )

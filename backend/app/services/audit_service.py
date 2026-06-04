import hashlib
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal
from app.models.entities import AuditEvent, AuditEventHash


def _scope_summary(principal: CurrentPrincipal) -> str:
    parts = []
    for scope in principal.scopes:
        parts.append(f"{scope.scope_type}:{scope.region_id or scope.department_id or scope.school_id or 'ALL'}")
    return ",".join(parts)[:255]


def _event_material(event: AuditEvent, previous_hash: str | None) -> str:
    occurred_at = event.occurred_at.replace(microsecond=0) if event.occurred_at else event.occurred_at
    return "|".join(
        [
            event.event_public_id,
            occurred_at.isoformat(),
            str(event.actor_user_id or ""),
            event.actor_role_code or "",
            event.scope_summary or "",
            event.action,
            event.resource_type,
            event.resource_public_id or "",
            event.result,
            event.correlation_id or "",
            event.justification or "",
            event.severity,
            previous_hash or "",
        ]
    )


def append_audit_event(
    db: Session,
    principal: CurrentPrincipal,
    action: str,
    resource_type: str,
    resource_public_id: str | None = None,
    result: str = "SUCCESS",
    justification: str | None = None,
    severity: str = "INFO",
    correlation_id: str | None = None,
) -> AuditEvent:
    previous = (
        db.execute(
            select(AuditEventHash)
            .join(AuditEvent, AuditEvent.id == AuditEventHash.audit_event_id)
            .order_by(AuditEvent.id.desc())
        )
        .scalars()
        .first()
    )
    previous_hash = previous.event_hash if previous else None
    event = AuditEvent(
        event_public_id=str(uuid4()),
        actor_user_id=principal.user.id,
        actor_role_code=",".join(sorted(principal.role_codes))[:80],
        scope_summary=_scope_summary(principal),
        action=action,
        resource_type=resource_type,
        resource_public_id=resource_public_id,
        result=result,
        correlation_id=correlation_id or str(uuid4()),
        justification=justification,
        severity=severity,
    )
    db.add(event)
    db.flush()
    digest = hashlib.sha256(_event_material(event, previous_hash).encode("utf-8")).hexdigest()
    db.add(AuditEventHash(audit_event_id=event.id, previous_hash=previous_hash, event_hash=digest, hash_algorithm="SHA-256"))
    return event


def verify_audit_chain(db: Session) -> dict:
    rows = db.execute(select(AuditEvent, AuditEventHash).join(AuditEventHash, AuditEventHash.audit_event_id == AuditEvent.id).order_by(AuditEvent.id)).all()
    previous_hash = None
    checked = 0
    failures = []
    for event, stored in rows:
        expected = hashlib.sha256(_event_material(event, previous_hash).encode("utf-8")).hexdigest()
        if stored.previous_hash != previous_hash or stored.event_hash != expected:
            failures.append({"audit_event_id": event.id, "event_public_id": event.event_public_id})
        previous_hash = stored.event_hash
        checked += 1
    return {"status": "OK" if not failures else "BROKEN", "checked": checked, "failures": failures}


def rebuild_audit_hashes_for_demo(db: Session) -> None:
    rows = db.execute(select(AuditEvent, AuditEventHash).join(AuditEventHash, AuditEventHash.audit_event_id == AuditEvent.id).order_by(AuditEvent.id)).all()
    previous_hash = None
    for event, stored in rows:
        stored.previous_hash = previous_hash
        stored.event_hash = hashlib.sha256(_event_material(event, previous_hash).encode("utf-8")).hexdigest()
        previous_hash = stored.event_hash

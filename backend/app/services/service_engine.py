from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_card_scope, assert_student_scope
from app.models.entities import ServiceEntitlement, ServiceProvider, ServiceType, ServiceVerificationEvent
from app.services.security_events import record_security_event


def create_entitlement(
    db: Session,
    principal: CurrentPrincipal,
    student_id: int,
    service_type_id: int,
    service_provider_id: int,
    valid_from: datetime,
    valid_until: datetime | None,
    status: str,
    notes: str | None = None,
) -> ServiceEntitlement:
    assert_student_scope(db, principal, student_id)
    if not db.get(ServiceType, service_type_id) or not db.get(ServiceProvider, service_provider_id):
        raise HTTPException(status_code=400, detail="Unknown service type or provider")
    row = ServiceEntitlement(
        student_id=student_id,
        service_type_id=service_type_id,
        service_provider_id=service_provider_id,
        valid_from=valid_from,
        valid_until=valid_until,
        status=status,
        notes_minimized=notes,
        is_demo=True,
    )
    db.add(row)
    db.flush()
    record_security_event(db, "SERVICE_ENTITLEMENT_CREATED", "MEDIUM", principal.user.id, "service", str(row.id))
    db.commit()
    db.refresh(row)
    return row


def verify_service(db: Session, principal: CurrentPrincipal, student_id: int, service_type_id: int, card_id: int | None = None, record_event: bool = True) -> dict:
    assert_student_scope(db, principal, student_id)
    if card_id:
        assert_card_scope(db, principal, card_id)
    now = datetime.utcnow()
    entitlement = db.execute(
        select(ServiceEntitlement).where(
            ServiceEntitlement.student_id == student_id,
            ServiceEntitlement.service_type_id == service_type_id,
            ServiceEntitlement.status == "ACTIVE",
            ServiceEntitlement.valid_from <= now,
        )
    ).scalars().first()
    allowed = bool(entitlement and (entitlement.valid_until is None or entitlement.valid_until >= now))
    if not record_event:
        return {"result": "ALLOWED" if allowed else "DENIED", "entitlement_id": entitlement.id if entitlement else None, "reason": None if allowed else "NO_ENTITLEMENT"}
    event = ServiceVerificationEvent(
        service_entitlement_id=entitlement.id if entitlement else None,
        student_id=student_id,
        card_id=card_id,
        result="ALLOWED" if allowed else "DENIED",
        verified_by=principal.user.id,
    )
    db.add(event)
    record_security_event(db, "SERVICE_VERIFIED", "INFO" if allowed else "MEDIUM", principal.user.id, "service", str(service_type_id), event.result)
    db.commit()
    return {"result": event.result, "entitlement_id": entitlement.id if entitlement else None}

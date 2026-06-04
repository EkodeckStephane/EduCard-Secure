from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_school_scope, assert_student_scope
from app.models.entities import AttendanceCorrection, AttendanceEvent, Card
from app.services.security_events import record_security_event


class BiometricProvider:
    """Disabled placeholder; activation requires legal validation and impact assessment."""

    enabled = False

    def verify(self, _subject: str) -> bool:
        raise RuntimeError("BiometricProvider is disabled")


def create_attendance_event(
    db: Session,
    principal: CurrentPrincipal,
    school_id: int,
    event_type: str,
    source: str,
    card_id: int | None = None,
    serial_number: str | None = None,
    student_id: int | None = None,
    classroom_id: int | None = None,
) -> AttendanceEvent:
    assert_school_scope(db, principal, school_id)
    card = None
    if serial_number:
        card = db.execute(select(Card).where(Card.serial_number == serial_number)).scalar_one_or_none()
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
        card_id = card.id
    if card_id:
        card = db.get(Card, card_id)
        if not card:
            raise HTTPException(status_code=404, detail="Card not found")
        if card.status != "ACTIVE":
            raise HTTPException(status_code=409, detail="Card is not active")
        student_id = card.student_id
    if not student_id:
        raise HTTPException(status_code=400, detail="Student or card required")
    assert_student_scope(db, principal, student_id)
    recent = db.execute(
        select(AttendanceEvent).where(
            AttendanceEvent.student_id == student_id,
            AttendanceEvent.school_id == school_id,
            AttendanceEvent.event_type == event_type,
            AttendanceEvent.event_time >= datetime.utcnow() - timedelta(minutes=2),
        )
    ).scalars().first()
    if recent:
        record_security_event(db, "ATTENDANCE_DUPLICATE_REJECTED", "MEDIUM", principal.user.id, "attendance", str(recent.id))
        db.commit()
        return recent
    row = AttendanceEvent(
        student_id=student_id,
        card_id=card_id,
        school_id=school_id,
        classroom_id=classroom_id,
        event_type=event_type,
        event_time=datetime.utcnow(),
        source=source,
        recorded_by=principal.user.id,
        is_demo=True,
    )
    db.add(row)
    db.flush()
    record_security_event(db, "ATTENDANCE_RECORDED", "INFO", principal.user.id, "attendance", str(row.id), event_type)
    db.commit()
    db.refresh(row)
    return row


def correct_attendance(db: Session, attendance_id: int, new_value: str, reason: str, principal: CurrentPrincipal) -> AttendanceCorrection:
    event = db.get(AttendanceEvent, attendance_id)
    if not event:
        raise HTTPException(status_code=404, detail="Attendance event not found")
    assert_school_scope(db, principal, event.school_id)
    correction = AttendanceCorrection(
        attendance_event_id=event.id,
        previous_value=event.event_type,
        new_value=new_value,
        reason=reason,
        requested_by=principal.user.id,
    )
    db.add(correction)
    db.flush()
    record_security_event(db, "ATTENDANCE_CORRECTION_REQUESTED", "MEDIUM", principal.user.id, "attendance", str(event.id))
    db.commit()
    db.refresh(correction)
    return correction


def approve_attendance_correction(db: Session, attendance_id: int, principal: CurrentPrincipal) -> AttendanceCorrection:
    event = db.get(AttendanceEvent, attendance_id)
    if not event:
        raise HTTPException(status_code=404, detail="Attendance event not found")
    assert_school_scope(db, principal, event.school_id)
    correction = db.execute(
        select(AttendanceCorrection).where(AttendanceCorrection.attendance_event_id == attendance_id, AttendanceCorrection.approved_at.is_(None)).order_by(AttendanceCorrection.id.desc())
    ).scalars().first()
    if not correction:
        raise HTTPException(status_code=404, detail="Pending correction not found")
    event.event_type = correction.new_value
    correction.approved_by = principal.user.id
    correction.approved_at = datetime.utcnow()
    record_security_event(db, "ATTENDANCE_CORRECTION_APPROVED", "HIGH", principal.user.id, "attendance", str(event.id))
    db.commit()
    db.refresh(correction)
    return correction

import hashlib
import re
from datetime import datetime
from uuid import uuid4

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_school_scope, assert_student_scope
from app.models.entities import (
    Card,
    CardIssuanceEvent,
    CardStatusHistory,
    Enrollment,
    School,
    ServiceEntitlement,
    Student,
    StudentGuardian,
    StudentStatusHistory,
    Transfer,
)
from app.schemas.students import StudentArchiveRequest, StudentCreateRequest, StudentUpdateRequest
from app.services.audit_service import append_audit_event
from app.services.security_events import record_security_event


def _normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


def generate_student_number(db: Session) -> str:
    for _ in range(10):
        token = hashlib.sha256(uuid4().bytes).hexdigest()[:14].upper()
        number = f"EDU-{token}"
        if not db.execute(select(Student.id).where(Student.student_number == number)).first():
            return number
    raise RuntimeError("Unable to generate unique student number")


def student_to_dict(student: Student) -> dict:
    return {
        "id": student.id,
        "public_id": student.public_id,
        "student_number": student.student_number,
        "last_name": student.last_name,
        "first_name": student.first_name,
        "birth_date": student.birth_date.isoformat() if student.birth_date else None,
        "gender": student.gender,
        "status": student.status,
        "current_school_id": student.current_school_id,
        "current_classroom_id": student.current_classroom_id,
        "record_version": student.record_version,
    }


def create_student(db: Session, payload: StudentCreateRequest, principal: CurrentPrincipal) -> Student:
    assert_school_scope(db, principal, payload.school_id)
    if not db.get(School, payload.school_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="School not found")
    student = Student(
        public_id=str(uuid4()),
        student_number=generate_student_number(db),
        last_name=payload.last_name,
        first_name=payload.first_name,
        birth_date=payload.birth_date,
        gender=payload.gender,
        status="ACTIVE",
        current_school_id=payload.school_id,
        current_classroom_id=payload.classroom_id,
        created_by=principal.user.id,
        is_demo=True,
    )
    db.add(student)
    db.flush()
    if payload.guardian_display_name:
        db.add(
            StudentGuardian(
                student_id=student.id,
                relationship="DEMO_GUARDIAN",
                display_name=payload.guardian_display_name,
                contact_masked=payload.guardian_contact_masked,
                is_primary=True,
                is_demo=True,
            )
        )
    db.add(StudentStatusHistory(student_id=student.id, previous_status=None, new_status="ACTIVE", reason="CREATED", changed_by=principal.user.id))
    record_security_event(db, "STUDENT_CREATED", "MEDIUM", principal.user.id, "student", student.public_id)
    db.commit()
    db.refresh(student)
    return student


def update_student(db: Session, student_id: int, payload: StudentUpdateRequest, principal: CurrentPrincipal) -> Student:
    assert_student_scope(db, principal, student_id)
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.record_version != payload.record_version:
        raise HTTPException(
            status_code=409,
            detail={"message": "Record version conflict", "current_record": student_to_dict(student)},
        )
    previous_status = student.status
    if payload.last_name is not None:
        student.last_name = payload.last_name
    if payload.first_name is not None:
        student.first_name = payload.first_name
    if payload.classroom_id is not None:
        student.current_classroom_id = payload.classroom_id
    if payload.status is not None:
        student.status = payload.status
    student.record_version += 1
    if previous_status != student.status:
        db.add(StudentStatusHistory(student_id=student.id, previous_status=previous_status, new_status=student.status, reason="UPDATED", changed_by=principal.user.id))
    record_security_event(db, "STUDENT_UPDATED", "MEDIUM", principal.user.id, "student", student.public_id)
    db.commit()
    db.refresh(student)
    return student


def archive_student(db: Session, student_id: int, payload: StudentArchiveRequest, principal: CurrentPrincipal) -> Student:
    assert_student_scope(db, principal, student_id)
    student = db.execute(select(Student).where(Student.id == student_id).with_for_update()).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.record_version != payload.record_version:
        raise HTTPException(
            status_code=409,
            detail={"message": "Record version conflict", "current_record": student_to_dict(student)},
        )
    try:
        previous = student.status
        student.status = "ARCHIVED"
        student.record_version += 1
        reason = f"{payload.reason_code}: {(payload.reason_text or '').strip()}".rstrip(": ")
        db.add(StudentStatusHistory(student_id=student.id, previous_status=previous, new_status="ARCHIVED", reason=reason[:255], changed_by=principal.user.id))
        for enrollment in db.execute(
            select(Enrollment)
            .where(Enrollment.student_id == student.id, Enrollment.status == "ACTIVE")
            .with_for_update()
        ).scalars():
            enrollment.status = "ARCHIVED"
        for card in db.execute(
            select(Card)
            .where(Card.student_id == student.id, Card.status == "ACTIVE")
            .with_for_update()
        ).scalars():
            card.status = "SUSPENDED"
            db.add(
                CardStatusHistory(
                    card_id=card.id,
                    previous_status="ACTIVE",
                    new_status="SUSPENDED",
                    reason=f"STUDENT_ARCHIVED: {reason}"[:255],
                    changed_by=principal.user.id,
                )
            )
            db.add(
                CardIssuanceEvent(
                    card_id=card.id,
                    event_type="SUSPENDED_BY_STUDENT_ARCHIVE",
                    processed_by=principal.user.id,
                    details_minimized=reason,
                )
            )
        for entitlement in db.execute(
            select(ServiceEntitlement)
            .where(ServiceEntitlement.student_id == student.id, ServiceEntitlement.status == "ACTIVE")
            .with_for_update()
        ).scalars():
            entitlement.status = "SUSPENDED"
        append_audit_event(
            db,
            principal,
            "STUDENT_ARCHIVED",
            "STUDENT",
            student.public_id,
            justification=reason,
            severity="HIGH",
        )
        record_security_event(db, "STUDENT_ARCHIVED", "HIGH", principal.user.id, "student", student.public_id, reason)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(student)
    return student


def duplicate_candidates(db: Session, student: Student) -> list[dict]:
    normalized_last = _normalize(student.last_name)
    normalized_first = _normalize(student.first_name)
    rows = db.execute(
        select(Student).where(
            Student.id != student.id,
            Student.birth_date == student.birth_date,
            or_(Student.current_school_id == student.current_school_id, Student.status == "ACTIVE"),
        )
    ).scalars()
    candidates = []
    for other in rows:
        score = 0
        reasons = []
        if _normalize(other.last_name) == normalized_last:
            score += 40
            reasons.append("same_normalized_last_name")
        if _normalize(other.first_name) == normalized_first:
            score += 30
            reasons.append("same_normalized_first_name")
        if other.birth_date == student.birth_date:
            score += 20
            reasons.append("same_birth_date")
        if other.current_school_id == student.current_school_id:
            score += 10
            reasons.append("same_school")
        if score >= 60:
            candidates.append({"student_id": other.id, "student_number": other.student_number, "full_name": f"{other.first_name} {other.last_name}", "score": score, "reasons": reasons})
    return sorted(candidates, key=lambda item: item["score"], reverse=True)


def enroll_student(db: Session, student_id: int, school_id: int, classroom_id: int, school_year_id: int, status_value: str, principal: CurrentPrincipal) -> Enrollment:
    assert_student_scope(db, principal, student_id)
    assert_school_scope(db, principal, school_id)
    enrollment = Enrollment(student_id=student_id, school_id=school_id, classroom_id=classroom_id, school_year_id=school_year_id, status=status_value, validated_by=principal.user.id, is_demo=True)
    student = db.get(Student, student_id)
    student.current_school_id = school_id
    student.current_classroom_id = classroom_id
    student.record_version += 1
    db.add(enrollment)
    record_security_event(db, "STUDENT_ENROLLED", "MEDIUM", principal.user.id, "student", student.public_id)
    db.commit()
    db.refresh(enrollment)
    return enrollment


def transfer_student(
    db: Session,
    student_id: int,
    to_school_id: int,
    to_classroom_id: int | None,
    comment: str | None,
    principal: CurrentPrincipal,
    expected_from_school_id: int | None = None,
) -> Transfer:
    assert_student_scope(db, principal, student_id)
    assert_school_scope(db, principal, to_school_id)
    student = db.execute(select(Student).where(Student.id == student_id).with_for_update()).scalar_one()
    if not student.current_school_id:
        raise HTTPException(status_code=409, detail="Student has no current school")
    if expected_from_school_id is not None and student.current_school_id != expected_from_school_id:
        raise HTTPException(
            status_code=409,
            detail={
                "message": "Student school changed before transfer",
                "current_school_id": student.current_school_id,
            },
        )
    from_school_id = student.current_school_id
    from_classroom_id = student.current_classroom_id
    transfer = Transfer(
        student_id=student_id,
        from_school_id=from_school_id,
        to_school_id=to_school_id,
        from_classroom_id=from_classroom_id,
        to_classroom_id=to_classroom_id,
        approved_at=datetime.utcnow(),
        status="APPROVED",
        is_demo=True,
    )
    student.current_school_id = to_school_id
    student.current_classroom_id = to_classroom_id
    student.record_version += 1
    db.add(transfer)
    detail = f"from_school={from_school_id}; to_school={to_school_id}; comment={comment or ''}"
    record_security_event(db, "STUDENT_TRANSFERRED", "HIGH", principal.user.id, "student", student.public_id, detail)
    db.commit()
    db.refresh(transfer)
    return transfer

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_school_scope
from app.models.entities import (
    AttendanceEvent,
    Card,
    Department,
    Enrollment,
    Export,
    Incident,
    LoginAttempt,
    PaymentReconciliation,
    PaymentTransaction,
    QrVerificationEvent,
    School,
    SecurityEvent,
    ServiceVerificationEvent,
    Student,
    Subdivision,
)

SMALL_COUNT_THRESHOLD = 3


def allowed_school_ids(db: Session, principal: CurrentPrincipal, school_id: int | None = None, region_id: int | None = None, department_id: int | None = None) -> list[int]:
    stmt = select(School.id).join(Subdivision, School.subdivision_id == Subdivision.id).join(Department, Subdivision.department_id == Department.id)
    if school_id:
        assert_school_scope(db, principal, school_id)
        stmt = stmt.where(School.id == school_id)
    if region_id:
        stmt = stmt.where(Department.region_id == region_id)
    if department_id:
        stmt = stmt.where(Department.id == department_id)
    school_ids = set(db.execute(stmt).scalars())
    if not principal.scopes:
        return []
    scoped: set[int] = set()
    for scope in principal.scopes:
        if scope.scope_type == "NATIONAL":
            scoped.update(school_ids)
        elif scope.scope_type == "SCHOOL" and scope.school_id in school_ids:
            scoped.add(scope.school_id)
        elif scope.scope_type == "REGION" and scope.region_id:
            rows = db.execute(
                select(School.id)
                .join(Subdivision, School.subdivision_id == Subdivision.id)
                .join(Department, Subdivision.department_id == Department.id)
                .where(Department.region_id == scope.region_id, School.id.in_(school_ids))
            ).scalars()
            scoped.update(rows)
        elif scope.scope_type == "DEPARTMENT" and scope.department_id:
            rows = db.execute(
                select(School.id)
                .join(Subdivision, School.subdivision_id == Subdivision.id)
                .where(Subdivision.department_id == scope.department_id, School.id.in_(school_ids))
            ).scalars()
            scoped.update(rows)
    return sorted(scoped)


def mask_count(value: int) -> int | str:
    if 0 < value < SMALL_COUNT_THRESHOLD:
        return "MASKED"
    return value


def _count(db: Session, stmt) -> int:
    return int(db.execute(stmt).scalar_one() or 0)


def _date_filter(stmt, column, filters: dict):
    if filters.get("start_date"):
        stmt = stmt.where(column >= datetime.combine(filters["start_date"], datetime.min.time()))
    if filters.get("end_date"):
        stmt = stmt.where(column <= datetime.combine(filters["end_date"], datetime.max.time()))
    return stmt


def summary(db: Session, principal: CurrentPrincipal, filters: dict) -> dict:
    schools = allowed_school_ids(db, principal, filters.get("school_id"), filters.get("region_id"), filters.get("department_id"))
    if not schools:
        return {"scope_school_count": 0, "metrics": {}}
    student_stmt = select(func.count()).select_from(Student).where(Student.current_school_id.in_(schools), Student.status == "ACTIVE")
    if filters.get("classroom_id"):
        student_stmt = student_stmt.where(Student.current_classroom_id == filters["classroom_id"])
    active_students = _count(db, student_stmt)
    enrollments = _count(db, select(func.count()).select_from(Enrollment).where(Enrollment.school_id.in_(schools)))
    cards_requested = _count(db, select(func.count()).select_from(Card).join(Student, Card.student_id == Student.id).where(Student.current_school_id.in_(schools), Card.status == "REQUESTED"))
    card_counts = {
        status: _count(db, select(func.count()).select_from(Card).join(Student, Card.student_id == Student.id).where(Student.current_school_id.in_(schools), Card.status == status))
        for status in ["ACTIVE", "SUSPENDED", "REVOKED", "REPLACED"]
    }
    attendance_total = _count(db, _date_filter(select(func.count()).select_from(AttendanceEvent).where(AttendanceEvent.school_id.in_(schools)), AttendanceEvent.event_time, filters))
    late_total = _count(db, _date_filter(select(func.count()).select_from(AttendanceEvent).where(AttendanceEvent.school_id.in_(schools), AttendanceEvent.event_type == "LATE"), AttendanceEvent.event_time, filters))
    absence_total = _count(db, _date_filter(select(func.count()).select_from(AttendanceEvent).where(AttendanceEvent.school_id.in_(schools), AttendanceEvent.event_type == "ABSENCE"), AttendanceEvent.event_time, filters))
    payments_total = _count(db, _date_filter(select(func.count()).select_from(PaymentTransaction).where(PaymentTransaction.school_id.in_(schools)), PaymentTransaction.created_at, filters))
    reconciled = _count(db, select(func.count()).select_from(PaymentReconciliation).join(PaymentTransaction, PaymentReconciliation.payment_transaction_id == PaymentTransaction.id).where(PaymentTransaction.school_id.in_(schools)))
    issued = card_counts["ACTIVE"] + card_counts["SUSPENDED"] + card_counts["REVOKED"] + card_counts["REPLACED"]
    metrics = {
        "active_students": mask_count(active_students),
        "enrollments": mask_count(enrollments),
        "schools": len(schools),
        "cards_requested": mask_count(cards_requested),
        "cards_issued": mask_count(issued),
        "cards_active": mask_count(card_counts["ACTIVE"]),
        "cards_suspended": mask_count(card_counts["SUSPENDED"]),
        "cards_revoked": mask_count(card_counts["REVOKED"]),
        "cards_replaced": mask_count(card_counts["REPLACED"]),
        "issuance_rate": round((issued / max(issued + cards_requested, 1)) * 100, 2),
        "average_issuance_delay_hours": 0,
        "attendance": mask_count(attendance_total),
        "late": mask_count(late_total),
        "absences": mask_count(absence_total),
        "services_consumed": mask_count(_count(db, select(func.count()).select_from(ServiceVerificationEvent).where(ServiceVerificationEvent.result == "ALLOWED"))),
        "mock_transactions": mask_count(payments_total),
        "reconciliation_rate": round((reconciled / max(payments_total, 1)) * 100, 2),
        "duplicates_detected": mask_count(_count(db, select(func.count()).select_from(SecurityEvent).where(SecurityEvent.event_type == "STUDENT_DUPLICATES_VIEWED"))),
        "incidents_open": mask_count(_count(db, select(func.count()).select_from(Incident).where(Incident.status != "RESOLVED"))),
        "incidents_resolved": mask_count(_count(db, select(func.count()).select_from(Incident).where(Incident.status == "RESOLVED"))),
        "failed_logins": mask_count(_count(db, select(func.count()).select_from(LoginAttempt).where(LoginAttempt.result != "SUCCESS"))),
        "access_denied": mask_count(_count(db, select(func.count()).select_from(SecurityEvent).where(SecurityEvent.event_type.like("%DENIED%")))),
        "qr_invalid": mask_count(_count(db, select(func.count()).select_from(QrVerificationEvent).where(QrVerificationEvent.verification_result != "valide"))),
        "exports": mask_count(_count(db, select(func.count()).select_from(Export))),
        "alerts": mask_count(_count(db, select(func.count()).select_from(SecurityEvent).where(SecurityEvent.severity.in_(["HIGH", "CRITICAL"])))),
    }
    return {"scope_school_count": len(schools), "small_count_threshold": SMALL_COUNT_THRESHOLD, "metrics": metrics}


def grouped_counts(db: Session, principal: CurrentPrincipal, filters: dict, module: str) -> dict:
    schools = allowed_school_ids(db, principal, filters.get("school_id"), filters.get("region_id"), filters.get("department_id"))
    if not schools:
        return {"series": [], "distribution": []}
    if module == "cards":
        rows = db.execute(select(Card.status, func.count()).join(Student, Card.student_id == Student.id).where(Student.current_school_id.in_(schools)).group_by(Card.status)).all()
    elif module == "attendance":
        rows = db.execute(select(AttendanceEvent.event_type, func.count()).where(AttendanceEvent.school_id.in_(schools)).group_by(AttendanceEvent.event_type)).all()
    elif module == "payments":
        rows = db.execute(select(PaymentTransaction.status, func.count()).where(PaymentTransaction.school_id.in_(schools)).group_by(PaymentTransaction.status)).all()
    elif module == "security":
        rows = db.execute(select(SecurityEvent.severity, func.count()).group_by(SecurityEvent.severity)).all()
    else:
        rows = db.execute(select(ServiceVerificationEvent.result, func.count()).group_by(ServiceVerificationEvent.result)).all()
    return {"distribution": [{"label": str(label), "value": mask_count(int(value))} for label, value in rows], "series": []}

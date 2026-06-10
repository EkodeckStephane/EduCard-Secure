from collections import defaultdict
from datetime import date, datetime, time, timedelta
from secrets import compare_digest

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_student_scope, require_permission
from app.core.config import get_settings
from app.core.database import get_db
from app.models.entities import (
    AttendanceEvent,
    BackupEvent,
    Card,
    CardIssuanceEvent,
    CardStatusHistory,
    Classroom,
    Enrollment,
    GradeLevel,
    Incident,
    PaymentProvider,
    PaymentTransaction,
    QrVerificationEvent,
    School,
    SchoolYear,
    SecurityEvent,
    ServiceEntitlement,
    ServiceProvider,
    ServiceType,
    ServiceVerificationEvent,
    Student,
    StudentGuardian,
    StudentStatusHistory,
    Transfer,
    User,
)
from app.schemas.volume3 import BackupLogRequest
from app.services.dashboard_service import allowed_school_ids, mask_count
from app.services.student_service import duplicate_candidates, student_to_dict


router = APIRouter(tags=["volume3"])


def _period_bounds(period: str, from_date: date | None = None, to_date: date | None = None) -> tuple[datetime, datetime]:
    now = datetime.utcnow()
    if period == "custom":
        if not from_date or not to_date:
            raise HTTPException(status_code=422, detail="from and to are required for custom period")
        return datetime.combine(from_date, time.min), datetime.combine(to_date, time.max)
    days = {"today": 1, "7d": 7, "30d": 30, "90d": 90}.get(period, 30)
    return now - timedelta(days=days), now


def _delta(current: float, previous: float) -> float:
    if previous == 0:
        return 100.0 if current else 0.0
    return round((current - previous) * 100 / previous, 1)


def _scoped_schools(
    db: Session,
    principal: CurrentPrincipal,
    school_id: int | None = None,
    region_id: int | None = None,
    department_id: int | None = None,
) -> list[int]:
    return allowed_school_ids(db, principal, school_id, region_id, department_id)


def _student_ids(db: Session, schools: list[int]) -> list[int]:
    if not schools:
        return []
    return list(db.execute(select(Student.id).where(Student.current_school_id.in_(schools))).scalars())


def _school_name_map(db: Session, schools: list[int]) -> dict[int, str]:
    return {row.id: row.name for row in db.execute(select(School).where(School.id.in_(schools or [-1]))).scalars()}


@router.get("/students/{student_id}/summary")
def student_summary(
    student_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:read")),
) -> dict:
    assert_student_scope(db, principal, student_id)
    student = db.get(Student, student_id)
    guardian = db.execute(
        select(StudentGuardian).where(StudentGuardian.student_id == student_id).order_by(StudentGuardian.is_primary.desc())
    ).scalars().first()
    enrollment = db.execute(
        select(Enrollment).where(Enrollment.student_id == student_id).order_by(Enrollment.enrolled_at.desc())
    ).scalars().first()
    school = db.get(School, enrollment.school_id) if enrollment else None
    classroom = db.get(Classroom, enrollment.classroom_id) if enrollment else None
    year = db.get(SchoolYear, enrollment.school_year_id) if enrollment else None
    grade = db.get(GradeLevel, classroom.grade_level_id) if classroom else None
    active_card = db.execute(
        select(Card).where(Card.student_id == student_id).order_by((Card.status == "ACTIVE").desc(), Card.created_at.desc())
    ).scalars().first()
    services_count = int(db.execute(
        select(func.count()).select_from(ServiceEntitlement).where(
            ServiceEntitlement.student_id == student_id, ServiceEntitlement.status == "ACTIVE"
        )
    ).scalar_one() or 0)
    last_status = db.execute(
        select(StudentStatusHistory).where(StudentStatusHistory.student_id == student_id).order_by(StudentStatusHistory.changed_at.desc())
    ).scalars().first()
    last_attendance = db.execute(
        select(AttendanceEvent).where(AttendanceEvent.student_id == student_id).order_by(AttendanceEvent.event_time.desc())
    ).scalars().first()
    activities = [
        item for item in [
            {"type": "STATUS", "date": last_status.changed_at, "detail": last_status.reason} if last_status else None,
            {"type": "ATTENDANCE", "date": last_attendance.event_time, "detail": last_attendance.event_type} if last_attendance else None,
        ] if item
    ]
    return {
        **student_to_dict(student),
        "photo_url": f"/api/v1/students/{student.id}/photo",
        "guardian": {
            "display_name": guardian.display_name,
            "contact_masked": guardian.contact_masked,
            "relationship": guardian.relationship,
        } if guardian else None,
        "current_enrollment": {
            "id": enrollment.id,
            "status": enrollment.status,
            "enrolled_at": enrollment.enrolled_at,
            "school_id": enrollment.school_id,
            "school_name": school.name if school else None,
            "classroom_id": enrollment.classroom_id,
            "classroom_label": classroom.label if classroom else None,
            "grade_level": grade.label if grade else None,
            "school_year_id": enrollment.school_year_id,
            "school_year": year.code if year else None,
        } if enrollment else None,
        "active_card_status": active_card.status if active_card else None,
        "active_card_id": active_card.id if active_card else None,
        "active_services_count": services_count,
        "last_activity": max(activities, key=lambda item: item["date"]) if activities else None,
    }


@router.get("/students/{student_id}/enrollments")
def student_enrollments(
    student_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:read")),
) -> list[dict]:
    assert_student_scope(db, principal, student_id)
    rows = db.execute(
        select(Enrollment).where(Enrollment.student_id == student_id).order_by(Enrollment.enrolled_at.desc())
    ).scalars()
    result = []
    for row in rows:
        school, classroom, year = db.get(School, row.school_id), db.get(Classroom, row.classroom_id), db.get(SchoolYear, row.school_year_id)
        result.append({
            "id": row.id, "status": row.status, "enrolled_at": row.enrolled_at,
            "school_id": row.school_id, "school_name": school.name if school else None,
            "classroom_id": row.classroom_id, "classroom_label": classroom.label if classroom else None,
            "school_year_id": row.school_year_id, "school_year": year.code if year else None,
        })
    return result


@router.get("/students/{student_id}/cards")
def student_cards(
    student_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:verify")),
) -> list[dict]:
    assert_student_scope(db, principal, student_id)
    rows = db.execute(
        select(Card).where(Card.student_id == student_id).order_by((Card.status == "ACTIVE").desc(), Card.created_at.desc())
    ).scalars()
    return [{
        "id": row.id, "public_id": row.public_id, "serial_number": row.serial_number,
        "status": row.status, "card_version": row.card_version, "issued_at": row.issued_at,
        "activated_at": row.activated_at, "expires_at": row.expires_at,
    } for row in rows]


@router.get("/students/{student_id}/services")
def student_services(
    student_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("service:verify")),
) -> dict:
    assert_student_scope(db, principal, student_id)
    entitlements = list(db.execute(
        select(ServiceEntitlement).where(ServiceEntitlement.student_id == student_id).order_by(ServiceEntitlement.created_at.desc())
    ).scalars())
    usages = list(db.execute(
        select(ServiceVerificationEvent).where(ServiceVerificationEvent.student_id == student_id).order_by(ServiceVerificationEvent.verified_at.desc()).limit(100)
    ).scalars())
    types = {row.id: row for row in db.execute(select(ServiceType)).scalars()}
    providers = {row.id: row for row in db.execute(select(ServiceProvider)).scalars()}
    return {
        "entitlements": [{
            "id": row.id, "service_type_id": row.service_type_id,
            "service_type": types.get(row.service_type_id).label if types.get(row.service_type_id) else None,
            "provider": providers.get(row.service_provider_id).name if providers.get(row.service_provider_id) else None,
            "valid_from": row.valid_from, "valid_until": row.valid_until, "status": row.status,
        } for row in entitlements],
        "usages": [{
            "id": row.id, "result": row.result, "verified_at": row.verified_at,
            "service_entitlement_id": row.service_entitlement_id,
        } for row in usages],
    }


@router.get("/students/{student_id}/duplicates")
def student_duplicates(
    student_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:read")),
) -> list[dict]:
    assert_student_scope(db, principal, student_id)
    student = db.get(Student, student_id)
    result = []
    for candidate in duplicate_candidates(db, student):
        other = db.get(Student, candidate["student_id"])
        result.append({
            **candidate,
            "birth_date": other.birth_date,
            "status": other.status,
            "current_school_id": other.current_school_id,
        })
    return result


def _card_scope(db: Session, schools: list[int], school_year_id: int | None = None):
    stmt = select(Card, Student).join(Student, Student.id == Card.student_id).where(Student.current_school_id.in_(schools or [-1]))
    if school_year_id:
        stmt = stmt.join(Enrollment, Enrollment.student_id == Student.id).where(Enrollment.school_year_id == school_year_id)
    return stmt


@router.get("/dashboard/cards/kpi")
def cards_kpi(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, period: str = "30d",
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    schools = _scoped_schools(db, principal, school_id, region_id, department_id)
    rows = db.execute(_card_scope(db, schools, year_id)).all()
    statuses = defaultdict(int)
    for card, _student in rows:
        statuses[card.status] += 1
    enrolled = int(db.execute(select(func.count()).select_from(Enrollment).where(Enrollment.school_id.in_(schools or [-1]))).scalar_one() or 0)
    active = statuses["ACTIVE"]
    waiting = statuses["REQUESTED"] + statuses["ISSUED"]
    delays = [(card.issued_at - card.created_at).total_seconds() / 86400 for card, _ in rows if card.issued_at]
    return {"items": [
        {"key": "cards_active", "value": active, "delta": 0},
        {"key": "card_coverage", "value": round(active * 100 / max(enrolled, 1), 1), "suffix": "%", "delta": 0},
        {"key": "cards_pending", "value": waiting, "delta": None},
        {"key": "average_issuance_delay_days", "value": round(sum(delays) / len(delays), 1) if delays else 0, "delta": 0},
    ], "period": period}


@router.get("/dashboard/cards/distribution")
def cards_distribution(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, status: str | None = None,
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    schools = _scoped_schools(db, principal, school_id, region_id, department_id)
    rows = db.execute(_card_scope(db, schools, year_id)).all()
    counts = defaultdict(int)
    for card, _student in rows:
        if not status or card.status == status:
            counts[card.status] += 1
    return {"distribution": [{"label": key, "value": mask_count(value)} for key, value in sorted(counts.items())]}


@router.get("/dashboard/cards/trend")
def cards_trend(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, months: int = Query(default=12, ge=1, le=24),
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    schools = _scoped_schools(db, principal, school_id, region_id, department_id)
    since = datetime.utcnow() - timedelta(days=months * 31)
    cards = [row[0] for row in db.execute(_card_scope(db, schools, year_id).where(Card.created_at >= since)).all()]
    buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"requested": 0, "activated": 0})
    for card in cards:
        buckets[card.created_at.strftime("%Y-%m")]["requested"] += 1
        if card.activated_at:
            buckets[card.activated_at.strftime("%Y-%m")]["activated"] += 1
    return {"series": [{"label": key, **value} for key, value in sorted(buckets.items())]}


@router.get("/dashboard/cards/by-school")
def cards_by_school(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, status: str | None = None,
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    schools = _scoped_schools(db, principal, school_id, region_id, department_id)
    names = _school_name_map(db, schools)
    result = []
    for sid in schools:
        enrolled = int(db.execute(select(func.count()).select_from(Enrollment).where(Enrollment.school_id == sid)).scalar_one() or 0)
        rows = db.execute(_card_scope(db, [sid], year_id)).all()
        counts = defaultdict(int)
        for card, _student in rows:
            if not status or card.status == status:
                counts[card.status] += 1
        active = counts["ACTIVE"]
        result.append({
            "school_id": sid, "school": names.get(sid), "enrolled": enrolled, "active": active,
            "coverage_pct": round(active * 100 / max(enrolled, 1), 1),
            "pending": counts["REQUESTED"] + counts["ISSUED"], "suspended": counts["SUSPENDED"], "revoked": counts["REVOKED"],
        })
    return {"items": sorted(result, key=lambda item: item["coverage_pct"])}


def _attendance_rows(db: Session, schools: list[int], target_date: date | None = None, event_type: str | None = None):
    stmt = select(AttendanceEvent).where(AttendanceEvent.school_id.in_(schools or [-1]))
    if target_date:
        stmt = stmt.where(
            AttendanceEvent.event_time >= datetime.combine(target_date, time.min),
            AttendanceEvent.event_time <= datetime.combine(target_date, time.max),
        )
    if event_type:
        stmt = stmt.where(AttendanceEvent.event_type == event_type)
    return list(db.execute(stmt).scalars())


@router.get("/dashboard/attendance/kpi")
def attendance_kpi(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, date_value: date | None = Query(default=None, alias="date"),
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    target = date_value or date.today()
    schools = _scoped_schools(db, principal, school_id, region_id, department_id)
    rows = _attendance_rows(db, schools, target)
    counts = defaultdict(int)
    for row in rows:
        counts[row.event_type] += 1
    enrolled = int(db.execute(select(func.count()).select_from(Enrollment).where(Enrollment.school_id.in_(schools or [-1]), Enrollment.status == "ACTIVE")).scalar_one() or 0)
    present = counts["ENTRY"] + counts["PRESENT"]
    return {"items": [
        {"key": "attendance_rate_today", "value": round(present * 100 / max(enrolled, 1), 1), "suffix": "%", "delta": 0},
        {"key": "unjustified_absences", "value": counts["ABSENT_UNJUSTIFIED"] + counts["ABSENCE"], "delta": 0},
        {"key": "late_today", "value": counts["LATE"], "delta": 0},
        {"key": "early_departures", "value": counts["EARLY_DEPARTURE"], "delta": 0},
    ]}


@router.get("/dashboard/attendance/distribution")
def attendance_distribution(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, date_value: date | None = Query(default=None, alias="date"), event_type: str | None = None,
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    rows = _attendance_rows(db, _scoped_schools(db, principal, school_id, region_id, department_id), date_value, event_type)
    counts = defaultdict(int)
    for row in rows:
        counts[row.event_type] += 1
    return {"distribution": [{"label": key, "value": mask_count(value)} for key, value in sorted(counts.items())]}


@router.get("/dashboard/attendance/weekly-trend")
def attendance_weekly_trend(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, week: str = "current",
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    schools = _scoped_schools(db, principal, school_id, region_id, department_id)
    today = date.today()
    monday = today - timedelta(days=today.weekday())
    enrolled = int(db.execute(select(func.count()).select_from(Enrollment).where(Enrollment.school_id.in_(schools or [-1]), Enrollment.status == "ACTIVE")).scalar_one() or 0)
    series = []
    for offset in range(5):
        day = monday + timedelta(days=offset)
        rows = _attendance_rows(db, schools, day)
        present = sum(1 for row in rows if row.event_type in {"ENTRY", "PRESENT"})
        series.append({"label": day.isoformat(), "value": round(present * 100 / max(enrolled, 1), 1), "reference": 80})
    return {"series": series, "week": week}


@router.get("/dashboard/attendance/by-class")
def attendance_by_class(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, date_value: date | None = Query(default=None, alias="date"), event_type: str | None = None,
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    schools = _scoped_schools(db, principal, school_id, region_id, department_id)
    target = date_value or date.today()
    rows = _attendance_rows(db, schools, target, event_type)
    by_class: dict[int, list[AttendanceEvent]] = defaultdict(list)
    for row in rows:
        if row.classroom_id:
            by_class[row.classroom_id].append(row)
    result = []
    for class_id, events in by_class.items():
        classroom = db.get(Classroom, class_id)
        enrollment_count = int(db.execute(select(func.count()).select_from(Enrollment).where(Enrollment.classroom_id == class_id, Enrollment.status == "ACTIVE")).scalar_one() or 0)
        counts = defaultdict(int)
        for event in events:
            counts[event.event_type] += 1
        present = counts["ENTRY"] + counts["PRESENT"]
        result.append({
            "class_id": class_id, "classroom": classroom.label if classroom else str(class_id), "enrolled": enrollment_count,
            "present": present, "absent_justified": counts["ABSENT_JUSTIFIED"],
            "absent_unjustified": counts["ABSENT_UNJUSTIFIED"] + counts["ABSENCE"], "late": counts["LATE"],
            "attendance_rate_pct": round(present * 100 / max(enrollment_count, 1), 1),
        })
    return {"items": sorted(result, key=lambda item: item["attendance_rate_pct"])}


def _payment_rows(db: Session, schools: list[int], year_id: int | None, status: str | None, period: str):
    start, end = _period_bounds(period)
    stmt = select(PaymentTransaction).where(
        PaymentTransaction.school_id.in_(schools or [-1]),
        PaymentTransaction.created_at >= start,
        PaymentTransaction.created_at <= end,
    )
    if year_id:
        stmt = stmt.where(PaymentTransaction.school_year_id == year_id)
    if status:
        stmt = stmt.where(PaymentTransaction.status == status)
    return list(db.execute(stmt).scalars())


@router.get("/dashboard/payments/kpi")
def payments_kpi_v3(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, period: str = "30d",
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    rows = _payment_rows(db, _scoped_schools(db, principal, school_id, region_id, department_id), year_id, None, period)
    reconciled = [row for row in rows if row.status == "RECONCILED"]
    overdue = [row for row in rows if row.status == "PENDING" and row.created_at < datetime.utcnow() - timedelta(hours=48)]
    return {"items": [
        {"key": "reconciled_volume", "value": round(sum(float(row.amount) for row in reconciled), 2), "suffix": " XAF", "delta": 0},
        {"key": "transaction_count", "value": len(rows), "delta": 0},
        {"key": "payment_success_rate", "value": round(len(reconciled) * 100 / max(len(rows), 1), 1), "suffix": "%", "delta": 0},
        {"key": "pending_over_48h", "value": len(overdue), "delta": None, "alert": bool(overdue)},
    ]}


@router.get("/dashboard/payments/by-provider")
def payments_by_provider(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, period: str = "30d", status: str | None = None,
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    rows = _payment_rows(db, _scoped_schools(db, principal, school_id, region_id, department_id), year_id, status, period)
    providers = {row.id: row.label for row in db.execute(select(PaymentProvider)).scalars()}
    grouped = defaultdict(lambda: {"count": 0, "amount": 0.0})
    for row in rows:
        key = providers.get(row.payment_provider_id, "Mock")
        grouped[key]["count"] += 1
        grouped[key]["amount"] += float(row.amount)
    return {"items": [{"label": key, **value} for key, value in grouped.items()]}


@router.get("/dashboard/payments/by-category")
def payments_by_category(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, period: str = "30d", status: str | None = None,
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    rows = _payment_rows(db, _scoped_schools(db, principal, school_id, region_id, department_id), year_id, status, period)
    grouped = defaultdict(float)
    for row in rows:
        grouped[row.category] += float(row.amount)
    return {"distribution": [{"label": key, "value": round(value, 2)} for key, value in grouped.items()]}


@router.get("/dashboard/payments/by-school")
def payments_by_school(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, period: str = "30d", status: str | None = None,
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    schools = _scoped_schools(db, principal, school_id, region_id, department_id)
    names = _school_name_map(db, schools)
    rows = _payment_rows(db, schools, year_id, status, period)
    grouped = defaultdict(list)
    for row in rows:
        grouped[row.school_id].append(row)
    result = []
    for sid, items in grouped.items():
        reconciled = sum(1 for row in items if row.status == "RECONCILED")
        failed = sum(1 for row in items if row.status in {"FAILED", "ERROR"})
        pending = len(items) - reconciled - failed
        result.append({
            "school_id": sid, "school": names.get(sid), "transactions": len(items),
            "total_amount": round(sum(float(row.amount) for row in items), 2),
            "reconciled": reconciled, "pending": pending, "failed": failed,
            "success_rate_pct": round(reconciled * 100 / max(len(items), 1), 1),
        })
    return {"items": result}


def _security_rows(db: Session, start: datetime, end: datetime, severity: str | None = None, event_type: str | None = None):
    stmt = select(SecurityEvent).where(SecurityEvent.created_at >= start, SecurityEvent.created_at <= end)
    if severity:
        stmt = stmt.where(SecurityEvent.severity == severity)
    if event_type:
        stmt = stmt.where(SecurityEvent.event_type == event_type)
    return list(db.execute(stmt).scalars())


@router.get("/dashboard/security/kpi")
def security_kpi(
    school_id: int | None = None, period: str = "30d",
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    start, end = _period_bounds(period)
    rows = _security_rows(db, start, end)
    critical = sum(1 for row in rows if row.severity == "CRITICAL" and row.alert_status == "OPEN")
    incidents = int(db.execute(select(func.count()).select_from(Incident).where(Incident.status.in_(["OPEN", "IN_PROGRESS"]))).scalar_one() or 0)
    qr_invalid = int(db.execute(select(func.count()).select_from(QrVerificationEvent).where(QrVerificationEvent.verified_at >= datetime.utcnow() - timedelta(days=7), QrVerificationEvent.verification_result != "valide")).scalar_one() or 0)
    scope_denied = sum(1 for row in rows if "DENIED" in row.event_type or "SCOPE" in row.event_type)
    return {"items": [
        {"key": "critical_alerts_open", "value": critical, "alert": critical > 0},
        {"key": "incidents_open", "value": incidents, "delta": 0, "alert": incidents > 0},
        {"key": "invalid_qr_7d", "value": qr_invalid, "delta": 0},
        {"key": "scope_violations_7d", "value": scope_denied, "delta": 0},
    ]}


@router.get("/dashboard/security/distribution")
def security_distribution(
    school_id: int | None = None, period: str = "30d", severity: str | None = None, event_type: str | None = None,
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    start, end = _period_bounds(period)
    counts = defaultdict(int)
    for row in _security_rows(db, start, end, severity, event_type):
        counts[row.severity] += 1
    return {"distribution": [{"label": key, "value": value} for key, value in counts.items()]}


@router.get("/dashboard/security/critical-trend")
def security_critical_trend(
    school_id: int | None = None, days: int = Query(default=30, ge=1, le=90),
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    rows = _security_rows(db, datetime.utcnow() - timedelta(days=days), datetime.utcnow(), "CRITICAL")
    grouped = defaultdict(int)
    for row in rows:
        grouped[row.created_at.date().isoformat()] += 1
    return {"series": [{"label": key, "value": value} for key, value in sorted(grouped.items())]}


@router.get("/dashboard/security/by-event-type")
def security_by_event_type(
    school_id: int | None = None, period: str = "30d", severity: str | None = None, alert_status: str | None = None,
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    start, end = _period_bounds(period)
    rows = _security_rows(db, start, end, severity)
    if alert_status:
        rows = [row for row in rows if row.alert_status == alert_status]
    grouped: dict[str, list[SecurityEvent]] = defaultdict(list)
    for row in rows:
        grouped[row.event_type].append(row)
    return {"items": [{
        "event_type": key, "count": len(items), "critical": sum(1 for row in items if row.severity == "CRITICAL"),
        "last_occurrence": max(row.created_at for row in items), "trend": 0,
    } for key, items in grouped.items()]}


def _service_rows(db: Session, student_ids: list[int], start: datetime, end: datetime, result: str | None = None):
    stmt = select(ServiceVerificationEvent).where(
        ServiceVerificationEvent.student_id.in_(student_ids or [-1]),
        ServiceVerificationEvent.verified_at >= start,
        ServiceVerificationEvent.verified_at <= end,
    )
    if result:
        stmt = stmt.where(ServiceVerificationEvent.result == result)
    return list(db.execute(stmt).scalars())


@router.get("/dashboard/services/kpi")
def services_kpi(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, period: str = "30d",
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    student_ids = _student_ids(db, _scoped_schools(db, principal, school_id, region_id, department_id))
    start, end = _period_bounds(period)
    rows = _service_rows(db, student_ids, start, end)
    active = int(db.execute(select(func.count()).select_from(ServiceEntitlement).where(ServiceEntitlement.student_id.in_(student_ids or [-1]), ServiceEntitlement.status == "ACTIVE")).scalar_one() or 0)
    today_rows = _service_rows(db, student_ids, datetime.combine(date.today(), time.min), datetime.combine(date.today(), time.max))
    granted = sum(1 for row in rows if row.result in {"ALLOWED", "GRANTED"})
    limits = sum(1 for row in rows if row.result == "LIMIT_REACHED")
    return {"items": [
        {"key": "active_entitlements", "value": active, "delta": 0},
        {"key": "service_checks_today", "value": len(today_rows), "delta": 0},
        {"key": "service_access_rate", "value": round(granted * 100 / max(len(rows), 1), 1), "suffix": "%", "delta": 0},
        {"key": "limits_reached_7d", "value": limits, "delta": 0},
    ]}


@router.get("/dashboard/services/distribution")
def services_distribution(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, period: str = "30d", result: str | None = None,
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    student_ids = _student_ids(db, _scoped_schools(db, principal, school_id, region_id, department_id))
    start, end = _period_bounds(period)
    counts = defaultdict(int)
    for row in _service_rows(db, student_ids, start, end, result):
        counts[row.result] += 1
    return {"distribution": [{"label": key, "value": value} for key, value in counts.items()]}


@router.get("/dashboard/services/by-type")
def services_by_type(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, period: str = "30d", result: str | None = None,
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    student_ids = _student_ids(db, _scoped_schools(db, principal, school_id, region_id, department_id))
    start, end = _period_bounds(period)
    rows = _service_rows(db, student_ids, start, end, result)
    entitlements = {row.id: row for row in db.execute(select(ServiceEntitlement)).scalars()}
    types = {row.id: row.label for row in db.execute(select(ServiceType)).scalars()}
    counts = defaultdict(int)
    for row in rows:
        entitlement = entitlements.get(row.service_entitlement_id)
        counts[types.get(entitlement.service_type_id, "Unknown") if entitlement else "Unknown"] += 1
    return {"distribution": [{"label": key, "value": value} for key, value in counts.items()]}


@router.get("/dashboard/services/by-type-provider")
def services_by_type_provider(
    school_id: int | None = None, region_id: int | None = None, department_id: int | None = None,
    year_id: int | None = None, period: str = "30d",
    service_type: int | None = None, result: str | None = None,
    db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    student_ids = _student_ids(db, _scoped_schools(db, principal, school_id, region_id, department_id))
    start, end = _period_bounds(period)
    usages = _service_rows(db, student_ids, start, end, result)
    usage_by_entitlement = defaultdict(list)
    for usage in usages:
        usage_by_entitlement[usage.service_entitlement_id].append(usage)
    stmt = select(ServiceEntitlement).where(ServiceEntitlement.student_id.in_(student_ids or [-1]))
    if service_type:
        stmt = stmt.where(ServiceEntitlement.service_type_id == service_type)
    types = {row.id: row.label for row in db.execute(select(ServiceType)).scalars()}
    providers = {row.id: row.name for row in db.execute(select(ServiceProvider)).scalars()}
    result_rows = []
    for entitlement in db.execute(stmt).scalars():
        checks = usage_by_entitlement.get(entitlement.id, [])
        granted = sum(1 for row in checks if row.result in {"ALLOWED", "GRANTED"})
        result_rows.append({
            "service_type_id": entitlement.service_type_id, "service_type": types.get(entitlement.service_type_id),
            "provider": providers.get(entitlement.service_provider_id), "active_entitlements": 1 if entitlement.status == "ACTIVE" else 0,
            "checks": len(checks), "granted": granted, "denied": len(checks) - granted,
            "access_rate_pct": round(granted * 100 / max(len(checks), 1), 1),
        })
    return {"items": result_rows}


def _backup_dict(row: BackupEvent, users: dict[int, User]) -> dict:
    creator = users.get(row.created_by) if row.created_by else None
    return {
        "id": row.id, "event_type": row.event_type, "status": row.status,
        "file_reference": row.file_reference, "started_at": row.started_at, "finished_at": row.finished_at,
        "created_by": creator.username if creator else None, "operator": row.operator or (creator.display_name if creator else "Script"),
        "checksum_present": row.checksum_present, "file_size_bytes": row.file_size_bytes,
    }


@router.get("/backups/summary")
def backup_summary(
    principal: CurrentPrincipal = Depends(require_permission("backup:read")),
    db: Session = Depends(get_db),
) -> dict:
    del principal
    rows = list(db.execute(select(BackupEvent).order_by(BackupEvent.finished_at.desc(), BackupEvent.started_at.desc())).scalars())
    last_success = next((row for row in rows if row.event_type == "BACKUP_CREATED" and row.status == "SUCCESS"), None)
    last_verification = next((row for row in rows if row.event_type == "BACKUP_VERIFIED" and row.status == "CHECKSUM_OK"), None)
    last_failure = next((row for row in rows if row.status in {"FAILED", "CHECKSUM_FAILED"}), None)
    reference_time = last_success.finished_at or last_success.started_at if last_success else None
    age_hours = round((datetime.utcnow() - reference_time).total_seconds() / 3600, 1) if reference_time else None
    users = {row.id: row for row in db.execute(select(User)).scalars()}
    return {
        "last_success": _backup_dict(last_success, users) if last_success else None,
        "last_verification": _backup_dict(last_verification, users) if last_verification else None,
        "last_failure": _backup_dict(last_failure, users) if last_failure else None,
        "age_hours": age_hours,
    }


@router.post("/backups/log", include_in_schema=False)
def log_backup_event(
    payload: BackupLogRequest,
    service_token: str | None = Header(default=None, alias="X-Service-Token"),
    db: Session = Depends(get_db),
) -> dict:
    expected = get_settings().backup_service_token
    if not expected or not service_token or not compare_digest(expected, service_token):
        raise HTTPException(status_code=401, detail="Invalid service token")
    row = BackupEvent(
        event_type=payload.event_type,
        status=payload.status,
        file_reference=payload.file_reference,
        checksum_present=payload.checksum_present,
        file_size_bytes=payload.file_size_bytes,
        started_at=payload.started_at,
        finished_at=payload.finished_at,
        operator=payload.operator,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "status": "logged"}

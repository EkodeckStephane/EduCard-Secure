from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, get_current_principal, require_csrf, require_permission
from app.core.database import get_db
from app.models.entities import AttendanceCorrection, AttendanceEvent, Card, Export, Incident, PaymentProvider, PaymentTransaction, SecurityEvent, Student
from app.schemas.dashboard import DashboardFilters, ExportCreateRequest, ExportResponse
from app.services.dashboard_service import allowed_school_ids, grouped_counts, summary
from app.services.export_service import create_export, export_download, export_to_dict
from app.services.security_events import record_security_event


router = APIRouter(tags=["dashboard"])


def _filters(
    start_date=None,
    end_date=None,
    region_id: int | None = None,
    department_id: int | None = None,
    school_id: int | None = None,
    school_year_id: int | None = None,
    classroom_id: int | None = None,
    grade_level_id: int | None = None,
    status: str | None = None,
    service_type_id: int | None = None,
    severity: str | None = None,
) -> dict:
    return DashboardFilters(
        start_date=start_date,
        end_date=end_date,
        region_id=region_id,
        department_id=department_id,
        school_id=school_id,
        school_year_id=school_year_id,
        classroom_id=classroom_id,
        grade_level_id=grade_level_id,
        status=status,
        service_type_id=service_type_id,
        severity=severity,
    ).model_dump()


@router.get("/dashboard/summary")
def dashboard_summary(
    school_id: int | None = None,
    region_id: int | None = None,
    department_id: int | None = None,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
):
    result = summary(db, principal, _filters(school_id=school_id, region_id=region_id, department_id=department_id))
    record_security_event(db, "DASHBOARD_SUMMARY_VIEWED", "INFO", principal.user.id, "dashboard")
    db.commit()
    return result


@router.get("/dashboard/kpi")
def dashboard_kpi(
    school_id: int | None = None,
    region_id: int | None = None,
    department_id: int | None = None,
    period: str = Query(default="30d", pattern="^(today|7d|30d)$"),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    result = summary(db, principal, _filters(school_id=school_id, region_id=region_id, department_id=department_id))
    metrics = result.get("metrics", {})
    days = {"today": 1, "7d": 7, "30d": 30}[period]
    current_start = datetime.utcnow() - timedelta(days=days)
    previous_start = current_start - timedelta(days=days)
    schools = allowed_school_ids(db, principal, school_id, region_id, department_id)

    def count_between(model, date_column, *criteria, previous: bool = False) -> int:
        start, end = (previous_start, current_start) if previous else (current_start, datetime.utcnow())
        stmt = select(func.count()).select_from(model).where(date_column >= start, date_column < end, *criteria)
        return int(db.execute(stmt).scalar_one() or 0)

    def delta(current: int, previous: int) -> float | None:
        if previous == 0:
            return 100.0 if current else 0.0
        return round((current - previous) * 100 / previous, 1)

    student_current = count_between(Student, Student.created_at, Student.current_school_id.in_(schools))
    student_previous = count_between(Student, Student.created_at, Student.current_school_id.in_(schools), previous=True)
    card_current = count_between(Card, Card.issued_at, Card.student_id.in_(select(Student.id).where(Student.current_school_id.in_(schools))))
    card_previous = count_between(Card, Card.issued_at, Card.student_id.in_(select(Student.id).where(Student.current_school_id.in_(schools))), previous=True)
    attendance_current = count_between(AttendanceEvent, AttendanceEvent.event_time, AttendanceEvent.school_id.in_(schools))
    attendance_previous = count_between(AttendanceEvent, AttendanceEvent.event_time, AttendanceEvent.school_id.in_(schools), previous=True)
    alert_current = count_between(SecurityEvent, SecurityEvent.created_at, SecurityEvent.severity.in_(["HIGH", "CRITICAL"]))
    alert_previous = count_between(SecurityEvent, SecurityEvent.created_at, SecurityEvent.severity.in_(["HIGH", "CRITICAL"]), previous=True)
    payment_current = count_between(PaymentTransaction, PaymentTransaction.created_at, PaymentTransaction.school_id.in_(schools))
    payment_previous = count_between(PaymentTransaction, PaymentTransaction.created_at, PaymentTransaction.school_id.in_(schools), previous=True)

    candidates = {
        "students": {"key": "active_students", "value": metrics.get("active_students", 0), "delta": delta(student_current, student_previous), "target": "students"},
        "cards": {"key": "card_coverage", "value": metrics.get("issuance_rate", 0), "delta": delta(card_current, card_previous), "target": "cards", "suffix": "%"},
        "attendance": {"key": "attendance_today", "value": metrics.get("attendance", 0), "delta": delta(attendance_current, attendance_previous), "target": "attendance"},
        "payments": {"key": "mock_transactions", "value": metrics.get("mock_transactions", 0), "delta": delta(payment_current, payment_previous), "target": "payments"},
        "alerts": {"key": "open_alerts", "value": metrics.get("alerts", 0), "delta": delta(alert_current, alert_previous), "target": "alerts"},
    }
    role_items = ["students", "cards", "attendance", "alerts"]
    if "AGENT_FINANCE" in principal.role_codes:
        role_items = ["payments", "students", "cards"]
    elif "AGENT_PRESENCE" in principal.role_codes:
        role_items = ["attendance", "students", "alerts"]
    elif "AGENT_CARTE" in principal.role_codes:
        role_items = ["cards", "students", "alerts"]
    elif "AUDITEUR_SECURITE" in principal.role_codes:
        role_items = ["alerts", "students", "cards"]
    elif "RESPONSABLE_ETABLISSEMENT" in principal.role_codes:
        role_items = ["students", "attendance", "cards", "payments"]

    trend_rows = db.execute(
        select(func.date(AttendanceEvent.event_time), func.count())
        .where(AttendanceEvent.school_id.in_(schools), AttendanceEvent.event_time >= current_start)
        .group_by(func.date(AttendanceEvent.event_time))
        .order_by(func.date(AttendanceEvent.event_time))
    ).all()
    return {
        "period": period,
        "items": [candidates[key] for key in role_items],
        "trend": [{"label": str(day), "value": int(count)} for day, count in trend_rows],
    }


@router.get("/dashboard/pending-actions")
def pending_actions(
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("dashboard:read")),
) -> dict:
    corrections = int(db.execute(select(func.count()).select_from(AttendanceCorrection).where(AttendanceCorrection.approved_at.is_(None))).scalar_one())
    duplicates = int(db.execute(select(func.count()).select_from(SecurityEvent).where(SecurityEvent.event_type == "STUDENT_DUPLICATES_VIEWED")).scalar_one())
    incidents = int(db.execute(select(func.count()).select_from(Incident).where(Incident.status.notin_(["RESOLVED", "CLOSED"]))).scalar_one())
    exports = int(db.execute(select(func.count()).select_from(Export).where(Export.requested_by == principal.user.id, Export.status != "DOWNLOADED")).scalar_one())
    items = [
        {"key": "attendance_corrections", "count": corrections, "target": "attendance"},
        {"key": "student_duplicates", "count": duplicates, "target": "students"},
        {"key": "open_incidents", "count": incidents, "target": "incidents"},
        {"key": "pending_exports", "count": exports, "target": "exports"},
    ]
    return {"total": sum(item["count"] for item in items), "items": items}


@router.get("/dashboard/cards")
def dashboard_cards(school_id: int | None = None, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read"))):
    return grouped_counts(db, principal, _filters(school_id=school_id), "cards")


@router.get("/dashboard/attendance")
def dashboard_attendance(school_id: int | None = None, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read"))):
    return grouped_counts(db, principal, _filters(school_id=school_id), "attendance")


@router.get("/dashboard/payments")
def dashboard_payments(school_id: int | None = None, school_year_id: int | None = None, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read"))):
    stmt = select(PaymentTransaction)
    if school_id:
        from app.api.v1.dependencies import assert_school_scope
        assert_school_scope(db, principal, school_id)
        stmt = stmt.where(PaymentTransaction.school_id == school_id)
    if school_year_id:
        stmt = stmt.where(PaymentTransaction.school_year_id == school_year_id)
    rows = list(db.execute(stmt).scalars())
    scoped = []
    from app.api.v1.dependencies import assert_school_scope
    for row in rows:
        try:
            assert_school_scope(db, principal, row.school_id)
            scoped.append(row)
        except Exception:
            continue
    provider_ids = {row.payment_provider_id for row in scoped}
    providers = {row.id: row.label for row in db.execute(select(PaymentProvider).where(PaymentProvider.id.in_(provider_ids or [-1]))).scalars()}
    reconciled = [row for row in scoped if row.status == "RECONCILED"]
    by_provider = {}
    by_category = {}
    for row in scoped:
        provider = providers.get(row.payment_provider_id, "Mock")
        by_provider.setdefault(provider, {"provider": provider, "amount": 0.0, "count": 0})
        by_provider[provider]["amount"] += float(row.amount)
        by_provider[provider]["count"] += 1
        by_category.setdefault(row.category, {"category": row.category, "amount": 0.0, "count": 0})
        by_category[row.category]["amount"] += float(row.amount)
        by_category[row.category]["count"] += 1
    return {
        "total_reconciled_amount": sum(float(row.amount) for row in reconciled),
        "total_reconciled_count": len(reconciled),
        "success_rate_pct": round(len(reconciled) * 100 / len(scoped), 1) if scoped else 0,
        "by_provider": list(by_provider.values()),
        "by_category": list(by_category.values()),
        "pending_over_48h": 0,
        "distribution": [{"label": item["provider"], "count": item["count"]} for item in by_provider.values()],
    }


@router.get("/dashboard/security")
def dashboard_security(db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read"))):
    return grouped_counts(db, principal, _filters(), "security")


@router.get("/dashboard/services")
def dashboard_services(db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read"))):
    return grouped_counts(db, principal, _filters(), "services")


@router.post("/exports", response_model=ExportResponse)
@router.post("/exports/request", response_model=ExportResponse)
def create_export_endpoint(
    payload: ExportCreateRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
    _: None = Depends(require_csrf),
) -> ExportResponse:
    return ExportResponse(**export_to_dict(create_export(db, principal, payload)))


@router.get("/exports", response_model=list[ExportResponse])
def list_exports(db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("export:download"))) -> list[ExportResponse]:
    rows = db.execute(select(Export).where(Export.requested_by == principal.user.id).order_by(Export.created_at.desc()).limit(100)).scalars()
    return [ExportResponse(**export_to_dict(row)) for row in rows]


@router.get("/exports/{export_id}", response_model=ExportResponse)
def get_export(export_id: int, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("export:download"))) -> ExportResponse:
    row = db.get(Export, export_id)
    if not row or row.requested_by != principal.user.id:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Export not found")
    return ExportResponse(**export_to_dict(row))


@router.post("/exports/{export_id}/download")
@router.get("/exports/{export_id}/download")
def download_export(
    export_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
    _: None = Depends(require_csrf),
):
    content, filename = export_download(db, principal, export_id)
    row = db.get(Export, export_id)
    return Response(content=content, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"', "X-Export-Checksum": row.checksum_sha256 or ""})


@router.get("/exports/{export_id}/status")
def export_status(export_id: int, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("export:download"))):
    return get_export(export_id, db, principal)


@router.post("/exports/{export_id}/redownload")
def redownload_export(export_id: int, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(get_current_principal), _: None = Depends(require_csrf)):
    content, filename = export_download(db, principal, export_id)
    row = db.get(Export, export_id)
    return Response(content=content, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"', "X-Export-Checksum": row.checksum_sha256 or ""})

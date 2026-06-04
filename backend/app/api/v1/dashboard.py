from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, get_current_principal, require_csrf, require_permission
from app.core.database import get_db
from app.models.entities import Export
from app.schemas.dashboard import DashboardFilters, ExportCreateRequest, ExportResponse
from app.services.dashboard_service import grouped_counts, summary
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


@router.get("/dashboard/cards")
def dashboard_cards(school_id: int | None = None, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read"))):
    return grouped_counts(db, principal, _filters(school_id=school_id), "cards")


@router.get("/dashboard/attendance")
def dashboard_attendance(school_id: int | None = None, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read"))):
    return grouped_counts(db, principal, _filters(school_id=school_id), "attendance")


@router.get("/dashboard/payments")
def dashboard_payments(school_id: int | None = None, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read"))):
    return grouped_counts(db, principal, _filters(school_id=school_id), "payments")


@router.get("/dashboard/security")
def dashboard_security(db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read"))):
    return grouped_counts(db, principal, _filters(), "security")


@router.get("/dashboard/services")
def dashboard_services(db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("dashboard:read"))):
    return grouped_counts(db, principal, _filters(), "services")


@router.post("/exports", response_model=ExportResponse)
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
def download_export(
    export_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(get_current_principal),
    _: None = Depends(require_csrf),
):
    content, filename = export_download(db, principal, export_id)
    return Response(content=content, media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{filename}"'})

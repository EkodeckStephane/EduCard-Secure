from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_school_scope, require_csrf, require_permission
from app.core.database import get_db
from app.models.entities import AdministrativeValidation, Classroom, Department, Enrollment, GradeLevel, Region, School, SchoolYear, Subdivision
from app.schemas.school_map import (
    ClassroomCreateRequest,
    DepartmentCreateRequest,
    RegionCreateRequest,
    SchoolCreateRequest,
    SchoolYearCreateRequest,
    SubdivisionCreateRequest,
    ValidationDecisionRequest,
    ValidationRejectRequest,
    GradeLevelUpdateRequest,
)
from app.services.security_events import record_security_event


router = APIRouter(tags=["school-map"])


def _queue_validation(db: Session, principal: CurrentPrincipal, entity_type: str, entity_id: int, label: str, justification: str | None) -> None:
    db.add(AdministrativeValidation(entity_type=entity_type, entity_id=entity_id, entity_label=label, status="PENDING_VALIDATION", justification=justification, proposed_by=principal.user.id))


def _department_allowed(db: Session, principal: CurrentPrincipal, department_id: int) -> bool:
    if not principal.scopes:
        return False
    department = db.get(Department, department_id)
    if not department:
        return False
    for scope in principal.scopes:
        if scope.scope_type == "NATIONAL":
            return True
        if scope.scope_type == "REGION" and scope.region_id == department.region_id:
            return True
        if scope.scope_type == "DEPARTMENT" and scope.department_id == department_id:
            return True
    return False


def _subdivision_allowed(db: Session, principal: CurrentPrincipal, subdivision_id: int) -> bool:
    subdivision = db.get(Subdivision, subdivision_id)
    if not subdivision:
        return False
    return _department_allowed(db, principal, subdivision.department_id)


def _school_map_rows(db: Session, principal: CurrentPrincipal) -> list[dict]:
    stmt = (
        select(School, Subdivision, Department, Region)
        .join(Subdivision, School.subdivision_id == Subdivision.id)
        .join(Department, Subdivision.department_id == Department.id)
        .join(Region, Department.region_id == Region.id)
        .order_by(Region.name, Department.name, Subdivision.name, School.name)
    )
    rows: list[dict] = []
    for school, subdivision, department, region in db.execute(stmt).all():
        try:
            assert_school_scope(db, principal, school.id)
        except HTTPException:
            continue
        rows.append(
            {
                "region_id": region.id,
                "region": region.name,
                "region_capital": region.capital,
                "department_id": department.id,
                "department": department.name,
                "department_capital": department.capital,
                "subdivision_id": subdivision.id,
                "subdivision": subdivision.name,
                "subdivision_capital": subdivision.capital,
                "school_id": school.id,
                "school_code": school.code,
                "school": school.name,
                "school_type": school.school_type,
                "education_subsystem": school.education_subsystem,
                "status": school.status,
            }
        )
    return rows


@router.get("/school-map/hierarchy")
def hierarchy(
    principal: CurrentPrincipal = Depends(require_permission("student:read")),
    db: Session = Depends(get_db),
) -> dict:
    scopes = [
        {
            "scope_type": scope.scope_type,
            "region_id": scope.region_id,
            "department_id": scope.department_id,
            "school_id": scope.school_id,
        }
        for scope in principal.scopes
    ]
    return {"scopes": scopes, "schools": _school_map_rows(db, principal)}


@router.get("/school-map/regions")
def list_regions(principal: CurrentPrincipal = Depends(require_permission("student:read")), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.execute(select(Region).order_by(Region.name)).scalars().all()
    if any(scope.scope_type == "NATIONAL" for scope in principal.scopes):
        return [{"id": row.id, "code": row.code, "name": row.name, "capital": row.capital, "status": row.status} for row in rows]
    allowed = {scope.region_id for scope in principal.scopes if scope.scope_type == "REGION" and scope.region_id}
    allowed.update(
        db.execute(select(Department.region_id).where(Department.id.in_([scope.department_id for scope in principal.scopes if scope.department_id]))).scalars().all()
    )
    return [{"id": row.id, "code": row.code, "name": row.name, "capital": row.capital, "status": row.status} for row in rows if row.id in allowed]


@router.get("/school-map/departments")
def list_departments(region_id: int | None = None, principal: CurrentPrincipal = Depends(require_permission("student:read")), db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(Department).order_by(Department.name)
    if region_id:
        stmt = stmt.where(Department.region_id == region_id)
    rows = db.execute(stmt).scalars().all()
    return [{"id": row.id, "region_id": row.region_id, "code": row.code, "name": row.name, "capital": row.capital, "status": row.status} for row in rows if _department_allowed(db, principal, row.id)]


@router.get("/school-map/subdivisions")
def list_subdivisions(department_id: int | None = None, principal: CurrentPrincipal = Depends(require_permission("student:read")), db: Session = Depends(get_db)) -> list[dict]:
    stmt = select(Subdivision).order_by(Subdivision.name)
    if department_id:
        stmt = stmt.where(Subdivision.department_id == department_id)
    rows = db.execute(stmt).scalars().all()
    return [{"id": row.id, "department_id": row.department_id, "code": row.code, "name": row.name, "capital": row.capital, "status": row.status} for row in rows if _subdivision_allowed(db, principal, row.id)]


@router.get("/school-map/schools")
@router.get("/schools")
def list_schools(
    search: str | None = None,
    principal: CurrentPrincipal = Depends(require_permission("student:read")),
    db: Session = Depends(get_db),
) -> list[dict]:
    rows = _school_map_rows(db, principal)
    if search:
        needle = search.casefold()
        rows = [row for row in rows if needle in f"{row['school']} {row['subdivision']} {row['school_type']}".casefold()]
    return rows[:100]


@router.get("/school-map/school-years")
@router.get("/academic-years")
def list_school_years(_: CurrentPrincipal = Depends(require_permission("student:read")), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.execute(select(SchoolYear).order_by(SchoolYear.code.desc())).scalars().all()
    return [{"id": row.id, "code": row.code, "starts_on": str(row.starts_on), "ends_on": str(row.ends_on), "status": row.status} for row in rows]


@router.get("/school-map/grade-levels")
@router.get("/academic-levels")
def list_grade_levels(_: CurrentPrincipal = Depends(require_permission("student:read")), db: Session = Depends(get_db)) -> list[dict]:
    rows = db.execute(select(GradeLevel).order_by(GradeLevel.sort_order)).scalars().all()
    return [{"id": row.id, "code": row.code, "label": row.label, "education_subsystem": row.education_subsystem, "cycle": row.cycle, "sort_order": row.sort_order, "active": row.is_active} for row in rows]


@router.patch("/academic-levels/{level_id}", dependencies=[Depends(require_csrf)])
def update_grade_level(level_id: int, payload: GradeLevelUpdateRequest, principal: CurrentPrincipal = Depends(require_permission("settings:update")), db: Session = Depends(get_db)):
    row = db.get(GradeLevel, level_id)
    if not row:
        raise HTTPException(status_code=404, detail="Academic level not found")
    if not payload.active and db.execute(select(func.count()).select_from(Classroom).where(Classroom.grade_level_id == level_id)).scalar_one():
        raise HTTPException(status_code=409, detail="Academic level is used by active classes")
    row.is_active = payload.active
    db.commit()
    return {"id": row.id, "active": row.is_active}


@router.get("/school-map/classrooms")
@router.get("/classes")
def list_classrooms(
    school_id: int | None = None,
    academic_year_id: int | None = None,
    search: str | None = None,
    with_capacity: bool = False,
    principal: CurrentPrincipal = Depends(require_permission("student:read")),
    db: Session = Depends(get_db),
) -> list[dict]:
    stmt = select(Classroom, GradeLevel).join(GradeLevel, Classroom.grade_level_id == GradeLevel.id).order_by(Classroom.code)
    if school_id:
        assert_school_scope(db, principal, school_id)
        stmt = stmt.where(Classroom.school_id == school_id)
    if academic_year_id:
        stmt = stmt.where(Classroom.school_year_id == academic_year_id)
    if search:
        stmt = stmt.where(or_(Classroom.code.like(f"%{search}%"), Classroom.label.like(f"%{search}%")))
    rows = db.execute(stmt).all()
    result = []
    for row, grade in rows:
        try:
            assert_school_scope(db, principal, row.school_id)
        except HTTPException:
            continue
        enrolled = db.execute(
            select(func.count()).select_from(Enrollment).where(Enrollment.classroom_id == row.id, Enrollment.status == "ACTIVE")
        ).scalar_one() if with_capacity else 0
        result.append({
            "id": row.id,
            "school_id": row.school_id,
            "school_year_id": row.school_year_id,
            "grade_level_id": row.grade_level_id,
            "grade_level": grade.label,
            "code": row.code,
            "label": row.label,
            "capacity": row.capacity,
            "remaining_capacity": max((row.capacity or 0) - int(enrolled), 0) if row.capacity is not None else None,
            "status": row.status,
        })
    return result


@router.post("/school-map/regions", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_csrf)])
def create_region(payload: RegionCreateRequest, principal: CurrentPrincipal = Depends(require_permission("settings:update")), db: Session = Depends(get_db)) -> dict:
    if not any(scope.scope_type == "NATIONAL" for scope in principal.scopes):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="National scope required")
    row = Region(code=payload.code, name=payload.name, capital=payload.capital, status="PENDING_VALIDATION" if payload.submit_for_validation else "ACTIVE", is_demo=True)
    db.add(row)
    db.flush()
    if payload.submit_for_validation:
        _queue_validation(db, principal, "REGION", row.id, row.name, payload.justification)
    record_security_event(db, "REGION_CREATED", "MEDIUM", principal.user.id, "region", payload.code)
    db.commit()
    return {"id": row.id, "code": row.code, "name": row.name, "capital": row.capital}


@router.post("/school-map/departments", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_csrf)])
def create_department(payload: DepartmentCreateRequest, principal: CurrentPrincipal = Depends(require_permission("settings:update")), db: Session = Depends(get_db)) -> dict:
    if not any(scope.scope_type == "NATIONAL" or (scope.scope_type == "REGION" and scope.region_id == payload.region_id) for scope in principal.scopes):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Region outside assigned scope")
    row = Department(region_id=payload.region_id, code=payload.code, name=payload.name, capital=payload.capital, status="PENDING_VALIDATION" if payload.submit_for_validation else "ACTIVE", is_demo=True)
    db.add(row)
    db.flush()
    if payload.submit_for_validation:
        _queue_validation(db, principal, "DEPARTMENT", row.id, row.name, payload.justification)
    record_security_event(db, "DEPARTMENT_CREATED", "MEDIUM", principal.user.id, "department", payload.code)
    db.commit()
    return {"id": row.id, "region_id": row.region_id, "code": row.code, "name": row.name, "capital": row.capital}


@router.post("/school-map/subdivisions", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_csrf)])
def create_subdivision(payload: SubdivisionCreateRequest, principal: CurrentPrincipal = Depends(require_permission("settings:update")), db: Session = Depends(get_db)) -> dict:
    if not _department_allowed(db, principal, payload.department_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Department outside assigned scope")
    row = Subdivision(department_id=payload.department_id, code=payload.code, name=payload.name, capital=payload.capital, status="PENDING_VALIDATION" if payload.submit_for_validation else "ACTIVE", is_demo=True)
    db.add(row)
    db.flush()
    if payload.submit_for_validation:
        _queue_validation(db, principal, "SUBDIVISION", row.id, row.name, payload.justification)
    record_security_event(db, "SUBDIVISION_CREATED", "MEDIUM", principal.user.id, "subdivision", payload.code)
    db.commit()
    return {"id": row.id, "department_id": row.department_id, "code": row.code, "name": row.name, "capital": row.capital}


@router.post("/school-map/schools", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_csrf)])
def create_school(payload: SchoolCreateRequest, principal: CurrentPrincipal = Depends(require_permission("settings:update")), db: Session = Depends(get_db)) -> dict:
    if not _subdivision_allowed(db, principal, payload.subdivision_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Subdivision outside assigned scope")
    row = School(public_id=str(uuid4()), subdivision_id=payload.subdivision_id, code=payload.code, name=payload.name, school_type=payload.school_type, education_subsystem=payload.education_subsystem, status="PENDING_VALIDATION" if payload.submit_for_validation else payload.status, is_demo=True)
    db.add(row)
    db.flush()
    if payload.submit_for_validation:
        _queue_validation(db, principal, "SCHOOL", row.id, row.name, payload.justification)
    record_security_event(db, "SCHOOL_CREATED", "HIGH", principal.user.id, "school", payload.code)
    db.commit()
    return {"id": row.id, "public_id": row.public_id, "subdivision_id": row.subdivision_id, "code": row.code, "name": row.name, "status": row.status}


@router.post("/school-map/classrooms", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_csrf)])
def create_classroom(payload: ClassroomCreateRequest, principal: CurrentPrincipal = Depends(require_permission("settings:update")), db: Session = Depends(get_db)) -> dict:
    assert_school_scope(db, principal, payload.school_id)
    row = Classroom(school_id=payload.school_id, school_year_id=payload.school_year_id, grade_level_id=payload.grade_level_id, code=payload.code, label=payload.label, capacity=payload.capacity, status="PENDING_VALIDATION" if payload.submit_for_validation else "ACTIVE", is_demo=True)
    db.add(row)
    db.flush()
    if payload.submit_for_validation:
        _queue_validation(db, principal, "CLASSROOM", row.id, row.label, payload.justification)
    record_security_event(db, "CLASSROOM_CREATED", "MEDIUM", principal.user.id, "classroom", payload.code)
    db.commit()
    return {"id": row.id, "school_id": row.school_id, "school_year_id": row.school_year_id, "grade_level_id": row.grade_level_id, "code": row.code, "label": row.label}


@router.post("/school-map/school-years", status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_csrf)])
def create_school_year(payload: SchoolYearCreateRequest, principal: CurrentPrincipal = Depends(require_permission("settings:update")), db: Session = Depends(get_db)) -> dict:
    if not any(scope.scope_type == "NATIONAL" for scope in principal.scopes):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="National scope required")
    row = SchoolYear(code=payload.code, starts_on=payload.starts_on, ends_on=payload.ends_on, status=payload.status)
    db.add(row)
    record_security_event(db, "SCHOOL_YEAR_CREATED", "MEDIUM", principal.user.id, "school_year", payload.code)
    db.commit()
    return {"id": row.id, "code": row.code, "starts_on": str(row.starts_on), "ends_on": str(row.ends_on), "status": row.status}


@router.get("/admin/pending-validations")
def pending_validations(principal: CurrentPrincipal = Depends(require_permission("settings:update")), db: Session = Depends(get_db)):
    rows = db.execute(select(AdministrativeValidation).where(AdministrativeValidation.status == "PENDING_VALIDATION").order_by(AdministrativeValidation.created_at)).scalars()
    return [{"id": row.id, "entity_type": row.entity_type, "entity_id": row.entity_id, "entity_label": row.entity_label, "status": row.status, "justification": row.justification, "proposed_by": row.proposed_by, "created_at": row.created_at} for row in rows]


def _apply_validation_status(db: Session, row: AdministrativeValidation, approved: bool) -> None:
    entity_models = {
        "REGION": Region,
        "DEPARTMENT": Department,
        "SUBDIVISION": Subdivision,
        "SCHOOL": School,
        "CLASSROOM": Classroom,
    }
    model = entity_models.get(row.entity_type)
    if model:
        entity = db.get(model, row.entity_id)
        if entity:
            entity.status = "ACTIVE" if approved else "REJECTED"


@router.post("/admin/validations/{validation_id}/approve", dependencies=[Depends(require_csrf)])
def approve_validation(validation_id: int, payload: ValidationDecisionRequest, principal: CurrentPrincipal = Depends(require_permission("settings:update")), db: Session = Depends(get_db)):
    row = db.get(AdministrativeValidation, validation_id)
    if not row or row.status != "PENDING_VALIDATION":
        raise HTTPException(status_code=404, detail="Pending validation not found")
    row.status, row.review_comment, row.reviewed_by, row.reviewed_at = "APPROVED", payload.comment, principal.user.id, datetime.utcnow()
    _apply_validation_status(db, row, True)
    db.commit()
    return {"id": row.id, "status": row.status}


@router.post("/admin/validations/{validation_id}/reject", dependencies=[Depends(require_csrf)])
def reject_validation(validation_id: int, payload: ValidationRejectRequest, principal: CurrentPrincipal = Depends(require_permission("settings:update")), db: Session = Depends(get_db)):
    row = db.get(AdministrativeValidation, validation_id)
    if not row or row.status != "PENDING_VALIDATION":
        raise HTTPException(status_code=404, detail="Pending validation not found")
    row.status, row.review_comment, row.reviewed_by, row.reviewed_at = "REJECTED", payload.reason, principal.user.id, datetime.utcnow()
    _apply_validation_status(db, row, False)
    db.commit()
    return {"id": row.id, "status": row.status}

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import asc, desc, or_, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import (
    CurrentPrincipal,
    assert_school_scope,
    assert_student_scope,
    get_current_principal,
    require_csrf,
    require_permission,
)
from app.core.database import get_db
from app.models.entities import Enrollment, Student, StudentStatusHistory, Transfer
from app.schemas.students import (
    DuplicateCandidate,
    EnrollmentCreateRequest,
    StudentCreateRequest,
    StudentListResponse,
    StudentResponse,
    StudentUpdateRequest,
    TransferCreateRequest,
)
from app.services.security_events import record_security_event
from app.services.student_service import (
    archive_student,
    create_student,
    duplicate_candidates,
    enroll_student,
    student_to_dict,
    transfer_student,
    update_student,
)


router = APIRouter(tags=["students"])


def _student_response(student: Student) -> StudentResponse:
    return StudentResponse(**student_to_dict(student))


def _query_in_scope(db: Session, principal: CurrentPrincipal, rows: list[Student]) -> list[Student]:
    allowed: list[Student] = []
    for student in rows:
        if student.current_school_id is None:
            continue
        try:
            assert_school_scope(db, principal, student.current_school_id)
            allowed.append(student)
        except HTTPException:
            continue
    return allowed


@router.get("/students", response_model=StudentListResponse)
def list_students(
    q: str | None = None,
    status_value: str | None = Query(default=None, alias="status"),
    school_id: int | None = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort: Literal["last_name", "first_name", "student_number", "created_at"] = "last_name",
    direction: Literal["asc", "desc"] = "asc",
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:read")),
) -> StudentListResponse:
    stmt = select(Student)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Student.last_name.like(like), Student.first_name.like(like), Student.student_number.like(like)))
    if status_value:
        stmt = stmt.where(Student.status == status_value)
    if school_id:
        assert_school_scope(db, principal, school_id)
        stmt = stmt.where(Student.current_school_id == school_id)
    order_column = getattr(Student, sort)
    stmt = stmt.order_by(desc(order_column) if direction == "desc" else asc(order_column)).limit(500)
    scoped = _query_in_scope(db, principal, list(db.execute(stmt).scalars()))
    start = (page - 1) * page_size
    rows = scoped[start : start + page_size]
    record_security_event(db, "STUDENT_LIST_VIEWED", "INFO", principal.user.id, "student")
    db.commit()
    return StudentListResponse(items=[_student_response(row) for row in rows], total=len(scoped), page=page, page_size=page_size)


@router.post("/students", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def create_student_endpoint(
    payload: StudentCreateRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:create")),
    _: None = Depends(require_csrf),
) -> StudentResponse:
    return _student_response(create_student(db, payload, principal))


@router.get("/students/{student_id}", response_model=StudentResponse)
def get_student(
    student_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:read")),
) -> StudentResponse:
    assert_student_scope(db, principal, student_id)
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    record_security_event(db, "STUDENT_VIEWED", "INFO", principal.user.id, "student", student.public_id)
    db.commit()
    return _student_response(student)


@router.patch("/students/{student_id}", response_model=StudentResponse)
def update_student_endpoint(
    student_id: int,
    payload: StudentUpdateRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:update")),
    _: None = Depends(require_csrf),
) -> StudentResponse:
    return _student_response(update_student(db, student_id, payload, principal))


@router.post("/students/{student_id}/archive", response_model=StudentResponse)
def archive_student_endpoint(
    student_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:archive")),
    _: None = Depends(require_csrf),
) -> StudentResponse:
    return _student_response(archive_student(db, student_id, principal))


@router.get("/students/{student_id}/history")
def student_history(
    student_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:read")),
):
    assert_student_scope(db, principal, student_id)
    student = db.get(Student, student_id)
    rows = db.execute(select(StudentStatusHistory).where(StudentStatusHistory.student_id == student_id).order_by(StudentStatusHistory.changed_at)).scalars()
    record_security_event(db, "STUDENT_HISTORY_VIEWED", "INFO", principal.user.id, "student", student.public_id if student else None)
    db.commit()
    return [
        {
            "previous_status": row.previous_status,
            "new_status": row.new_status,
            "reason": row.reason,
            "changed_at": row.changed_at,
            "changed_by": row.changed_by,
        }
        for row in rows
    ]


@router.get("/students/{student_id}/duplicate-candidates", response_model=list[DuplicateCandidate])
def duplicate_candidates_endpoint(
    student_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:read")),
) -> list[DuplicateCandidate]:
    assert_student_scope(db, principal, student_id)
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    record_security_event(db, "STUDENT_DUPLICATES_VIEWED", "INFO", principal.user.id, "student", student.public_id)
    db.commit()
    return [DuplicateCandidate(**row) for row in duplicate_candidates(db, student)]


@router.get("/students/{student_id}/export")
def export_student(
    student_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:export")),
):
    assert_student_scope(db, principal, student_id)
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    record_security_event(db, "STUDENT_EXPORT_CREATED", "HIGH", principal.user.id, "student", student.public_id)
    db.commit()
    return {"export_type": "INDIVIDUAL_STUDENT", "student": student_to_dict(student), "demo_only": True}


@router.post("/enrollments", status_code=status.HTTP_201_CREATED)
def create_enrollment(
    payload: EnrollmentCreateRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:update")),
    _: None = Depends(require_csrf),
):
    enrollment = enroll_student(db, payload.student_id, payload.school_id, payload.classroom_id, payload.school_year_id, payload.status, principal)
    return {
        "id": enrollment.id,
        "student_id": enrollment.student_id,
        "school_id": enrollment.school_id,
        "classroom_id": enrollment.classroom_id,
        "school_year_id": enrollment.school_year_id,
        "status": enrollment.status,
    }


@router.post("/transfers", status_code=status.HTTP_201_CREATED)
def create_transfer(
    payload: TransferCreateRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:update")),
    _: None = Depends(require_csrf),
):
    transfer = transfer_student(db, payload.student_id, payload.to_school_id, payload.to_classroom_id, payload.comment, principal)
    return {
        "id": transfer.id,
        "student_id": transfer.student_id,
        "from_school_id": transfer.from_school_id,
        "to_school_id": transfer.to_school_id,
        "from_classroom_id": transfer.from_classroom_id,
        "to_classroom_id": transfer.to_classroom_id,
        "status": transfer.status,
    }

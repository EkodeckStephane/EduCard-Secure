from typing import Literal

from datetime import date
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import asc, desc, func, or_, select
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
from app.models.entities import Card, Classroom, Enrollment, School, SchoolYear, ServiceEntitlement, Student, StudentGuardian, StudentStatusHistory, Transfer
from app.schemas.students import (
    DuplicateCandidate,
    DuplicateDecisionRequest,
    EnrollmentWithdrawRequest,
    EnrollmentCreateRequest,
    StudentArchiveRequest,
    StudentCreateRequest,
    StudentListResponse,
    StudentResponse,
    StudentUpdateRequest,
    StudentReenrollRequest,
    TransferCreateRequest,
)
from app.services.security_events import record_security_event
from app.services.dashboard_service import allowed_school_ids
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
PHOTO_ROOT = Path(__file__).resolve().parents[3] / "storage" / "student_photos"


def _student_response(student: Student) -> StudentResponse:
    return StudentResponse(**student_to_dict(student))


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
    scoped_school_ids = allowed_school_ids(db, principal, school_id=school_id)
    if not scoped_school_ids:
        return StudentListResponse(items=[], total=0, page=page, page_size=page_size)

    filters = [Student.current_school_id.in_(scoped_school_ids)]
    if q:
        like = f"%{q}%"
        filters.append(or_(Student.last_name.like(like), Student.first_name.like(like), Student.student_number.like(like)))
    if status_value:
        filters.append(Student.status == status_value)

    total = int(db.execute(select(func.count()).select_from(Student).where(*filters)).scalar_one() or 0)
    order_column = getattr(Student, sort)
    rows = list(
        db.execute(
            select(Student)
            .where(*filters)
            .order_by(desc(order_column) if direction == "desc" else asc(order_column), Student.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).scalars()
    )
    record_security_event(db, "STUDENT_LIST_VIEWED", "INFO", principal.user.id, "student")
    db.commit()
    return StudentListResponse(items=[_student_response(row) for row in rows], total=total, page=page, page_size=page_size)


@router.get("/students/duplicates", response_model=list[DuplicateCandidate])
def find_duplicates_before_creation(
    last_name: str = Query(min_length=2, max_length=120),
    first_name: str = Query(min_length=2, max_length=120),
    birth_date: date = Query(),
    school_id: int | None = None,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:read")),
) -> list[DuplicateCandidate]:
    probe = Student(
        public_id="probe",
        student_number="probe",
        last_name=last_name,
        first_name=first_name,
        birth_date=birth_date,
        status="ACTIVE",
        current_school_id=school_id,
        record_version=1,
        is_demo=True,
    )
    rows = duplicate_candidates(db, probe)
    allowed = []
    for row in rows:
        try:
            assert_student_scope(db, principal, row["student_id"])
            allowed.append(DuplicateCandidate(**row))
        except HTTPException:
            continue
    return allowed


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
    payload = student_to_dict(student)
    enrollment = db.execute(select(Enrollment).where(Enrollment.student_id == student_id).order_by(Enrollment.enrolled_at.desc())).scalars().first()
    school = db.get(School, enrollment.school_id) if enrollment else None
    classroom = db.get(Classroom, enrollment.classroom_id) if enrollment else None
    year = db.get(SchoolYear, enrollment.school_year_id) if enrollment else None
    card = db.execute(select(Card).where(Card.student_id == student_id).order_by((Card.status == "ACTIVE").desc(), Card.created_at.desc())).scalars().first()
    guardian = db.execute(select(StudentGuardian).where(StudentGuardian.student_id == student_id).order_by(StudentGuardian.is_primary.desc())).scalars().first()
    service_count = int(db.execute(select(func.count()).select_from(ServiceEntitlement).where(ServiceEntitlement.student_id == student_id, ServiceEntitlement.status == "ACTIVE")).scalar_one() or 0)
    last_status = db.execute(select(StudentStatusHistory).where(StudentStatusHistory.student_id == student_id).order_by(StudentStatusHistory.changed_at.desc())).scalars().first()
    payload.update({
        "photo_url": f"/api/v1/students/{student.id}/photo",
        "current_enrollment": {
            "id": enrollment.id, "status": enrollment.status, "enrolled_at": enrollment.enrolled_at,
            "school_id": enrollment.school_id, "school_name": school.name if school else None,
            "classroom_id": enrollment.classroom_id, "classroom_label": classroom.label if classroom else None,
            "school_year_id": enrollment.school_year_id, "school_year": year.code if year else None,
        } if enrollment else None,
        "active_card_status": card.status if card else None,
        "active_services_count": service_count,
        "last_activity": {"type": "STATUS", "date": last_status.changed_at, "detail": last_status.reason} if last_status else None,
        "guardian": {"display_name": guardian.display_name, "contact_masked": guardian.contact_masked, "relationship": guardian.relationship} if guardian else None,
    })
    return StudentResponse(**payload)


@router.post("/students/{student_id}/photo")
async def upload_student_photo(
    student_id: int,
    photo: UploadFile = File(),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:update")),
    _: None = Depends(require_csrf),
) -> dict:
    assert_student_scope(db, principal, student_id)
    if photo.content_type not in {"image/jpeg", "image/png"}:
        raise HTTPException(status_code=415, detail="Only JPEG and PNG photos are accepted")
    content = await photo.read(5 * 1024 * 1024 + 1)
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Photo exceeds 5 MB")
    extension = ".jpg" if photo.content_type == "image/jpeg" else ".png"
    PHOTO_ROOT.mkdir(parents=True, exist_ok=True)
    for existing in PHOTO_ROOT.glob(f"{student_id}.*"):
        existing.unlink()
    target = PHOTO_ROOT / f"{student_id}{extension}"
    target.write_bytes(content)
    record_security_event(db, "STUDENT_PHOTO_UPDATED", "MEDIUM", principal.user.id, "student", str(student_id))
    db.commit()
    return {"status": "stored"}


@router.get("/students/{student_id}/photo")
def get_student_photo(
    student_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:read")),
) -> Response:
    assert_student_scope(db, principal, student_id)
    matches = list(PHOTO_ROOT.glob(f"{student_id}.*"))
    if not matches:
        raise HTTPException(status_code=404, detail="Photo not found")
    target = matches[0]
    media_type = "image/jpeg" if target.suffix == ".jpg" else "image/png"
    return Response(content=target.read_bytes(), media_type=media_type, headers={"Cache-Control": "private, max-age=300"})


@router.post("/students/duplicates/{candidate_id}/confirm")
def confirm_duplicate(
    candidate_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:create")),
    _: None = Depends(require_csrf),
) -> dict:
    assert_student_scope(db, principal, candidate_id)
    record_security_event(db, "STUDENT_DUPLICATE_CONFIRMED", "MEDIUM", principal.user.id, "student", str(candidate_id))
    db.commit()
    return {"status": "confirmed", "student_id": candidate_id}


@router.post("/students/duplicates/{candidate_id}/reject")
def reject_duplicate(
    candidate_id: int,
    payload: DuplicateDecisionRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:create")),
    _: None = Depends(require_csrf),
) -> dict:
    assert_student_scope(db, principal, candidate_id)
    assert_student_scope(db, principal, payload.reference_student_id)
    record_security_event(db, "STUDENT_DUPLICATE_REJECTED", "MEDIUM", principal.user.id, "student", str(candidate_id), payload.reason)
    db.commit()
    return {"status": "rejected", "student_id": candidate_id}


@router.post("/students/duplicates/{candidate_id}/flag-for-merge")
def flag_duplicate_for_merge(
    candidate_id: int,
    payload: DuplicateDecisionRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:update")),
    _: None = Depends(require_csrf),
) -> dict:
    assert_student_scope(db, principal, candidate_id)
    assert_student_scope(db, principal, payload.reference_student_id)
    record_security_event(
        db,
        "STUDENT_DUPLICATE_MERGE_REVIEW_REQUESTED",
        "HIGH",
        principal.user.id,
        "student",
        str(payload.reference_student_id),
        f"candidate={candidate_id}; reason={payload.reason}",
    )
    db.commit()
    return {"status": "PENDING_MERGE_REVIEW", "student_id": candidate_id}


@router.patch("/students/{student_id}", response_model=StudentResponse)
def update_student_endpoint(
    student_id: int,
    payload: StudentUpdateRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:update")),
    _: None = Depends(require_csrf),
) -> StudentResponse:
    return _student_response(update_student(db, student_id, payload, principal))


@router.patch("/students/{student_id}/archive", response_model=StudentResponse)
def archive_student_endpoint(
    student_id: int,
    payload: StudentArchiveRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:archive")),
    _: None = Depends(require_csrf),
) -> StudentResponse:
    return _student_response(archive_student(db, student_id, payload, principal))


@router.post("/students/{student_id}/archive", response_model=StudentResponse, deprecated=True)
def archive_student_legacy_endpoint(
    student_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:archive")),
    _: None = Depends(require_csrf),
) -> StudentResponse:
    """Backward-compatible endpoint; new clients must use PATCH with a structured reason."""
    assert_student_scope(db, principal, student_id)
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    payload = StudentArchiveRequest(
        reason_code="ADMINISTRATIVE_DECISION",
        reason_text="Legacy API archive request",
        record_version=student.record_version,
    )
    return _student_response(archive_student(db, student_id, payload, principal))


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
    transfer = transfer_student(
        db,
        payload.student_id,
        payload.to_school_id,
        payload.to_classroom_id,
        payload.comment,
        principal,
        payload.expected_from_school_id,
    )
    return {
        "id": transfer.id,
        "student_id": transfer.student_id,
        "from_school_id": transfer.from_school_id,
        "to_school_id": transfer.to_school_id,
        "from_classroom_id": transfer.from_classroom_id,
        "to_classroom_id": transfer.to_classroom_id,
        "status": transfer.status,
    }


@router.post("/enrollments/{enrollment_id}/withdraw")
def withdraw_enrollment(
    enrollment_id: int,
    payload: EnrollmentWithdrawRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:update")),
    _: None = Depends(require_csrf),
) -> dict:
    enrollment = db.get(Enrollment, enrollment_id)
    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    assert_student_scope(db, principal, enrollment.student_id)
    student = db.get(Student, enrollment.student_id)
    previous = student.status
    target_status = "GRADUATED" if payload.exit_type in {"GRADUATED", "HIGHER_EDUCATION"} else "WITHDRAWN"
    enrollment.status = target_status
    student.status = target_status
    student.record_version += 1
    db.add(StudentStatusHistory(
        student_id=student.id,
        previous_status=previous,
        new_status=target_status,
        reason=f"{payload.exit_type}: {payload.reason}"[:255],
        changed_by=principal.user.id,
    ))
    record_security_event(db, "STUDENT_WITHDRAWN", "HIGH", principal.user.id, "student", student.public_id, payload.reason)
    db.commit()
    return {"status": target_status, "student_id": student.id, "exit_date": payload.exit_date}


@router.post("/students/{student_id}/reenroll")
def reenroll_student(
    student_id: int,
    payload: StudentReenrollRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("student:update")),
    _: None = Depends(require_csrf),
) -> dict:
    assert_student_scope(db, principal, student_id)
    assert_school_scope(db, principal, payload.school_id)
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    enrollment = enroll_student(
        db,
        student_id,
        payload.school_id,
        payload.class_id,
        payload.academic_year_id,
        "ACTIVE",
        principal,
    )
    student = db.get(Student, student_id)
    previous = student.status
    student.status = "ACTIVE"
    db.add(StudentStatusHistory(
        student_id=student.id,
        previous_status=previous,
        new_status="ACTIVE",
        reason=f"REENROLLED: {payload.reason}"[:255],
        changed_by=principal.user.id,
    ))
    db.commit()
    return {"id": enrollment.id, "status": "ACTIVE", "entry_date": payload.entry_date}

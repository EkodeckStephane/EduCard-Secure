from datetime import date

from typing import Literal

from pydantic import BaseModel, Field, model_validator


class StudentCreateRequest(BaseModel):
    last_name: str = Field(min_length=1, max_length=120)
    first_name: str = Field(min_length=1, max_length=120)
    birth_date: date
    school_id: int
    classroom_id: int | None = None
    gender: str | None = Field(default=None, max_length=40)
    guardian_display_name: str | None = Field(default=None, max_length=160)
    guardian_contact_masked: str | None = Field(default=None, max_length=120)


class StudentUpdateRequest(BaseModel):
    last_name: str | None = Field(default=None, min_length=1, max_length=120)
    first_name: str | None = Field(default=None, min_length=1, max_length=120)
    classroom_id: int | None = None
    status: str | None = Field(default=None, max_length=40)
    record_version: int


class StudentArchiveRequest(BaseModel):
    reason_code: Literal[
        "ADMINISTRATIVE_DECISION",
        "PROLONGED_ABSENCE",
        "DUPLICATE_RESOLVED",
        "GRADUATION",
        "OTHER",
    ]
    reason_text: str | None = Field(default=None, max_length=1000)
    record_version: int = Field(ge=1)

    @model_validator(mode="after")
    def validate_reason(self):
        if self.reason_code == "OTHER" and len((self.reason_text or "").strip()) < 10:
            raise ValueError("reason_text must contain at least 10 characters for OTHER")
        return self


class DuplicateDecisionRequest(BaseModel):
    reference_student_id: int
    reason: str = Field(min_length=10, max_length=1000)


class EnrollmentWithdrawRequest(BaseModel):
    exit_type: Literal["GRADUATED", "WITHDRAWN", "HIGHER_EDUCATION", "DECEASED", "OTHER"]
    exit_date: date
    reason: str = Field(min_length=10, max_length=1000)


class StudentReenrollRequest(BaseModel):
    school_id: int
    class_id: int
    academic_year_id: int
    entry_date: date
    reason: str = Field(min_length=10, max_length=1000)


class StudentResponse(BaseModel):
    id: int
    public_id: str
    student_number: str
    last_name: str
    first_name: str
    birth_date: date
    gender: str | None = None
    status: str
    current_school_id: int | None
    current_classroom_id: int | None
    record_version: int
    photo_url: str | None = None
    current_enrollment: dict | None = None
    active_card_status: str | None = None
    active_services_count: int = 0
    last_activity: dict | None = None
    guardian: dict | None = None


class StudentListResponse(BaseModel):
    items: list[StudentResponse]
    total: int
    page: int
    page_size: int


class EnrollmentCreateRequest(BaseModel):
    student_id: int
    school_id: int
    classroom_id: int
    school_year_id: int
    status: str = "ACTIVE"


class TransferCreateRequest(BaseModel):
    student_id: int
    expected_from_school_id: int | None = None
    to_school_id: int
    to_classroom_id: int | None = None
    comment: str | None = Field(default=None, max_length=255)


class DuplicateCandidate(BaseModel):
    student_id: int
    student_number: str
    full_name: str
    score: int
    reasons: list[str]

from datetime import date

from pydantic import BaseModel, Field


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


class StudentResponse(BaseModel):
    id: int
    public_id: str
    student_number: str
    last_name: str
    first_name: str
    birth_date: date
    status: str
    current_school_id: int | None
    current_classroom_id: int | None
    record_version: int


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
    to_school_id: int
    to_classroom_id: int | None = None
    comment: str | None = Field(default=None, max_length=255)


class DuplicateCandidate(BaseModel):
    student_id: int
    student_number: str
    full_name: str
    score: int
    reasons: list[str]

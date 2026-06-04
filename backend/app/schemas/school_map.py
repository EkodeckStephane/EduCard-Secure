from datetime import date

from pydantic import BaseModel, Field


class RegionCreateRequest(BaseModel):
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=160)
    capital: str | None = Field(default=None, max_length=160)


class DepartmentCreateRequest(BaseModel):
    region_id: int
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=160)
    capital: str | None = Field(default=None, max_length=160)


class SubdivisionCreateRequest(BaseModel):
    department_id: int
    code: str = Field(min_length=2, max_length=40)
    name: str = Field(min_length=2, max_length=160)
    capital: str | None = Field(default=None, max_length=160)


class SchoolCreateRequest(BaseModel):
    subdivision_id: int
    code: str = Field(min_length=2, max_length=60)
    name: str = Field(min_length=2, max_length=180)
    school_type: str = Field(default="GENERAL", max_length=80)
    education_subsystem: str = Field(default="DEMO", max_length=80)
    status: str = Field(default="ACTIVE", max_length=40)


class ClassroomCreateRequest(BaseModel):
    school_id: int
    school_year_id: int
    grade_level_id: int
    code: str = Field(min_length=1, max_length=60)
    label: str = Field(min_length=2, max_length=120)
    capacity: int | None = Field(default=None, ge=0)


class SchoolYearCreateRequest(BaseModel):
    code: str = Field(min_length=4, max_length=40)
    starts_on: date
    ends_on: date
    status: str = Field(default="PLANNED", max_length=40)

from datetime import date

from pydantic import BaseModel, Field


class DashboardFilters(BaseModel):
    start_date: date | None = None
    end_date: date | None = None
    region_id: int | None = None
    department_id: int | None = None
    school_id: int | None = None
    school_year_id: int | None = None
    classroom_id: int | None = None
    grade_level_id: int | None = None
    status: str | None = None
    service_type_id: int | None = None
    severity: str | None = None


class ExportCreateRequest(BaseModel):
    export_type: str = Field(pattern="^(DASHBOARD_SUMMARY|DASHBOARD_CARDS|DASHBOARD_ATTENDANCE|DASHBOARD_PAYMENTS|DASHBOARD_SECURITY|DASHBOARD_SERVICES|INDIVIDUAL_STUDENT)$")
    format: str = Field(default="CSV", pattern="^CSV$")
    reason: str = Field(min_length=8, max_length=255)
    filters: DashboardFilters = Field(default_factory=DashboardFilters)
    student_id: int | None = None


class ExportResponse(BaseModel):
    id: int
    public_id: str
    export_type: str
    status: str
    created_at: str
    expires_at: str | None
    filename: str

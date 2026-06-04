from pydantic import BaseModel, Field


class AuditCreateRequest(BaseModel):
    action: str = Field(max_length=120)
    resource_type: str = Field(max_length=80)
    resource_public_id: str | None = Field(default=None, max_length=80)
    result: str = Field(default="SUCCESS", max_length=40)
    justification: str | None = Field(default=None, max_length=255)
    severity: str = Field(default="INFO", max_length=40)


class IncidentCreateRequest(BaseModel):
    category: str = Field(max_length=80)
    priority: str = Field(default="MEDIUM", max_length=40)
    severity: str = Field(default="MEDIUM", max_length=40)
    comment: str | None = Field(default=None, max_length=255)


class IncidentUpdateRequest(BaseModel):
    status: str | None = Field(default=None, max_length=40)
    priority: str | None = Field(default=None, max_length=40)
    severity: str | None = Field(default=None, max_length=40)
    assigned_to: int | None = None
    comment: str | None = Field(default=None, max_length=255)


class PrivacyRequestCreate(BaseModel):
    request_type: str = Field(max_length=80)
    subject_type: str = Field(max_length=80)
    student_id: int | None = None


class ProcessingRegisterCreate(BaseModel):
    processing_name: str = Field(max_length=160)
    purpose: str = Field(max_length=1000)
    data_categories: str = Field(max_length=1000)
    legal_basis_note: str | None = Field(default=None, max_length=1000)
    retention_note: str | None = Field(default=None, max_length=1000)


class RetentionRuleCreate(BaseModel):
    resource_type: str = Field(max_length=80)
    retention_period_days: int | None = Field(default=None, ge=1)
    action_on_expiry: str = Field(default="REVIEW", max_length=80)
    status: str = Field(default="DRAFT_LEGAL_REVIEW", max_length=40)

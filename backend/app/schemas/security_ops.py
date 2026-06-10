from pydantic import BaseModel, Field


class AuditCreateRequest(BaseModel):
    action: str = Field(max_length=120)
    resource_type: str = Field(max_length=80)
    resource_public_id: str | None = Field(default=None, max_length=80)
    result: str = Field(default="SUCCESS", max_length=40)
    justification: str | None = Field(default=None, max_length=255)
    severity: str = Field(default="INFO", max_length=40)


class IncidentCreateRequest(BaseModel):
    title: str | None = Field(default=None, max_length=120)
    category: str = Field(max_length=80)
    priority: str = Field(default="MEDIUM", max_length=40)
    severity: str = Field(default="MEDIUM", max_length=40)
    description: str | None = Field(default=None, max_length=2000)
    resource_type: str | None = Field(default=None, max_length=80)
    resource_public_id: str | None = Field(default=None, max_length=80)
    assigned_to: int | None = None
    occurred_at: str | None = None
    comment: str | None = Field(default=None, max_length=1000)


class IncidentUpdateRequest(BaseModel):
    status: str | None = Field(default=None, max_length=40)
    priority: str | None = Field(default=None, max_length=40)
    severity: str | None = Field(default=None, max_length=40)
    assigned_to: int | None = None
    comment: str | None = Field(default=None, max_length=1000)


class IncidentCommentRequest(BaseModel):
    text: str = Field(min_length=3, max_length=2000)


class IncidentTransitionRequest(BaseModel):
    new_status: str = Field(pattern="^(OPEN|IN_PROGRESS|ESCALATED|RESOLVED|CLOSED)$")
    comment: str = Field(min_length=5, max_length=2000)


class AlertAcknowledgeRequest(BaseModel):
    comment: str = Field(min_length=10, max_length=1000)


class AlertResolveRequest(BaseModel):
    resolution_note: str = Field(min_length=10, max_length=2000)


class PrivacyRequestCreate(BaseModel):
    request_type: str = Field(max_length=80)
    subject_type: str = Field(max_length=80)
    student_id: int | None = None
    subject_last_name: str | None = Field(default=None, max_length=120)
    subject_first_name: str | None = Field(default=None, max_length=120)
    subject_contact: str | None = Field(default=None, max_length=160)
    request_object: str | None = Field(default=None, max_length=2000)
    received_at: str | None = None


class PrivacyTransitionRequest(BaseModel):
    new_status: str = Field(pattern="^(RECEIVED|IN_PROGRESS|COMPLETED|CLOSED|REJECTED)$")
    comment: str = Field(min_length=5, max_length=2000)


class ProcessingRegisterCreate(BaseModel):
    processing_name: str = Field(max_length=160)
    purpose: str = Field(max_length=1000)
    data_categories: str = Field(max_length=1000)
    legal_basis_note: str | None = Field(default=None, max_length=1000)
    retention_note: str | None = Field(default=None, max_length=1000)
    data_subjects: str | None = Field(default=None, max_length=1000)
    controller_name: str | None = Field(default=None, max_length=255)
    processors_note: str | None = Field(default=None, max_length=1000)
    security_measures: str | None = Field(default=None, max_length=2000)
    status: str = Field(default="ACTIVE", pattern="^(ACTIVE|SUSPENDED|ARCHIVED)$")


class RetentionRuleCreate(BaseModel):
    resource_type: str = Field(max_length=80)
    name: str | None = Field(default=None, max_length=160)
    retention_period_days: int | None = Field(default=None, ge=1)
    duration_unit: str = Field(default="DAYS", pattern="^(DAYS|MONTHS|YEARS)$")
    trigger_type: str | None = Field(default=None, max_length=80)
    action_on_expiry: str = Field(default="REVIEW", max_length=80)
    status: str = Field(default="DRAFT_LEGAL_REVIEW", max_length=40)

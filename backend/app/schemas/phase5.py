from datetime import datetime

from pydantic import BaseModel, Field


class QrGenerateRequest(BaseModel):
    ttl_minutes: int = Field(default=60, ge=1, le=1440)


class QrPayloadResponse(BaseModel):
    payload: str
    format_version: str
    key_version: str
    valid_until: datetime


class QrVerifyRequest(BaseModel):
    payload: str = Field(min_length=10)


class QrVerifyResponse(BaseModel):
    result: str
    card_id: int | None = None
    reason: str | None = None


class AttendanceCheckRequest(BaseModel):
    card_id: int | None = None
    serial_number: str | None = Field(default=None, max_length=100)
    student_id: int | None = None
    school_id: int
    classroom_id: int | None = None
    event_type: str = Field(pattern="^(ENTRY|EXIT|LATE|ABSENCE)$")
    source: str = "MANUAL"


class AttendanceCorrectionRequest(BaseModel):
    new_value: str = Field(min_length=1, max_length=255)
    reason: str = Field(min_length=1, max_length=255)


class ServiceEntitlementRequest(BaseModel):
    student_id: int
    service_type_id: int
    service_provider_id: int
    valid_from: datetime
    valid_until: datetime | None = None
    status: str = "ACTIVE"


class ServiceVerifyRequest(BaseModel):
    student_id: int
    service_type_id: int
    card_id: int | None = None


class PaymentMockRequest(BaseModel):
    provider_code: str = Field(max_length=60)
    idempotency_key: str = Field(min_length=8, max_length=120)
    amount: float = Field(gt=0)
    category: str = Field(max_length=80)
    school_id: int
    school_year_id: int
    student_id: int | None = None
    reason: str = Field(max_length=255)
    simulate_error: bool = False


class PaymentReconcileRequest(BaseModel):
    notes: str | None = Field(default=None, max_length=255)

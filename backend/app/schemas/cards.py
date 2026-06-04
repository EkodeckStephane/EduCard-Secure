from datetime import datetime

from pydantic import BaseModel, Field


class CardCreateRequest(BaseModel):
    student_id: int
    reason: str | None = Field(default=None, max_length=255)


class CardActionRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=255)


class CardResponse(BaseModel):
    id: int
    public_id: str
    student_id: int
    serial_number: str
    card_version: int
    status: str
    issued_at: datetime | None
    activated_at: datetime | None
    expires_at: datetime | None
    revoked_at: datetime | None

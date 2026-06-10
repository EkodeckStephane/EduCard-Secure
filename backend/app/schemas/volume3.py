from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class BackupLogRequest(BaseModel):
    event_type: Literal["BACKUP_CREATED", "BACKUP_VERIFIED", "BACKUP_RESTORED", "BACKUP_FAILED"]
    status: Literal[
        "SUCCESS",
        "FAILED",
        "CHECKSUM_OK",
        "CHECKSUM_FAILED",
        "CHECKSUM_ABSENT",
        "RESTORE_COMPLETED",
        "IN_PROGRESS",
    ]
    file_reference: str | None = Field(default=None, max_length=255)
    checksum_present: bool = False
    file_size_bytes: int | None = Field(default=None, ge=0)
    started_at: datetime
    finished_at: datetime | None = None
    operator: str = Field(default="SCRIPT_AUTOMATED", max_length=120)

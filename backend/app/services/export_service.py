import csv
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_student_scope
from app.models.entities import Export, ExportEvent, Student
from app.schemas.dashboard import ExportCreateRequest
from app.services.dashboard_service import summary
from app.services.security_events import record_security_event


def export_dir() -> Path:
    path = Path(__file__).resolve().parents[3] / "exports"
    path.mkdir(parents=True, exist_ok=True)
    return path


def export_filename(public_id: str) -> str:
    return f"export_{public_id}.csv"


def create_export(db: Session, principal: CurrentPrincipal, payload: ExportCreateRequest) -> Export:
    if "export:create" not in principal.permissions:
        raise HTTPException(status_code=403, detail="Permission denied")
    if payload.export_type == "INDIVIDUAL_STUDENT" and "student:export" not in principal.permissions:
        raise HTTPException(status_code=403, detail="Student export permission required")
    public_id = str(uuid4())
    row = Export(
        public_id=public_id,
        export_type=payload.export_type,
        requested_by=principal.user.id,
        status="READY",
        expires_at=datetime.utcnow() + timedelta(hours=24),
        is_demo=True,
    )
    db.add(row)
    db.flush()
    path = export_dir() / export_filename(public_id)
    if payload.export_type == "INDIVIDUAL_STUDENT":
        if not payload.student_id:
            raise HTTPException(status_code=400, detail="student_id is required")
        assert_student_scope(db, principal, payload.student_id)
        student = db.get(Student, payload.student_id)
        data = [["trace", "demo export"], ["student_public_id", student.public_id], ["student_number", student.student_number], ["status", student.status]]
    else:
        stats = summary(db, principal, payload.filters.model_dump())
        data = [["trace", f"export {public_id}"], ["metric", "value"]]
        data.extend([[key, value] for key, value in stats.get("metrics", {}).items()])
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerows(data)
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    db.add(ExportEvent(export_id=row.id, event_type=f"CREATED:{digest}", created_by=principal.user.id))
    record_security_event(db, "EXPORT_CREATED", "HIGH", principal.user.id, "export", row.public_id, payload.reason)
    db.commit()
    db.refresh(row)
    return row


def export_to_dict(row: Export) -> dict:
    return {
        "id": row.id,
        "public_id": row.public_id,
        "export_type": row.export_type,
        "status": row.status,
        "created_at": row.created_at.isoformat(),
        "expires_at": row.expires_at.isoformat() if row.expires_at else None,
        "filename": export_filename(row.public_id),
    }


def export_download(db: Session, principal: CurrentPrincipal, export_id: int) -> tuple[str, str]:
    if "export:download" not in principal.permissions:
        raise HTTPException(status_code=403, detail="Permission denied")
    row = db.get(Export, export_id)
    if not row:
        raise HTTPException(status_code=404, detail="Export not found")
    if row.expires_at and row.expires_at < datetime.utcnow():
        row.status = "EXPIRED"
        db.add(ExportEvent(export_id=row.id, event_type="DOWNLOAD_EXPIRED", created_by=principal.user.id))
        db.commit()
        raise HTTPException(status_code=410, detail="Export expired")
    path = export_dir() / export_filename(row.public_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Export file not found")
    db.add(ExportEvent(export_id=row.id, event_type="DOWNLOADED", created_by=principal.user.id))
    record_security_event(db, "EXPORT_DOWNLOADED", "HIGH", principal.user.id, "export", row.public_id)
    db.commit()
    return path.read_text(encoding="utf-8"), export_filename(row.public_id)

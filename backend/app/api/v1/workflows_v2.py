import base64
import hashlib
import json
from datetime import date, datetime
from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_student_scope, require_csrf, require_permission
from app.core.database import get_db
from app.models.entities import (
    AttendanceEvent,
    Card,
    Enrollment,
    NotificationEvent,
    PaymentTransaction,
    ServiceEntitlement,
    ServiceVerificationEvent,
    Student,
    StudentGuardian,
    StudentStatusHistory,
    Transfer,
)
from app.services.audit_service import append_audit_event
from app.services.qr_service import load_private_key, public_key_fingerprint


router = APIRouter(tags=["workflows-v2"])


class SmsSimulationRequest(BaseModel):
    recipient_phone: str = Field(min_length=8, max_length=30)
    message: str = Field(min_length=3, max_length=500)
    student_id: int | None = None
    card_id: int | None = None


class PortabilityExportRequest(BaseModel):
    student_id: int
    reason: str = Field(min_length=20, max_length=1000)


def _json_value(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    return value


def _model_dict(row, excluded: set[str] | None = None) -> dict:
    excluded = excluded or set()
    return {
        column.name: _json_value(getattr(row, column.name))
        for column in row.__table__.columns
        if column.name not in excluded
    }


@router.post("/notifications/sms", dependencies=[Depends(require_csrf)])
def simulate_sms(
    payload: SmsSimulationRequest,
    principal: CurrentPrincipal = Depends(require_permission("card:issue")),
    db: Session = Depends(get_db),
):
    if payload.student_id:
        assert_student_scope(db, principal, payload.student_id)
    message_id = f"SMS-MOCK-{uuid4().hex[:16].upper()}"
    db.add(NotificationEvent(event_type="SMS_SIMULATED", recipient_scope=payload.recipient_phone[-4:], status="SIMULATED"))
    append_audit_event(db, principal, "SMS_SIMULATED", "notification", message_id, justification="Notification locale fictive", severity="INFO")
    db.commit()
    return {"status": "simulated", "message_id": message_id}


@router.post("/exports/portability")
def export_student_portability(
    payload: PortabilityExportRequest,
    principal: CurrentPrincipal = Depends(require_permission("data:export_personal")),
    db: Session = Depends(get_db),
    _: None = Depends(require_csrf),
):
    assert_student_scope(db, principal, payload.student_id)
    student = db.get(Student, payload.student_id)
    if not student:
        return Response(status_code=404)

    def rows(model, criterion):
        return [_model_dict(row) for row in db.execute(select(model).where(criterion)).scalars()]

    document = {
        "format": "EDUCARD_PORTABILITY_V1",
        "generated_at": datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "student": _model_dict(student, {"id", "created_by"}),
        "guardians": rows(StudentGuardian, StudentGuardian.student_id == student.id),
        "enrollments": rows(Enrollment, Enrollment.student_id == student.id),
        "transfers": rows(Transfer, Transfer.student_id == student.id),
        "status_history": rows(StudentStatusHistory, StudentStatusHistory.student_id == student.id),
        "cards": rows(Card, Card.student_id == student.id),
        "attendance": rows(AttendanceEvent, AttendanceEvent.student_id == student.id),
        "service_entitlements": rows(ServiceEntitlement, ServiceEntitlement.student_id == student.id),
        "service_verifications": rows(ServiceVerificationEvent, ServiceVerificationEvent.student_id == student.id),
        "payments": rows(PaymentTransaction, PaymentTransaction.student_id == student.id),
    }
    canonical = json.dumps(document, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode("utf-8")
    checksum = hashlib.sha256(canonical).hexdigest()
    private_key = load_private_key()
    signature = base64.urlsafe_b64encode(private_key.sign(canonical)).decode("ascii").rstrip("=")
    package = json.dumps(
        {
            "document": document,
            "integrity": {
                "algorithm": "Ed25519",
                "checksum_sha256": checksum,
                "signature": signature,
                "public_key_fingerprint": public_key_fingerprint(private_key.public_key()),
            },
        },
        ensure_ascii=False,
        indent=2,
    )
    export_id = f"PORT-{uuid4().hex[:16].upper()}"
    append_audit_event(
        db,
        principal,
        "PERSONAL_DATA_PORTABILITY_EXPORTED",
        "student",
        student.public_id,
        justification=payload.reason,
        severity="HIGH",
    )
    db.commit()
    return Response(
        package,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="portability-{export_id}.json"',
            "X-Export-Checksum": checksum,
            "X-Export-Signature": signature,
        },
    )

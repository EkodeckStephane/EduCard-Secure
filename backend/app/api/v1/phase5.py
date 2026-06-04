from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_school_scope, require_csrf, require_permission
from app.core.database import get_db
from app.models.entities import AttendanceCorrection, AttendanceEvent, PaymentReconciliation, PaymentTransaction, ServiceEntitlement, ServiceType
from app.schemas.phase5 import (
    AttendanceCheckRequest,
    AttendanceCorrectionRequest,
    PaymentMockRequest,
    PaymentReconcileRequest,
    QrGenerateRequest,
    QrPayloadResponse,
    QrVerifyRequest,
    QrVerifyResponse,
    ServiceEntitlementRequest,
    ServiceVerifyRequest,
)
from app.services.attendance_service import approve_attendance_correction, correct_attendance, create_attendance_event
from app.services.payment_service import create_mock_payment, reconcile_payment
from app.services.qr_service import generate_qr_payload, verify_qr_payload
from app.services.security_events import record_security_event
from app.services.service_engine import create_entitlement, verify_service


router = APIRouter(tags=["phase5"])


@router.post("/cards/{card_id}/qr/generate", response_model=QrPayloadResponse)
def generate_card_qr(
    card_id: int,
    payload: QrGenerateRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:issue")),
    _: None = Depends(require_csrf),
) -> QrPayloadResponse:
    return QrPayloadResponse(**generate_qr_payload(db, card_id, payload.ttl_minutes, principal))


@router.post("/cards/verify", response_model=QrVerifyResponse)
def verify_card_qr(
    payload: QrVerifyRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:verify")),
) -> QrVerifyResponse:
    return QrVerifyResponse(**verify_qr_payload(db, payload.payload, principal))


@router.get("/attendance")
def list_attendance(
    school_id: int | None = None,
    event_type: str | None = None,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("attendance:read")),
):
    stmt = select(AttendanceEvent).order_by(AttendanceEvent.event_time.desc()).limit(200)
    if school_id:
        assert_school_scope(db, principal, school_id)
        stmt = stmt.where(AttendanceEvent.school_id == school_id)
    if event_type:
        stmt = stmt.where(AttendanceEvent.event_type == event_type)
    rows = []
    for row in db.execute(stmt).scalars():
        try:
            assert_school_scope(db, principal, row.school_id)
            rows.append(row)
        except Exception:
            continue
    record_security_event(db, "ATTENDANCE_LIST_VIEWED", "INFO", principal.user.id, "attendance")
    db.commit()
    return [
        {"id": row.id, "student_id": row.student_id, "card_id": row.card_id, "school_id": row.school_id, "event_type": row.event_type, "event_time": row.event_time}
        for row in rows
    ]


@router.post("/attendance/check-in")
def check_in(
    payload: AttendanceCheckRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("attendance:create")),
    _: None = Depends(require_csrf),
):
    row = create_attendance_event(db, principal, payload.school_id, payload.event_type, payload.source, payload.card_id, payload.serial_number, payload.student_id, payload.classroom_id)
    return {"id": row.id, "student_id": row.student_id, "event_type": row.event_type, "event_time": row.event_time}


@router.post("/attendance/check-out")
def check_out(
    payload: AttendanceCheckRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("attendance:create")),
    _: None = Depends(require_csrf),
):
    row = create_attendance_event(db, principal, payload.school_id, "EXIT", payload.source, payload.card_id, payload.serial_number, payload.student_id, payload.classroom_id)
    return {"id": row.id, "student_id": row.student_id, "event_type": row.event_type, "event_time": row.event_time}


@router.post("/attendance/{attendance_id}/correct")
def correct_attendance_endpoint(
    attendance_id: int,
    payload: AttendanceCorrectionRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("attendance:create")),
    _: None = Depends(require_csrf),
):
    row = correct_attendance(db, attendance_id, payload.new_value, payload.reason, principal)
    return {"id": row.id, "attendance_event_id": row.attendance_event_id, "new_value": row.new_value, "approved_at": row.approved_at}


@router.post("/attendance/{attendance_id}/approve-correction")
def approve_correction_endpoint(
    attendance_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("attendance:create")),
    _: None = Depends(require_csrf),
):
    row = approve_attendance_correction(db, attendance_id, principal)
    return {"id": row.id, "attendance_event_id": row.attendance_event_id, "new_value": row.new_value, "approved_at": row.approved_at}


@router.get("/services")
def list_services(db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("service:verify"))):
    rows = db.execute(select(ServiceType).order_by(ServiceType.code)).scalars()
    record_security_event(db, "SERVICE_LIST_VIEWED", "INFO", principal.user.id, "service")
    db.commit()
    return [{"id": row.id, "code": row.code, "label": row.label} for row in rows]


@router.post("/services/entitlements")
def create_service_entitlement(
    payload: ServiceEntitlementRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("service:manage")),
    _: None = Depends(require_csrf),
):
    row = create_entitlement(db, principal, payload.student_id, payload.service_type_id, payload.service_provider_id, payload.valid_from, payload.valid_until, payload.status)
    return {"id": row.id, "student_id": row.student_id, "service_type_id": row.service_type_id, "status": row.status}


@router.post("/services/verify")
def verify_service_endpoint(
    payload: ServiceVerifyRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("service:verify")),
):
    return verify_service(db, principal, payload.student_id, payload.service_type_id, payload.card_id)


@router.get("/payments")
def list_payments(
    school_id: int | None = None,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("payment:read")),
):
    stmt = select(PaymentTransaction).order_by(PaymentTransaction.created_at.desc()).limit(200)
    if school_id:
        assert_school_scope(db, principal, school_id)
        stmt = stmt.where(PaymentTransaction.school_id == school_id)
    rows = []
    for row in db.execute(stmt).scalars():
        try:
            assert_school_scope(db, principal, row.school_id)
            rows.append(row)
        except Exception:
            continue
    record_security_event(db, "PAYMENT_LIST_VIEWED", "INFO", principal.user.id, "payment")
    db.commit()
    return [
        {"id": row.id, "public_id": row.public_id, "school_id": row.school_id, "student_id": row.student_id, "amount": float(row.amount), "category": row.category, "status": row.status}
        for row in rows
    ]


@router.post("/payments/mock")
def create_payment(
    payload: PaymentMockRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("payment:create")),
    _: None = Depends(require_csrf),
):
    row = create_mock_payment(
        db,
        principal,
        payload.provider_code,
        payload.idempotency_key,
        payload.amount,
        payload.category,
        payload.school_id,
        payload.school_year_id,
        payload.student_id,
        payload.reason,
        payload.simulate_error,
    )
    return {"id": row.id, "public_id": row.public_id, "opaque_reference": row.opaque_reference, "status": row.status, "amount": float(row.amount)}


@router.post("/payments/{payment_id}/reconcile")
def reconcile_payment_endpoint(
    payment_id: int,
    payload: PaymentReconcileRequest = PaymentReconcileRequest(),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("payment:reconcile")),
    _: None = Depends(require_csrf),
):
    row = reconcile_payment(db, principal, payment_id, payload.notes)
    return {"id": row.id, "payment_transaction_id": row.payment_transaction_id, "status": row.reconciliation_status, "matched_at": row.matched_at}


@router.get("/payments/reconciliations")
def list_reconciliations(db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("payment:read"))):
    rows = db.execute(select(PaymentReconciliation).order_by(PaymentReconciliation.id.desc()).limit(200)).scalars()
    return [{"id": row.id, "payment_transaction_id": row.payment_transaction_id, "status": row.reconciliation_status, "matched_at": row.matched_at} for row in rows]

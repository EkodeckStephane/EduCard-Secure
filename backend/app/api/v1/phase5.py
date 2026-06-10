import json
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_school_scope, require_csrf, require_permission
from app.core.database import get_db
from app.models.entities import AttendanceCorrection, AttendanceEvent, PaymentReconciliation, PaymentTransaction, ServiceEntitlement, ServiceProvider, ServiceType
from app.schemas.phase5 import (
    AttendanceCheckRequest,
    AttendanceCorrectionRequest,
    PaymentMockRequest,
    PaymentBatchReconcileRequest,
    PaymentReconcileRequest,
    QrGenerateRequest,
    QrPayloadResponse,
    QrVerifyRequest,
    QrVerifyResponse,
    ServiceEntitlementRequest,
    ServiceProviderUpsertRequest,
    ServiceTypeUpsertRequest,
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
@router.post("/attendance/{attendance_id}/correction")
def correct_attendance_endpoint(
    attendance_id: int,
    payload: AttendanceCorrectionRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("attendance:correct")),
    _: None = Depends(require_csrf),
):
    row = correct_attendance(db, attendance_id, payload.new_value, payload.reason, principal)
    return {"id": row.id, "attendance_event_id": row.attendance_event_id, "new_value": row.new_value, "approved_at": row.approved_at}


@router.post("/attendance/{attendance_id}/approve-correction")
def approve_correction_endpoint(
    attendance_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("attendance:validate")),
    _: None = Depends(require_csrf),
):
    row = approve_attendance_correction(db, attendance_id, principal)
    return {"id": row.id, "attendance_event_id": row.attendance_event_id, "new_value": row.new_value, "approved_at": row.approved_at}


def _service_type_dict(row: ServiceType) -> dict:
    return {
        "id": row.id, "code": row.code, "label": row.label, "name": row.label,
        "description": row.description, "category": row.category, "icon": row.icon,
        "active": row.is_active,
        "rules": json.loads(row.eligibility_rules or "{}"),
        "calendar": json.loads(row.calendar_rules or "{}"),
        "limits": json.loads(row.consumption_limits or "{}"),
    }


@router.get("/services")
@router.get("/service-types")
def list_services(db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("service:verify"))):
    rows = db.execute(select(ServiceType).order_by(ServiceType.code)).scalars()
    record_security_event(db, "SERVICE_LIST_VIEWED", "INFO", principal.user.id, "service")
    db.commit()
    return [_service_type_dict(row) for row in rows]


@router.post("/service-types")
def create_service_type(payload: ServiceTypeUpsertRequest, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("service:manage")), _: None = Depends(require_csrf)):
    if db.execute(select(ServiceType.id).where(ServiceType.code == payload.code)).first():
        raise HTTPException(status_code=409, detail="Service type code already exists")
    row = ServiceType(code=payload.code, label=payload.name, description=payload.description, category=payload.category, icon=payload.icon, eligibility_rules=json.dumps(payload.rules), calendar_rules=json.dumps(payload.calendar), consumption_limits=json.dumps(payload.limits), is_active=payload.active)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _service_type_dict(row)


@router.put("/service-types/{service_type_id}")
def update_service_type(service_type_id: int, payload: ServiceTypeUpsertRequest, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("service:manage")), _: None = Depends(require_csrf)):
    row = db.get(ServiceType, service_type_id)
    if not row:
        raise HTTPException(status_code=404, detail="Service type not found")
    row.label, row.description, row.category, row.icon, row.is_active = payload.name, payload.description, payload.category, payload.icon, payload.active
    row.eligibility_rules, row.calendar_rules, row.consumption_limits = json.dumps(payload.rules), json.dumps(payload.calendar), json.dumps(payload.limits)
    db.commit()
    return _service_type_dict(row)


@router.delete("/service-types/{service_type_id}")
def disable_service_type(service_type_id: int, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("service:manage")), _: None = Depends(require_csrf)):
    row = db.get(ServiceType, service_type_id)
    if not row:
        raise HTTPException(status_code=404, detail="Service type not found")
    row.is_active = False
    db.commit()
    return {"status": "disabled"}


def _provider_dict(row: ServiceProvider) -> dict:
    return {"id": row.id, "public_id": row.public_id, "code": row.code, "name": row.name, "provider_type": row.provider_type, "school_ids": json.loads(row.school_ids or "[]"), "contact": row.contact_name, "phone": row.phone_masked, "active": row.is_active, "is_mock": row.is_mock}


@router.get("/services/providers")
@router.get("/service-providers")
def list_service_providers(db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("service:verify"))):
    rows = db.execute(select(ServiceProvider).order_by(ServiceProvider.name)).scalars()
    return [_provider_dict(row) for row in rows]


@router.post("/service-providers")
def create_service_provider(payload: ServiceProviderUpsertRequest, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("service:manage")), _: None = Depends(require_csrf)):
    row = ServiceProvider(public_id=str(uuid4()), code=payload.code, name=payload.name, provider_type=payload.provider_type, school_ids=json.dumps(payload.school_ids), contact_name=payload.contact, phone_masked=payload.phone, is_active=payload.active, is_mock=True)
    db.add(row)
    db.commit()
    db.refresh(row)
    return _provider_dict(row)


@router.put("/service-providers/{provider_id}")
def update_service_provider(provider_id: int, payload: ServiceProviderUpsertRequest, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("service:manage")), _: None = Depends(require_csrf)):
    row = db.get(ServiceProvider, provider_id)
    if not row:
        raise HTTPException(status_code=404, detail="Service provider not found")
    row.name, row.provider_type, row.school_ids, row.contact_name, row.phone_masked, row.is_active = payload.name, payload.provider_type, json.dumps(payload.school_ids), payload.contact, payload.phone, payload.active
    db.commit()
    return _provider_dict(row)


@router.get("/attendance/corrections")
def list_attendance_corrections(
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("attendance:read")),
):
    rows = db.execute(select(AttendanceCorrection).order_by(AttendanceCorrection.id.desc()).limit(200)).scalars()
    return [
        {
            "id": row.id,
            "attendance_event_id": row.attendance_event_id,
            "previous_value": row.previous_value,
            "new_value": row.new_value,
            "reason": row.reason,
            "status": "APPROVED" if row.approved_at else "PENDING_VALIDATION",
            "requested_by": row.requested_by,
            "approved_by": row.approved_by,
            "approved_at": row.approved_at,
        }
        for row in rows
    ]


@router.post("/services/entitlements")
def create_service_entitlement(
    payload: ServiceEntitlementRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("service:manage")),
    _: None = Depends(require_csrf),
):
    row = create_entitlement(db, principal, payload.student_id, payload.service_type_id, payload.service_provider_id, payload.valid_from, payload.valid_until, payload.status, payload.notes)
    return {"id": row.id, "student_id": row.student_id, "service_type_id": row.service_type_id, "status": row.status}


@router.get("/service-entitlements/check")
def check_service_entitlement(student_id: int, service_type_id: int, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("service:verify"))):
    result = verify_service(db, principal, student_id, service_type_id, record_event=False)
    return {"eligible": result["result"] == "ALLOWED", **result}


@router.get("/students/{student_id}/service-usages")
def student_service_usages(student_id: int, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("service:verify"))):
    from app.api.v1.dependencies import assert_student_scope
    from app.models.entities import ServiceVerificationEvent
    assert_student_scope(db, principal, student_id)
    rows = db.execute(
        select(ServiceVerificationEvent, ServiceType, ServiceProvider)
        .outerjoin(ServiceEntitlement, ServiceEntitlement.id == ServiceVerificationEvent.service_entitlement_id)
        .outerjoin(ServiceType, ServiceType.id == ServiceEntitlement.service_type_id)
        .outerjoin(ServiceProvider, ServiceProvider.id == ServiceEntitlement.service_provider_id)
        .where(ServiceVerificationEvent.student_id == student_id)
        .order_by(ServiceVerificationEvent.verified_at.desc()).limit(200)
    ).all()
    return [{"id": event.id, "service": service.label if service else None, "provider": provider.name if provider else None, "result": event.result, "verified_at": event.verified_at} for event, service, provider in rows]


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
        "INSUFFICIENT_FUNDS" if payload.simulate_error else payload.simulation_result,
        payload.external_reference,
        payload.notes,
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
    row = reconcile_payment(db, principal, payment_id, payload.notes, payload.result, payload.actual_amount)
    return {"id": row.id, "payment_transaction_id": row.payment_transaction_id, "status": row.reconciliation_status, "matched_at": row.matched_at}


@router.post("/payments/reconcile-batch")
def reconcile_payment_batch(payload: PaymentBatchReconcileRequest, db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("payment:reconcile")), _: None = Depends(require_csrf)):
    results = []
    for payment_id in payload.transaction_ids:
        try:
            row = reconcile_payment(db, principal, payment_id, payload.comment, payload.result, None)
            results.append({"transaction_id": payment_id, "status": row.reconciliation_status})
        except HTTPException as exc:
            db.rollback()
            results.append({"transaction_id": payment_id, "status": "ERROR", "error": exc.detail})
    return {"results": results, "processed": len(results)}


@router.get("/payments/reconciliations")
def list_reconciliations(db: Session = Depends(get_db), principal: CurrentPrincipal = Depends(require_permission("payment:read"))):
    rows = db.execute(select(PaymentReconciliation).order_by(PaymentReconciliation.id.desc()).limit(200)).scalars()
    return [{"id": row.id, "payment_transaction_id": row.payment_transaction_id, "status": row.reconciliation_status, "matched_at": row.matched_at} for row in rows]

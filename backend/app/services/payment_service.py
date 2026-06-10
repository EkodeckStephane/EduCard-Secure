from datetime import datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_school_scope, assert_student_scope
from app.models.entities import PaymentProvider, PaymentReconciliation, PaymentTransaction
from app.services.payment_providers import PROVIDERS
from app.services.security_events import record_security_event


def create_mock_payment(
    db: Session,
    principal: CurrentPrincipal,
    provider_code: str,
    idempotency_key: str,
    amount: float,
    category: str,
    school_id: int,
    school_year_id: int,
    student_id: int | None,
    reason: str,
    simulation_result: str,
    external_reference: str | None = None,
    notes: str | None = None,
) -> PaymentTransaction:
    assert_school_scope(db, principal, school_id)
    if student_id:
        assert_student_scope(db, principal, student_id)
    provider = db.execute(select(PaymentProvider).where(PaymentProvider.code == provider_code)).scalar_one_or_none()
    if not provider or provider_code not in PROVIDERS:
        raise HTTPException(status_code=400, detail="Unknown mock payment provider")
    existing = db.execute(
        select(PaymentTransaction).where(
            PaymentTransaction.payment_provider_id == provider.id,
            PaymentTransaction.idempotency_key == idempotency_key,
        )
    ).scalar_one_or_none()
    if existing:
        record_security_event(db, "PAYMENT_IDEMPOTENT_REPLAY", "INFO", principal.user.id, "payment", existing.public_id)
        db.commit()
        return existing
    if simulation_result == "NETWORK_ERROR":
        raise HTTPException(status_code=503, detail="Simulated network failure")
    if simulation_result == "TIMEOUT":
        raise HTTPException(status_code=504, detail="Simulated provider timeout")
    result = PROVIDERS[provider_code].create(idempotency_key, simulation_result == "INSUFFICIENT_FUNDS")
    tx = PaymentTransaction(
        public_id=str(uuid4()),
        payment_provider_id=provider.id,
        student_id=student_id,
        school_id=school_id,
        school_year_id=school_year_id,
        opaque_reference=result.opaque_reference,
        idempotency_key=idempotency_key,
        amount=amount,
        currency="XAF",
        category=category,
        status=result.status,
        external_reference=external_reference,
        error_code="INSUFFICIENT_FUNDS" if simulation_result == "INSUFFICIENT_FUNDS" else None,
        notes_minimized=notes,
        is_demo=True,
    )
    db.add(tx)
    db.flush()
    record_security_event(db, "PAYMENT_MOCK_CREATED", "MEDIUM", principal.user.id, "payment", tx.public_id, reason)
    db.commit()
    db.refresh(tx)
    return tx


def reconcile_payment(db: Session, principal: CurrentPrincipal, payment_id: int, notes: str | None, result: str = "SUCCESS", actual_amount: float | None = None) -> PaymentReconciliation:
    tx = db.get(PaymentTransaction, payment_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Payment not found")
    assert_school_scope(db, principal, tx.school_id)
    existing = db.execute(select(PaymentReconciliation).where(PaymentReconciliation.payment_transaction_id == payment_id)).scalar_one_or_none()
    if existing:
        return existing
    tx.status = "RECONCILED" if result in {"SUCCESS", "PARTIAL"} else result
    if result == "PARTIAL" and actual_amount is not None:
        tx.amount = actual_amount
    row = PaymentReconciliation(
        payment_transaction_id=payment_id,
        reconciliation_status={"SUCCESS": "MATCHED", "PARTIAL": "PARTIAL", "REJECTED": "REJECTED", "DUPLICATE": "DUPLICATE"}[result],
        matched_at=datetime.utcnow(),
        matched_by=principal.user.id,
        notes_minimized=notes,
        is_demo=True,
    )
    db.add(row)
    db.flush()
    record_security_event(db, "PAYMENT_RECONCILED", "MEDIUM", principal.user.id, "payment", tx.public_id)
    db.commit()
    db.refresh(row)
    return row

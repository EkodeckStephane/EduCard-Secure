import hashlib
from datetime import datetime
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_card_scope, assert_student_scope
from app.models.entities import Card, CardIssuanceEvent, CardStatusHistory
from app.services.security_events import record_security_event


def generate_serial_number(db: Session) -> str:
    for _ in range(10):
        serial = "CARD-" + hashlib.sha256(uuid4().bytes).hexdigest()[:16].upper()
        if not db.execute(select(Card.id).where(Card.serial_number == serial)).first():
            return serial
    raise RuntimeError("Unable to generate unique card serial")


def card_to_dict(card: Card) -> dict:
    return {
        "id": card.id,
        "public_id": card.public_id,
        "student_id": card.student_id,
        "serial_number": card.serial_number,
        "card_version": card.card_version,
        "status": card.status,
        "issued_at": card.issued_at,
        "activated_at": card.activated_at,
        "expires_at": card.expires_at,
        "revoked_at": card.revoked_at,
    }


def create_card(db: Session, student_id: int, principal: CurrentPrincipal, reason: str | None = None) -> Card:
    assert_student_scope(db, principal, student_id)
    card = Card(public_id=str(uuid4()), student_id=student_id, serial_number=generate_serial_number(db), card_version=1, status="REQUESTED", is_demo=True)
    db.add(card)
    db.flush()
    db.add(CardIssuanceEvent(card_id=card.id, event_type="REQUESTED", requested_by=principal.user.id, details_minimized=reason))
    db.add(CardStatusHistory(card_id=card.id, previous_status=None, new_status="REQUESTED", reason=reason, changed_by=principal.user.id))
    record_security_event(db, "CARD_REQUESTED", "MEDIUM", principal.user.id, "card", card.public_id)
    db.commit()
    db.refresh(card)
    return card


def transition_card(db: Session, card_id: int, action: str, principal: CurrentPrincipal, reason: str | None = None) -> Card:
    assert_card_scope(db, principal, card_id)
    card = db.get(Card, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    previous = card.status
    now = datetime.utcnow()
    if action == "activate":
        card.status = "ACTIVE"
        card.activated_at = now
        event = "ACTIVATED"
    elif action == "suspend":
        card.status = "SUSPENDED"
        event = "SUSPENDED"
    elif action == "reactivate":
        card.status = "ACTIVE"
        event = "REACTIVATED"
    elif action == "revoke":
        card.status = "REVOKED"
        card.revoked_at = now
        event = "REVOKED"
    elif action == "replace":
        card.status = "REPLACED"
        event = "REPLACED"
        replacement = Card(public_id=str(uuid4()), student_id=card.student_id, serial_number=generate_serial_number(db), card_version=card.card_version + 1, status="REQUESTED", is_demo=True)
        db.add(replacement)
        db.flush()
        db.add(CardStatusHistory(card_id=replacement.id, previous_status=None, new_status="REQUESTED", reason="REPLACEMENT_CREATED", changed_by=principal.user.id))
        db.add(CardIssuanceEvent(card_id=replacement.id, event_type="REQUESTED", requested_by=principal.user.id, details_minimized="Replacement card"))
    else:
        raise HTTPException(status_code=400, detail="Unsupported card action")
    if action == "activate" and not card.issued_at:
        card.issued_at = now
    db.add(CardStatusHistory(card_id=card.id, previous_status=previous, new_status=card.status, reason=reason, changed_by=principal.user.id))
    db.add(CardIssuanceEvent(card_id=card.id, event_type=event, processed_by=principal.user.id, details_minimized=reason))
    record_security_event(db, f"CARD_{event}", "HIGH", principal.user.id, "card", card.public_id)
    db.commit()
    db.refresh(card)
    return card

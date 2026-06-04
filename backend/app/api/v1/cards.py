from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_card_scope, assert_student_scope, require_csrf, require_permission
from app.core.database import get_db
from app.models.entities import Card, CardIssuanceEvent, CardStatusHistory
from app.schemas.cards import CardActionRequest, CardCreateRequest, CardResponse
from app.services.card_service import card_to_dict, create_card, transition_card
from app.services.security_events import record_security_event


router = APIRouter(tags=["cards"])


def _card_response(card: Card) -> CardResponse:
    return CardResponse(**card_to_dict(card))


def _cards_in_scope(db: Session, principal: CurrentPrincipal, rows: list[Card]) -> list[Card]:
    allowed: list[Card] = []
    for card in rows:
        try:
            assert_student_scope(db, principal, card.student_id)
            allowed.append(card)
        except HTTPException:
            continue
    return allowed


@router.get("/cards", response_model=list[CardResponse])
def list_cards(
    student_id: int | None = None,
    status_value: str | None = None,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:verify")),
) -> list[CardResponse]:
    stmt = select(Card).order_by(Card.created_at.desc()).limit(500)
    if student_id:
        assert_student_scope(db, principal, student_id)
        stmt = stmt.where(Card.student_id == student_id)
    if status_value:
        stmt = stmt.where(Card.status == status_value)
    rows = _cards_in_scope(db, principal, list(db.execute(stmt).scalars()))
    record_security_event(db, "CARD_LIST_VIEWED", "INFO", principal.user.id, "card")
    db.commit()
    return [_card_response(row) for row in rows]


@router.post("/cards", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
def request_card(
    payload: CardCreateRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:issue")),
    _: None = Depends(require_csrf),
) -> CardResponse:
    return _card_response(create_card(db, payload.student_id, principal, payload.reason))


@router.get("/cards/{card_id}", response_model=CardResponse)
def get_card(
    card_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:verify")),
) -> CardResponse:
    assert_card_scope(db, principal, card_id)
    card = db.get(Card, card_id)
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    record_security_event(db, "CARD_VIEWED", "INFO", principal.user.id, "card", card.public_id)
    db.commit()
    return _card_response(card)


def _card_action(card_id: int, action: str, payload: CardActionRequest, db: Session, principal: CurrentPrincipal) -> CardResponse:
    return _card_response(transition_card(db, card_id, action, principal, payload.reason))


@router.post("/cards/{card_id}/activate", response_model=CardResponse)
def activate_card(
    card_id: int,
    payload: CardActionRequest = CardActionRequest(),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:issue")),
    _: None = Depends(require_csrf),
) -> CardResponse:
    return _card_action(card_id, "activate", payload, db, principal)


@router.post("/cards/{card_id}/suspend", response_model=CardResponse)
def suspend_card(
    card_id: int,
    payload: CardActionRequest = CardActionRequest(),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:suspend")),
    _: None = Depends(require_csrf),
) -> CardResponse:
    return _card_action(card_id, "suspend", payload, db, principal)


@router.post("/cards/{card_id}/reactivate", response_model=CardResponse)
def reactivate_card(
    card_id: int,
    payload: CardActionRequest = CardActionRequest(),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:suspend")),
    _: None = Depends(require_csrf),
) -> CardResponse:
    return _card_action(card_id, "reactivate", payload, db, principal)


@router.post("/cards/{card_id}/revoke", response_model=CardResponse)
def revoke_card(
    card_id: int,
    payload: CardActionRequest = CardActionRequest(),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:revoke")),
    _: None = Depends(require_csrf),
) -> CardResponse:
    return _card_action(card_id, "revoke", payload, db, principal)


@router.post("/cards/{card_id}/replace", response_model=CardResponse)
def replace_card(
    card_id: int,
    payload: CardActionRequest = CardActionRequest(),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:issue")),
    _: None = Depends(require_csrf),
) -> CardResponse:
    return _card_action(card_id, "replace", payload, db, principal)


@router.get("/cards/{card_id}/history")
def card_history(
    card_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:verify")),
):
    assert_card_scope(db, principal, card_id)
    card = db.get(Card, card_id)
    status_rows = db.execute(select(CardStatusHistory).where(CardStatusHistory.card_id == card_id).order_by(CardStatusHistory.changed_at)).scalars()
    event_rows = db.execute(select(CardIssuanceEvent).where(CardIssuanceEvent.card_id == card_id).order_by(CardIssuanceEvent.created_at)).scalars()
    record_security_event(db, "CARD_HISTORY_VIEWED", "INFO", principal.user.id, "card", card.public_id if card else None)
    db.commit()
    return {
        "status_history": [
            {"previous_status": row.previous_status, "new_status": row.new_status, "reason": row.reason, "changed_at": row.changed_at}
            for row in status_rows
        ],
        "issuance_events": [
            {"event_type": row.event_type, "created_at": row.created_at, "details_minimized": row.details_minimized}
            for row in event_rows
        ],
    }

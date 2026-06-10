from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1.dependencies import CurrentPrincipal, assert_card_scope, assert_student_scope, require_csrf, require_permission
from app.core.database import get_db
from app.models.entities import Card, CardIssuanceEvent, CardStatusHistory, Classroom, School, SchoolYear, Student
from app.schemas.cards import CardActionRequest, CardCreateRequest, CardResponse
from app.services.card_service import card_to_dict, create_card, transition_card
from app.services.security_events import record_security_event
from app.services.audit_service import append_audit_event


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
    reason = payload.reason_text or payload.reason
    if payload.reason_code:
        reason = f"{payload.reason_code}: {reason or ''}".strip()
    return _card_response(transition_card(db, card_id, action, principal, reason))


@router.post("/cards/request", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
def request_card_alias(
    payload: CardCreateRequest,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("cards:request")),
    _: None = Depends(require_csrf),
) -> CardResponse:
    return _card_response(create_card(db, payload.student_id, principal, payload.reason))


@router.get("/cards/{card_id}/display")
def card_display(
    card_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:verify")),
) -> dict:
    assert_card_scope(db, principal, card_id)
    card = db.get(Card, card_id)
    student = db.get(Student, card.student_id) if card else None
    school = db.get(School, student.current_school_id) if student and student.current_school_id else None
    classroom = db.get(Classroom, student.current_classroom_id) if student and student.current_classroom_id else None
    year = db.get(SchoolYear, classroom.school_year_id) if classroom else None
    if not card or not student:
        raise HTTPException(status_code=404, detail="Card not found")
    return {
        **card_to_dict(card),
        "student": {
            "id": student.id,
            "student_number": student.student_number,
            "last_name": student.last_name,
            "first_name": student.first_name,
            "birth_date": student.birth_date,
            "photo_url": f"/api/v1/students/{student.id}/photo",
        },
        "school": {"id": school.id, "name": school.name, "education_subsystem": school.education_subsystem} if school else None,
        "classroom": {"id": classroom.id, "label": classroom.label} if classroom else None,
        "school_year": year.code if year else None,
    }


@router.post("/cards/{card_id}/activate", response_model=CardResponse)
def activate_card(
    card_id: int,
    payload: CardActionRequest = CardActionRequest(),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:issue")),
    _: None = Depends(require_csrf),
) -> CardResponse:
    return _card_action(card_id, "activate", payload, db, principal)


@router.post("/cards/{card_id}/issue", response_model=CardResponse)
def issue_card(
    card_id: int,
    payload: CardActionRequest = CardActionRequest(),
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:issue")),
    _: None = Depends(require_csrf),
) -> CardResponse:
    return _card_action(card_id, "issue", payload, db, principal)


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


@router.get("/cards/{card_id}/pdf")
def card_pdf(
    card_id: int,
    db: Session = Depends(get_db),
    principal: CurrentPrincipal = Depends(require_permission("card:verify")),
):
    import qrcode
    from pathlib import Path
    from reportlab.lib.pagesizes import landscape
    from reportlab.lib.units import mm
    from reportlab.lib.utils import ImageReader
    from reportlab.pdfgen import canvas
    from app.models.entities import Classroom, School
    from app.services.qr_service import generate_qr_payload

    assert_card_scope(db, principal, card_id)
    card = db.get(Card, card_id)
    student = db.get(Student, card.student_id)
    school = db.get(School, student.current_school_id) if student.current_school_id else None
    classroom = db.get(Classroom, student.current_classroom_id) if student.current_classroom_id else None
    output = BytesIO()
    page_size = landscape((54 * mm, 85.6 * mm))
    pdf = canvas.Canvas(output, pagesize=page_size)
    pdf.setFillColorRGB(0.07, 0.23, 0.36)
    pdf.rect(0, 0, page_size[0], page_size[1], fill=1, stroke=0)
    pdf.setFillColorRGB(1, 1, 1)
    pdf.setFont("Helvetica-Bold", 13)
    pdf.drawString(8 * mm, 44 * mm, "EDUCARD SECURE")
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(8 * mm, 32 * mm, f"{student.last_name} {student.first_name}")
    pdf.setFont("Helvetica", 8)
    pdf.drawString(8 * mm, 25 * mm, f"Matricule: {student.student_number}")
    pdf.drawString(8 * mm, 19 * mm, f"Carte: {card.serial_number}")
    pdf.drawString(8 * mm, 13 * mm, f"Statut: {card.status}")
    if school:
        pdf.drawString(8 * mm, 7 * mm, school.name[:42])

    photo_root = Path(__file__).resolve().parents[3] / "storage" / "student_photos"
    photo_files = list(photo_root.glob(f"{student.id}.*"))
    if photo_files:
        pdf.drawImage(ImageReader(str(photo_files[0])), 60 * mm, 25 * mm, 17 * mm, 22 * mm, preserveAspectRatio=True, anchor="c", mask="auto")

    if card.status == "ACTIVE":
        qr_payload = generate_qr_payload(db, card.id, 10, principal)["payload"]
        qr_image = qrcode.make(qr_payload)
        qr_buffer = BytesIO()
        qr_image.save(qr_buffer, format="PNG")
        qr_buffer.seek(0)
        pdf.drawImage(ImageReader(qr_buffer), 61 * mm, 3 * mm, 18 * mm, 18 * mm, preserveAspectRatio=True, mask="auto")
    if classroom:
        pdf.setFont("Helvetica", 7)
        pdf.drawRightString(79 * mm, 22 * mm, classroom.label[:24])
    pdf.save()
    append_audit_event(db, principal, "CARD_PDF_GENERATED", "card", card.public_id, severity="HIGH")
    db.commit()
    return Response(output.getvalue(), media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="carte-{student.student_number}.pdf"'})

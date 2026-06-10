import base64
import json
from datetime import datetime
from uuid import uuid4

import pyotp
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.models.entities import AdministrativeValidation, Card, Region, Student, MfaMethod, Role, User, UserRole, UserScope
from app.security.crypto import encrypt_text
from app.security.passwords import hash_password
from app.services.security_events import record_security_event
from app.services.qr_service import load_public_key


client = TestClient(app)


def _login_super_admin() -> str:
    secret = pyotp.random_base32()
    username = f"v2_{uuid4().hex[:8]}"
    with SessionLocal() as db:
        role = db.execute(select(Role).where(Role.code == "SUPER_ADMIN_TECHNIQUE")).scalar_one_or_none()
        if role is None:
            role = Role(code="SUPER_ADMIN_TECHNIQUE", label="Super administrateur", is_privileged=True)
            db.add(role)
            db.flush()
        user = User(
            public_id=str(uuid4()),
            username=username,
            display_name="Administrateur V2 fictif",
            password_hash=hash_password("Volume2Pass!123"),
            status="ACTIVE",
            mfa_required=True,
            is_demo=True,
        )
        db.add(user)
        db.flush()
        db.add(UserRole(user_id=user.id, role_id=role.id))
        db.add(UserScope(user_id=user.id, scope_type="NATIONAL"))
        db.add(
            MfaMethod(
                user_id=user.id,
                method_type="TOTP",
                secret_encrypted=encrypt_text(secret),
                enabled_at=datetime.utcnow(),
            )
        )
        db.commit()
    response = client.post(
        "/api/v1/auth/login",
        json={
            "username": username,
            "password": "Volume2Pass!123",
            "mfa_code": pyotp.TOTP(secret).now(),
        },
        headers={"User-Agent": "EduCard-Test/2.0 Windows"},
    )
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_session_preferences_and_audit_filters() -> None:
    csrf = _login_super_admin()
    sessions = client.get("/api/v1/auth/sessions")
    assert sessions.status_code == 200
    assert sessions.json()[0]["is_current"] is True
    assert sessions.json()[0]["session_id"].startswith("sess_")
    assert "token" not in sessions.json()[0]

    updated = client.patch(
        "/api/v1/auth/me",
        json={"preferred_theme": "dark"},
        headers={"X-CSRF-Token": csrf},
    )
    assert updated.status_code == 200
    assert client.get("/api/v1/auth/me").json()["preferred_theme"] == "dark"

    audit = client.get("/api/v1/audit?page=1&per_page=25&severity=INFO")
    assert audit.status_code == 200
    assert {"items", "total", "page", "pages", "per_page"} <= audit.json().keys()
    if audit.json()["items"]:
        event_id = audit.json()["items"][0]["id"]
        verification = client.get(f"/api/v1/audit/{event_id}/verify")
        assert verification.status_code == 200
        assert verification.json()["status"] in {"OK", "BROKEN"}


def test_alert_and_incident_workflows() -> None:
    csrf = _login_super_admin()
    with SessionLocal() as db:
        user = db.execute(select(User).where(User.username.like("v2_%")).order_by(User.id.desc())).scalars().first()
        record_security_event(db, "VOLUME2_ALERT_TEST", "CRITICAL", user.id, "test", str(uuid4()))
        db.commit()

    alerts = client.get("/api/v1/alerts")
    assert alerts.status_code == 200
    target = next(item for item in alerts.json() if item["event_type"] == "VOLUME2_ALERT_TEST")
    acknowledged = client.post(
        f"/api/v1/alerts/{target['id']}/acknowledge",
        json={"comment": "Analyse initiale effectuee par le test automatise"},
        headers={"X-CSRF-Token": csrf},
    )
    assert acknowledged.status_code == 200
    assert acknowledged.json()["status"] == "ACKNOWLEDGED"
    resolved = client.post(
        f"/api/v1/alerts/{target['id']}/resolve",
        json={"resolution_note": "Alerte fictive resolue apres verification complete"},
        headers={"X-CSRF-Token": csrf},
    )
    assert resolved.status_code == 200
    assert resolved.json()["status"] == "RESOLVED"

    created = client.post(
        "/api/v1/incidents",
        json={
            "title": "Incident Volume 2 fictif",
            "category": "TECHNICAL_INCIDENT",
            "priority": "HIGH",
            "severity": "HIGH",
            "description": "Incident entierement fictif cree pour valider le workflow detaille.",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert created.status_code == 200
    incident_id = created.json()["id"]
    detail = client.get(f"/api/v1/incidents/{incident_id}")
    assert detail.status_code == 200
    assert detail.json()["timeline"]
    transitioned = client.post(
        f"/api/v1/incidents/{incident_id}/transition",
        json={"new_status": "IN_PROGRESS", "comment": "Prise en charge par le test automatise"},
        headers={"X-CSRF-Token": csrf},
    )
    assert transitioned.status_code == 200
    assert transitioned.json()["status"] == "IN_PROGRESS"


def test_validation_updates_reference_status() -> None:
    csrf = _login_super_admin()
    suffix = uuid4().hex[:8].upper()
    created = client.post(
        "/api/v1/school-map/regions",
        json={
            "code": f"V2-{suffix}",
            "name": f"Region fictive {suffix}",
            "capital": "Chef-lieu fictif",
            "submit_for_validation": True,
            "justification": "Creation fictive soumise au workflow hierarchique",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert created.status_code == 201
    with SessionLocal() as db:
        region = db.get(Region, created.json()["id"])
        assert region.status == "PENDING_VALIDATION"
        validation = db.execute(
            select(AdministrativeValidation)
            .where(AdministrativeValidation.entity_type == "REGION", AdministrativeValidation.entity_id == region.id)
        ).scalar_one()
        validation_id = validation.id
    approved = client.post(
        f"/api/v1/admin/validations/{validation_id}/approve",
        json={"comment": "Validation fictive par le niveau central"},
        headers={"X-CSRF-Token": csrf},
    )
    assert approved.status_code == 200
    with SessionLocal() as db:
        assert db.get(Region, created.json()["id"]).status == "ACTIVE"


def test_signed_portability_export() -> None:
    csrf = _login_super_admin()
    with SessionLocal() as db:
        student = db.execute(
            select(Student).where(Student.current_school_id.is_not(None)).order_by(Student.id)
        ).scalars().first()
        assert student is not None
        student_id = student.id
        student_public_id = student.public_id

    response = client.post(
        "/api/v1/exports/portability",
        json={
            "student_id": student_id,
            "reason": "Demande fictive de portabilite pour validation automatisee",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    package = response.json()
    assert package["document"]["student"]["public_id"] == student_public_id
    assert "id" not in package["document"]["student"]
    canonical = json.dumps(
        package["document"],
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    signature = package["integrity"]["signature"]
    signature += "=" * (-len(signature) % 4)
    public_key: Ed25519PublicKey = load_public_key()
    public_key.verify(base64.urlsafe_b64decode(signature), canonical)
    assert response.headers["X-Export-Checksum"] == package["integrity"]["checksum_sha256"]


def test_card_pdf_contains_fresh_print_qr() -> None:
    _login_super_admin()
    with SessionLocal() as db:
        card = db.execute(select(Card).where(Card.status == "ACTIVE").order_by(Card.id)).scalars().first()
        assert card is not None
        card_id = card.id
    response = client.get(f"/api/v1/cards/{card_id}/pdf")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/pdf")
    assert response.content.startswith(b"%PDF")
    assert len(response.content) > 2_000

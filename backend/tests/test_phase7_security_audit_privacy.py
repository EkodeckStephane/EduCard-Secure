from datetime import datetime
from uuid import uuid4

import pyotp
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.models.entities import AuditEvent, MfaMethod, Role, SecurityEvent, User, UserRole, UserScope
from app.security.crypto import encrypt_text
from app.security.passwords import hash_password
from app.services.audit_service import rebuild_audit_hashes_for_demo, verify_audit_chain
from app.services.security_events import record_security_event


client = TestClient(app)


def _role(db, code: str) -> Role:
    role = db.execute(select(Role).where(Role.code == code)).scalar_one_or_none()
    if role:
        return role
    role = Role(code=code, label=code, is_privileged=code in {"SUPER_ADMIN_TECHNIQUE", "ADMINISTRATION_CENTRALE", "AUDITEUR_SECURITE"})
    db.add(role)
    db.flush()
    return role


def _user(db, roles: list[str], mfa_secret: str | None = None) -> User:
    username = f"p7_{uuid4().hex[:8]}"
    user = User(public_id=str(uuid4()), username=username, display_name=username, password_hash=hash_password("Phase7Pass!123"), status="ACTIVE", mfa_required=bool(mfa_secret), is_demo=True)
    db.add(user)
    db.flush()
    for code in roles:
        db.add(UserRole(user_id=user.id, role_id=_role(db, code).id))
    db.add(UserScope(user_id=user.id, scope_type="NATIONAL"))
    if mfa_secret:
        db.add(MfaMethod(user_id=user.id, method_type="TOTP", secret_encrypted=encrypt_text(mfa_secret), enabled_at=datetime.utcnow()))
    return user


def _login(roles: list[str], mfa: bool = False) -> str:
    secret = pyotp.random_base32() if mfa else None
    with SessionLocal() as db:
        user = _user(db, roles, secret)
        username = user.username
        db.commit()
    payload = {"username": username, "password": "Phase7Pass!123"}
    if secret:
        payload["mfa_code"] = pyotp.TOTP(secret).now()
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_audit_chain_append_only_and_tamper_detection() -> None:
    with SessionLocal() as db:
        rebuild_audit_hashes_for_demo(db)
        db.commit()
    csrf = _login(["AUDITEUR_SECURITE"], mfa=True)
    created = client.post(
        "/api/v1/audit/events",
        json={"action": "PHASE7_TEST", "resource_type": "test", "result": "SUCCESS", "severity": "HIGH", "justification": "test chaine audit"},
        headers={"X-CSRF-Token": csrf},
    )
    assert created.status_code == 200
    ok = client.get("/api/v1/audit/integrity")
    assert ok.status_code == 200
    assert ok.json()["status"] == "OK"

    with SessionLocal() as db:
        event = db.get(AuditEvent, created.json()["id"])
        original = event.action
        event.action = "TAMPERED"
        db.commit()
    broken = client.get("/api/v1/audit/integrity")
    assert broken.status_code == 200
    assert broken.json()["status"] == "BROKEN"
    with SessionLocal() as db:
        event = db.get(AuditEvent, created.json()["id"])
        event.action = original
        db.commit()
        assert verify_audit_chain(db)["status"] == "OK"


def test_alert_incident_privacy_retention_and_security_headers() -> None:
    csrf = _login(["AUDITEUR_SECURITE"], mfa=True)
    with SessionLocal() as db:
        user = db.execute(select(User).where(User.username.like("p7_%")).order_by(User.id.desc())).scalars().first()
        record_security_event(db, "QR_INVALID", "HIGH", user.id, "card", "demo-card")
        db.commit()

    health = client.get("/health")
    assert health.headers["X-Frame-Options"] == "DENY"
    assert health.headers["X-Content-Type-Options"] == "nosniff"

    alerts = client.get("/api/v1/alerts")
    assert alerts.status_code == 200
    assert alerts.json()
    ack = client.post(f"/api/v1/alerts/{alerts.json()[0]['id']}/ack", headers={"X-CSRF-Token": csrf})
    assert ack.status_code == 200

    incident = client.post("/api/v1/incidents", json={"category": "DEMO_SECURITY", "priority": "HIGH", "severity": "HIGH", "comment": "Incident fictif"}, headers={"X-CSRF-Token": csrf})
    assert incident.status_code == 200
    updated = client.patch(f"/api/v1/incidents/{incident.json()['id']}", json={"status": "RESOLVED", "comment": "Resolution fictive"}, headers={"X-CSRF-Token": csrf})
    assert updated.status_code == 200

    privacy = client.post("/api/v1/privacy/requests", json={"request_type": "ACCESS", "subject_type": "STUDENT"}, headers={"X-CSRF-Token": csrf})
    assert privacy.status_code == 200
    register = client.post(
        "/api/v1/privacy/register",
        json={"processing_name": f"Phase7 Register {uuid4().hex}", "purpose": "Demo privacy", "data_categories": "Synthetic data"},
        headers={"X-CSRF-Token": csrf},
    )
    assert register.status_code == 200
    assert register.json()["requires_legal_validation"] is True
    retention = client.post("/api/v1/privacy/retention", json={"resource_type": f"phase7-{uuid4().hex}", "retention_period_days": 30}, headers={"X-CSRF-Token": csrf})
    assert retention.status_code == 200

    with SessionLocal() as db:
        events = db.execute(select(SecurityEvent).where(SecurityEvent.event_type.in_(["ALERT_ACKNOWLEDGED", "RETENTION_RULE_CREATED"]))).scalars().all()
        assert events


def test_csrf_and_injection_like_input_are_rejected_or_safe() -> None:
    _login(["AUDITEUR_SECURITE"], mfa=True)
    no_csrf = client.post("/api/v1/incidents", json={"category": "X", "priority": "LOW", "severity": "LOW"})
    assert no_csrf.status_code == 403
    events = client.get("/api/v1/audit/events", params={"action": "' OR 1=1 --"})
    assert events.status_code == 200
    assert events.json() == []

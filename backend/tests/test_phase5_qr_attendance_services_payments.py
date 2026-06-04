import base64
import json
from datetime import date, datetime, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.models.entities import (
    Card,
    Classroom,
    Department,
    GradeLevel,
    PaymentProvider,
    Region,
    Role,
    School,
    SchoolYear,
    SecurityEvent,
    ServiceProvider,
    ServiceType,
    SigningKeyVersion,
    Student,
    Subdivision,
    User,
    UserRole,
    UserScope,
)
from app.security.passwords import hash_password
from app.services.qr_service import generate_dev_keys


client = TestClient(app)


def _role(db, code: str) -> Role:
    role = db.execute(select(Role).where(Role.code == code)).scalar_one_or_none()
    if role:
        return role
    role = Role(code=code, label=code, is_privileged=False)
    db.add(role)
    db.flush()
    return role


def _create_user(db, username: str, roles: list[str]) -> User:
    user = User(public_id=str(uuid4()), username=username, display_name=username, password_hash=hash_password("Phase5Pass!123"), status="ACTIVE", is_demo=True)
    db.add(user)
    db.flush()
    for code in roles:
        db.add(UserRole(user_id=user.id, role_id=_role(db, code).id))
    return user


def _fixture(db):
    suffix = uuid4().hex[:8]
    region = Region(code=f"P5-R-{suffix}", name="Phase 5 Region Demo", is_demo=True)
    db.add(region)
    db.flush()
    dept = Department(region_id=region.id, code=f"P5-D-{suffix}", name="Phase 5 Dept", is_demo=True)
    other_dept = Department(region_id=region.id, code=f"P5-OD-{suffix}", name="Phase 5 Other Dept", is_demo=True)
    db.add_all([dept, other_dept])
    db.flush()
    subdivision = Subdivision(department_id=dept.id, code=f"P5-S-{suffix}", name="Phase 5 Sub", is_demo=True)
    other_subdivision = Subdivision(department_id=other_dept.id, code=f"P5-OS-{suffix}", name="Phase 5 Other Sub", is_demo=True)
    db.add_all([subdivision, other_subdivision])
    db.flush()
    school = School(public_id=str(uuid4()), subdivision_id=subdivision.id, code=f"P5-SCH-{suffix}", name="Phase 5 School Demo", school_type="DEMO", education_subsystem="DEMO", status="ACTIVE", is_demo=True)
    other_school = School(public_id=str(uuid4()), subdivision_id=other_subdivision.id, code=f"P5-OTH-{suffix}", name="Phase 5 Other School Demo", school_type="DEMO", education_subsystem="DEMO", status="ACTIVE", is_demo=True)
    db.add_all([school, other_school])
    db.flush()
    school_year = SchoolYear(code=f"P5-Y-{suffix}", starts_on=date(2099, 9, 1), ends_on=date(2100, 7, 31), status="PLANNED")
    grade = GradeLevel(code=f"P5-G-{suffix}", label="Phase 5 Grade", education_subsystem="DEMO", sort_order=5)
    db.add_all([school_year, grade])
    db.flush()
    classroom = Classroom(school_id=school.id, school_year_id=school_year.id, grade_level_id=grade.id, code=f"P5-C-{suffix}", label="Phase 5 Class", is_demo=True)
    db.add(classroom)
    db.flush()
    student = Student(public_id=str(uuid4()), student_number=f"P5-STU-{suffix}", last_name="Qr", first_name="Demo", birth_date=date(2012, 1, 1), status="ACTIVE", current_school_id=school.id, current_classroom_id=classroom.id, is_demo=True)
    other_student = Student(public_id=str(uuid4()), student_number=f"P5-OSTU-{suffix}", last_name="Out", first_name="Scope", birth_date=date(2012, 1, 2), status="ACTIVE", current_school_id=other_school.id, is_demo=True)
    db.add_all([student, other_student])
    db.flush()
    card = Card(public_id=str(uuid4()), student_id=student.id, serial_number=f"P5-CARD-{suffix}", status="ACTIVE", card_version=1, activated_at=datetime.utcnow(), is_demo=True)
    suspended = Card(public_id=str(uuid4()), student_id=student.id, serial_number=f"P5-SUSP-{suffix}", status="SUSPENDED", card_version=1, is_demo=True)
    revoked = Card(public_id=str(uuid4()), student_id=student.id, serial_number=f"P5-REV-{suffix}", status="REVOKED", card_version=1, is_demo=True)
    other_card = Card(public_id=str(uuid4()), student_id=other_student.id, serial_number=f"P5-OCARD-{suffix}", status="ACTIVE", card_version=1, is_demo=True)
    db.add_all([card, suspended, revoked, other_card])
    service_type = ServiceType(code=f"P5-SPORT-{suffix}", label="Sport Demo", description="Demo")
    service_provider = ServiceProvider(public_id=str(uuid4()), name=f"Provider Demo {suffix}", provider_type="MOCK", is_mock=True)
    db.add_all([service_type, service_provider])
    for code in ["MOCK_MOMO", "MOCK_ORANGE", "MOCK_BANK", "MOCK_CASH"]:
        if not db.execute(select(PaymentProvider).where(PaymentProvider.code == code)).scalar_one_or_none():
            db.add(PaymentProvider(code=code, label=code, provider_type="MOCK", status="ACTIVE", is_mock=True))
    db.flush()
    return school, other_school, school_year, student, card, suspended, revoked, other_card, service_type, service_provider


def _login_for_school(school_id: int, roles: list[str] | None = None):
    username = f"p5_{uuid4().hex[:8]}"
    with SessionLocal() as db:
        user = _create_user(db, username, roles or ["RESPONSABLE_ETABLISSEMENT", "AGENT_CARTE", "AGENT_PRESENCE", "AGENT_SERVICE", "AGENT_FINANCE"])
        db.add(UserScope(user_id=user.id, scope_type="SCHOOL", school_id=school_id))
        db.commit()
    response = client.post("/api/v1/auth/login", json={"username": username, "password": "Phase5Pass!123"})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def _decode_payload(payload: str) -> dict:
    padding = "=" * (-len(payload) % 4)
    return json.loads(base64.urlsafe_b64decode(payload + padding))


def _encode_payload(data: dict) -> str:
    return base64.urlsafe_b64encode(json.dumps(data, separators=(",", ":"), sort_keys=True).encode()).decode().rstrip("=")


def test_qr_signed_verification_statuses_and_key_revocation() -> None:
    generate_dev_keys(overwrite=True)
    with SessionLocal() as db:
        school, _, _, _, card, suspended, revoked, _, _, _ = _fixture(db)
        db.commit()
    csrf = _login_for_school(school.id)

    generated = client.post(f"/api/v1/cards/{card.id}/qr/generate", json={"ttl_minutes": 30}, headers={"X-CSRF-Token": csrf})
    assert generated.status_code == 200
    payload = generated.json()["payload"]
    valid = client.post("/api/v1/cards/verify", json={"payload": payload})
    assert valid.status_code == 200
    assert valid.json()["result"] == "valide"

    tampered = _decode_payload(payload)
    tampered["card_id"] = suspended.id
    invalid = client.post("/api/v1/cards/verify", json={"payload": _encode_payload(tampered)})
    assert invalid.status_code == 200
    assert invalid.json()["result"] == "signature invalide"

    for card_obj, expected in [(suspended, "carte suspendue"), (revoked, "carte revoquee")]:
        with SessionLocal() as db:
            active = db.get(Card, card_obj.id)
            old = active.status
            active.status = "ACTIVE"
            db.commit()
        gen = client.post(f"/api/v1/cards/{card_obj.id}/qr/generate", json={"ttl_minutes": 30}, headers={"X-CSRF-Token": csrf})
        assert gen.status_code == 200
        with SessionLocal() as db:
            db.get(Card, card_obj.id).status = old
            db.commit()
        checked = client.post("/api/v1/cards/verify", json={"payload": gen.json()["payload"]})
        assert checked.status_code == 200
        assert checked.json()["result"] == expected

    unknown = _decode_payload(payload)
    unknown["key_version"] = "unknown-key"
    assert client.post("/api/v1/cards/verify", json={"payload": _encode_payload(unknown)}).json()["result"] in {"cle inconnue", "signature invalide"}

    with SessionLocal() as db:
        key = db.execute(select(SigningKeyVersion).where(SigningKeyVersion.key_version == generated.json()["key_version"])).scalar_one()
        key.status = "REVOKED"
        db.commit()
    revoked_key = client.post("/api/v1/cards/verify", json={"payload": payload})
    assert revoked_key.status_code == 200
    assert revoked_key.json()["result"] == "cle revoquee"


def test_attendance_services_mock_payments_scope_and_audit() -> None:
    generate_dev_keys(overwrite=True)
    with SessionLocal() as db:
        school, other_school, school_year, student, card, _, _, other_card, service_type, service_provider = _fixture(db)
        db.commit()
    csrf = _login_for_school(school.id)

    check_in = client.post(
        "/api/v1/attendance/check-in",
        json={"card_id": card.id, "school_id": school.id, "event_type": "ENTRY", "source": "CARD"},
        headers={"X-CSRF-Token": csrf},
    )
    assert check_in.status_code == 200
    duplicate = client.post(
        "/api/v1/attendance/check-in",
        json={"card_id": card.id, "school_id": school.id, "event_type": "ENTRY", "source": "CARD"},
        headers={"X-CSRF-Token": csrf},
    )
    assert duplicate.status_code == 200
    assert duplicate.json()["id"] == check_in.json()["id"]

    correction = client.post(f"/api/v1/attendance/{check_in.json()['id']}/correct", json={"new_value": "LATE", "reason": "Correction demo"}, headers={"X-CSRF-Token": csrf})
    assert correction.status_code == 200
    approved = client.post(f"/api/v1/attendance/{check_in.json()['id']}/approve-correction", headers={"X-CSRF-Token": csrf})
    assert approved.status_code == 200
    assert approved.json()["approved_at"] is not None

    entitlement = client.post(
        "/api/v1/services/entitlements",
        json={
            "student_id": student.id,
            "service_type_id": service_type.id,
            "service_provider_id": service_provider.id,
            "valid_from": (datetime.utcnow() - timedelta(days=1)).isoformat(),
            "valid_until": (datetime.utcnow() + timedelta(days=1)).isoformat(),
            "status": "ACTIVE",
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert entitlement.status_code == 200
    allowed = client.post("/api/v1/services/verify", json={"student_id": student.id, "service_type_id": service_type.id, "card_id": card.id})
    assert allowed.status_code == 200
    assert allowed.json()["result"] == "ALLOWED"
    denied = client.post("/api/v1/services/verify", json={"student_id": student.id, "service_type_id": 999999})
    assert denied.status_code == 200
    assert denied.json()["result"] == "DENIED"

    payment_payload = {
        "provider_code": "MOCK_MOMO",
        "idempotency_key": f"idem-{uuid4().hex}",
        "amount": 1500,
        "category": "DEMO_FEES",
        "school_id": school.id,
        "school_year_id": school_year.id,
        "student_id": student.id,
        "reason": "Paiement fictif",
    }
    payment = client.post("/api/v1/payments/mock", json=payment_payload, headers={"X-CSRF-Token": csrf})
    assert payment.status_code == 200
    replay = client.post("/api/v1/payments/mock", json=payment_payload, headers={"X-CSRF-Token": csrf})
    assert replay.status_code == 200
    assert replay.json()["id"] == payment.json()["id"]
    reconciled = client.post(f"/api/v1/payments/{payment.json()['id']}/reconcile", json={"notes": "Rapprochement fictif"}, headers={"X-CSRF-Token": csrf})
    assert reconciled.status_code == 200

    outside = client.post("/api/v1/attendance/check-in", json={"card_id": other_card.id, "school_id": other_school.id, "event_type": "ENTRY", "source": "CARD"}, headers={"X-CSRF-Token": csrf})
    assert outside.status_code in {403, 404}

    with SessionLocal() as db:
        events = db.execute(select(SecurityEvent).where(SecurityEvent.event_type.in_(["QR_VERIFIED", "ATTENDANCE_RECORDED", "SERVICE_VERIFIED", "PAYMENT_MOCK_CREATED", "PAYMENT_RECONCILED"]))).scalars().all()
        assert len(events) >= 5

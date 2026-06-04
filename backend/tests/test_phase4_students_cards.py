from datetime import date, datetime
from uuid import uuid4

import pyotp
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.core.database import SessionLocal
from app.models.entities import (
    Card,
    Classroom,
    Department,
    GradeLevel,
    Region,
    School,
    SchoolYear,
    SecurityEvent,
    Subdivision,
    Role,
    User,
    UserRole,
    UserScope,
)
from app.security.crypto import encrypt_text
from app.security.passwords import hash_password
from app.models.entities import MfaMethod


client = TestClient(app)


def _role(db, code: str) -> Role:
    role = db.execute(select(Role).where(Role.code == code)).scalar_one_or_none()
    if role:
        return role
    role = Role(code=code, label=code, is_privileged=code in {"SUPER_ADMIN_TECHNIQUE", "ADMINISTRATION_CENTRALE", "AUDITEUR_SECURITE"})
    db.add(role)
    db.flush()
    return role


def _create_user(db, username: str, password: str, roles: list[str], mfa_secret: str | None = None) -> User:
    user = User(
        public_id=str(uuid4()),
        username=username,
        display_name=f"Demo {username}",
        password_hash=hash_password(password),
        status="ACTIVE",
        mfa_required=bool(mfa_secret),
        is_demo=True,
    )
    db.add(user)
    db.flush()
    for code in roles:
        db.add(UserRole(user_id=user.id, role_id=_role(db, code).id))
    if mfa_secret:
        db.add(MfaMethod(user_id=user.id, method_type="TOTP", secret_encrypted=encrypt_text(mfa_secret), enabled_at=datetime.utcnow()))
    return user


def _fixture(db):
    suffix = uuid4().hex[:8]
    region = Region(code=f"P4-R-{suffix}", name="Phase 4 Region Demo", is_demo=True)
    db.add(region)
    db.flush()
    dept = Department(region_id=region.id, code=f"P4-D-{suffix}", name="Phase 4 Dept", is_demo=True)
    other_dept = Department(region_id=region.id, code=f"P4-OD-{suffix}", name="Phase 4 Other Dept", is_demo=True)
    db.add_all([dept, other_dept])
    db.flush()
    subdivision = Subdivision(department_id=dept.id, code=f"P4-S-{suffix}", name="Phase 4 Sub", is_demo=True)
    other_subdivision = Subdivision(department_id=other_dept.id, code=f"P4-OS-{suffix}", name="Phase 4 Other Sub", is_demo=True)
    db.add_all([subdivision, other_subdivision])
    db.flush()
    school = School(public_id=str(uuid4()), subdivision_id=subdivision.id, code=f"P4-SCH-{suffix}", name="Phase 4 Lycee Demo", school_type="DEMO", education_subsystem="DEMO", status="ACTIVE", is_demo=True)
    other_school = School(public_id=str(uuid4()), subdivision_id=other_subdivision.id, code=f"P4-OTH-{suffix}", name="Phase 4 Other Lycee Demo", school_type="DEMO", education_subsystem="DEMO", status="ACTIVE", is_demo=True)
    db.add_all([school, other_school])
    db.flush()
    school_year = SchoolYear(code=f"2099-{suffix}", starts_on=date(2099, 9, 1), ends_on=date(2100, 7, 31), status="PLANNED")
    grade = GradeLevel(code=f"P4-G-{suffix}", label="Phase 4 Grade Demo", education_subsystem="DEMO", sort_order=99)
    db.add_all([school_year, grade])
    db.flush()
    classroom = Classroom(school_id=school.id, school_year_id=school_year.id, grade_level_id=grade.id, code=f"P4-C-{suffix}", label="Phase 4 Classe Demo", is_demo=True)
    other_classroom = Classroom(school_id=other_school.id, school_year_id=school_year.id, grade_level_id=grade.id, code=f"P4-OC-{suffix}", label="Phase 4 Autre Classe Demo", is_demo=True)
    db.add_all([classroom, other_classroom])
    db.flush()
    return school, other_school, school_year, classroom, other_classroom


def _admin_login():
    username = f"p4_admin_{uuid4().hex[:8]}"
    password = "Phase4Admin!123"
    secret = pyotp.random_base32()
    with SessionLocal() as db:
        user = _create_user(db, username, password, ["ADMINISTRATION_CENTRALE"], secret)
        db.add(UserScope(user_id=user.id, scope_type="NATIONAL"))
        db.commit()
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password, "mfa_code": pyotp.TOTP(secret).now()})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def _school_user_login(school_id: int):
    username = f"p4_school_{uuid4().hex[:8]}"
    password = "Phase4School!123"
    with SessionLocal() as db:
        user = _create_user(db, username, password, ["RESPONSABLE_ETABLISSEMENT"])
        db.add(UserScope(user_id=user.id, scope_type="SCHOOL", school_id=school_id))
        db.commit()
    response = client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_student_creation_search_pagination_duplicates_archive_and_history() -> None:
    csrf = _admin_login()
    with SessionLocal() as db:
        school, _, _, classroom, _ = _fixture(db)
        db.commit()

    payload = {
        "last_name": "Demo",
        "first_name": "Alice",
        "birth_date": "2012-04-05",
        "school_id": school.id,
        "classroom_id": classroom.id,
        "guardian_display_name": "Parent Demo",
    }
    created = client.post("/api/v1/students", json=payload, headers={"X-CSRF-Token": csrf})
    assert created.status_code == 201
    student = created.json()
    assert student["student_number"].startswith("EDU-")

    duplicate = client.post("/api/v1/students", json=payload | {"first_name": "Alice"}, headers={"X-CSRF-Token": csrf})
    assert duplicate.status_code == 201
    assert duplicate.json()["student_number"] != student["student_number"]

    search = client.get("/api/v1/students", params={"q": "Alice", "page": 1, "page_size": 1})
    assert search.status_code == 200
    assert search.json()["total"] >= 2
    assert len(search.json()["items"]) == 1

    candidates = client.get(f"/api/v1/students/{student['id']}/duplicate-candidates")
    assert candidates.status_code == 200
    assert candidates.json()[0]["score"] >= 90

    stale = client.patch(f"/api/v1/students/{student['id']}", json={"record_version": 999, "first_name": "Alicia"}, headers={"X-CSRF-Token": csrf})
    assert stale.status_code == 409

    updated = client.patch(f"/api/v1/students/{student['id']}", json={"record_version": student["record_version"], "first_name": "Alicia"}, headers={"X-CSRF-Token": csrf})
    assert updated.status_code == 200
    assert updated.json()["record_version"] == student["record_version"] + 1

    archived = client.post(f"/api/v1/students/{student['id']}/archive", headers={"X-CSRF-Token": csrf})
    assert archived.status_code == 200
    assert archived.json()["status"] == "ARCHIVED"

    history = client.get(f"/api/v1/students/{student['id']}/history")
    assert history.status_code == 200
    assert any(row["new_status"] == "ARCHIVED" for row in history.json())

    export = client.get(f"/api/v1/students/{student['id']}/export")
    assert export.status_code == 200
    assert export.json()["demo_only"] is True


def test_enrollment_transfer_card_lifecycle_scope_and_logging() -> None:
    csrf = _admin_login()
    with SessionLocal() as db:
        school, other_school, school_year, classroom, other_classroom = _fixture(db)
        db.commit()

    created = client.post(
        "/api/v1/students",
        json={"last_name": "Carte", "first_name": "Bruno", "birth_date": "2011-01-02", "school_id": school.id, "classroom_id": classroom.id},
        headers={"X-CSRF-Token": csrf},
    )
    assert created.status_code == 201
    student = created.json()

    enrollment = client.post(
        "/api/v1/enrollments",
        json={"student_id": student["id"], "school_id": school.id, "classroom_id": classroom.id, "school_year_id": school_year.id, "status": "ACTIVE"},
        headers={"X-CSRF-Token": csrf},
    )
    assert enrollment.status_code == 201

    transfer = client.post(
        "/api/v1/transfers",
        json={"student_id": student["id"], "to_school_id": other_school.id, "to_classroom_id": other_classroom.id, "comment": "Transfert demo"},
        headers={"X-CSRF-Token": csrf},
    )
    assert transfer.status_code == 201
    assert transfer.json()["to_school_id"] == other_school.id

    requested = client.post("/api/v1/cards", json={"student_id": student["id"], "reason": "Emission demo"}, headers={"X-CSRF-Token": csrf})
    assert requested.status_code == 201
    card = requested.json()
    assert card["status"] == "REQUESTED"

    for action, expected in [("activate", "ACTIVE"), ("suspend", "SUSPENDED"), ("reactivate", "ACTIVE"), ("revoke", "REVOKED"), ("replace", "REPLACED")]:
        response = client.post(f"/api/v1/cards/{card['id']}/{action}", json={"reason": f"{action} demo"}, headers={"X-CSRF-Token": csrf})
        assert response.status_code == 200
        card = response.json()
        assert card["status"] == expected

    history = client.get(f"/api/v1/cards/{card['id']}/history")
    assert history.status_code == 200
    assert len(history.json()["status_history"]) >= 5

    school_csrf = _school_user_login(school.id)
    denied = client.get(f"/api/v1/students/{student['id']}")
    assert denied.status_code == 403
    denied_card = client.post(f"/api/v1/cards/{card['id']}/suspend", json={"reason": "denied"}, headers={"X-CSRF-Token": school_csrf})
    assert denied_card.status_code in {403, 401}

    with SessionLocal() as db:
        assert db.execute(select(Card).where(Card.id == card["id"])).scalar_one().status == "REPLACED"
        event_count = db.execute(select(SecurityEvent).where(SecurityEvent.event_type.in_(["STUDENT_VIEWED", "CARD_REPLACED"]))).scalars().all()
        assert event_count

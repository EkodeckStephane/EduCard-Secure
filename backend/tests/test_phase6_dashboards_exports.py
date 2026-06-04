from datetime import date, datetime
from uuid import uuid4

import pyotp
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.models.entities import (
    Card,
    Department,
    Export,
    ExportEvent,
    GradeLevel,
    MfaMethod,
    Region,
    Role,
    School,
    SchoolYear,
    SecurityEvent,
    Student,
    Subdivision,
    User,
    UserRole,
    UserScope,
)
from app.security.crypto import encrypt_text
from app.security.passwords import hash_password


client = TestClient(app)


def _role(db, code: str) -> Role:
    role = db.execute(select(Role).where(Role.code == code)).scalar_one_or_none()
    if role:
        return role
    role = Role(code=code, label=code, is_privileged=False)
    db.add(role)
    db.flush()
    return role


def _user(db, username: str, roles: list[str], mfa_secret: str | None = None) -> User:
    user = User(public_id=str(uuid4()), username=username, display_name=username, password_hash=hash_password("Phase6Pass!123"), status="ACTIVE", mfa_required=bool(mfa_secret), is_demo=True)
    db.add(user)
    db.flush()
    for code in roles:
        db.add(UserRole(user_id=user.id, role_id=_role(db, code).id))
    if mfa_secret:
        db.add(MfaMethod(user_id=user.id, method_type="TOTP", secret_encrypted=encrypt_text(mfa_secret), enabled_at=datetime.utcnow()))
    return user


def _fixture(db, students_count: int = 4):
    suffix = uuid4().hex[:8]
    region = Region(code=f"P6-R-{suffix}", name="Phase 6 Region", is_demo=True)
    db.add(region)
    db.flush()
    dept = Department(region_id=region.id, code=f"P6-D-{suffix}", name="Phase 6 Dept", is_demo=True)
    other_dept = Department(region_id=region.id, code=f"P6-OD-{suffix}", name="Phase 6 Other Dept", is_demo=True)
    db.add_all([dept, other_dept])
    db.flush()
    subdivision = Subdivision(department_id=dept.id, code=f"P6-S-{suffix}", name="Phase 6 Sub", is_demo=True)
    other_subdivision = Subdivision(department_id=other_dept.id, code=f"P6-OS-{suffix}", name="Phase 6 Other Sub", is_demo=True)
    db.add_all([subdivision, other_subdivision])
    db.flush()
    school = School(public_id=str(uuid4()), subdivision_id=subdivision.id, code=f"P6-SCH-{suffix}", name="Phase 6 School", school_type="DEMO", education_subsystem="DEMO", status="ACTIVE", is_demo=True)
    other_school = School(public_id=str(uuid4()), subdivision_id=other_subdivision.id, code=f"P6-OTH-{suffix}", name="Phase 6 Other School", school_type="DEMO", education_subsystem="DEMO", status="ACTIVE", is_demo=True)
    year = SchoolYear(code=f"P6-Y-{suffix}", starts_on=date(2099, 9, 1), ends_on=date(2100, 7, 31), status="PLANNED")
    grade = GradeLevel(code=f"P6-G-{suffix}", label="Phase 6 Grade", education_subsystem="DEMO", sort_order=6)
    db.add_all([school, other_school, year, grade])
    db.flush()
    students = []
    for idx in range(students_count):
        student = Student(public_id=str(uuid4()), student_number=f"P6-STU-{suffix}-{idx}", last_name="Stats", first_name=f"Demo{idx}", birth_date=date(2012, 1, 1), status="ACTIVE", current_school_id=school.id, is_demo=True)
        db.add(student)
        db.flush()
        students.append(student)
        db.add(Card(public_id=str(uuid4()), student_id=student.id, serial_number=f"P6-CARD-{suffix}-{idx}", status="ACTIVE" if idx % 2 == 0 else "SUSPENDED", card_version=1, activated_at=datetime.utcnow(), is_demo=True))
    other_student = Student(public_id=str(uuid4()), student_number=f"P6-OTHER-{suffix}", last_name="Other", first_name="Scope", birth_date=date(2012, 1, 2), status="ACTIVE", current_school_id=other_school.id, is_demo=True)
    db.add(other_student)
    db.flush()
    return region, dept, school, other_school, year, students


def _login(scope_school_id: int, roles: list[str], mfa: bool = False):
    username = f"p6_{uuid4().hex[:8]}"
    secret = pyotp.random_base32() if mfa else None
    with SessionLocal() as db:
        user = _user(db, username, roles, secret)
        db.add(UserScope(user_id=user.id, scope_type="SCHOOL", school_id=scope_school_id))
        db.commit()
    payload = {"username": username, "password": "Phase6Pass!123"}
    if secret:
        payload["mfa_code"] = pyotp.TOTP(secret).now()
    response = client.post("/api/v1/auth/login", json=payload)
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_dashboard_aggregates_filters_scope_and_small_count_masking() -> None:
    with SessionLocal() as db:
        _, _, school, other_school, _, _ = _fixture(db, students_count=2)
        db.commit()
    _login(school.id, ["ANALYSTE_STATISTIQUE"])
    scoped = client.get("/api/v1/dashboard/summary", params={"school_id": school.id})
    assert scoped.status_code == 200
    metrics = scoped.json()["metrics"]
    assert metrics["active_students"] == "MASKED"
    assert metrics["schools"] == 1
    denied = client.get("/api/v1/dashboard/summary", params={"school_id": other_school.id})
    assert denied.status_code == 403
    cards = client.get("/api/v1/dashboard/cards", params={"school_id": school.id})
    assert cards.status_code == 200
    assert cards.json()["distribution"]


def test_exports_authorized_refused_download_logged_and_opaque() -> None:
    with SessionLocal() as db:
        _, _, school, _, _, students = _fixture(db, students_count=4)
        db.commit()
    csrf = _login(school.id, ["RESPONSABLE_ETABLISSEMENT"])
    payload = {"export_type": "DASHBOARD_SUMMARY", "format": "CSV", "reason": "Scenario export phase 6", "filters": {"school_id": school.id}}
    created = client.post("/api/v1/exports", json=payload, headers={"X-CSRF-Token": csrf})
    assert created.status_code == 200
    body = created.json()
    assert body["filename"].startswith("export_")
    assert body["filename"].endswith(".csv")
    assert "Stats" not in body["filename"]

    downloaded = client.post(f"/api/v1/exports/{body['id']}/download", headers={"X-CSRF-Token": csrf})
    assert downloaded.status_code == 200
    assert "metric,value" in downloaded.text
    assert "Stats" not in downloaded.text

    csrf_admin = _login(school.id, ["ADMINISTRATION_CENTRALE"], mfa=True)
    individual = client.post(
        "/api/v1/exports",
        json={"export_type": "INDIVIDUAL_STUDENT", "format": "CSV", "reason": "Export individuel controle", "student_id": students[0].id, "filters": {"school_id": school.id}},
        headers={"X-CSRF-Token": csrf_admin},
    )
    assert individual.status_code == 200

    csrf_limited = _login(school.id, ["AGENT_PRESENCE"])
    refused = client.post("/api/v1/exports", json=payload, headers={"X-CSRF-Token": csrf_limited})
    assert refused.status_code == 403

    with SessionLocal() as db:
        export_row = db.execute(select(Export).where(Export.public_id == body["public_id"])).scalar_one()
        assert export_row.status == "READY"
        assert db.execute(select(ExportEvent).where(ExportEvent.export_id == export_row.id)).scalars().all()
        events = db.execute(select(SecurityEvent).where(SecurityEvent.event_type.in_(["EXPORT_CREATED", "EXPORT_DOWNLOADED"]))).scalars().all()
        assert events

from datetime import datetime, timedelta
from uuid import uuid4

import pyotp
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.models.entities import (
    Card,
    Department,
    MfaMethod,
    Region,
    Role,
    School,
    Session as UserSession,
    Student,
    Subdivision,
    User,
    UserRole,
    UserScope,
)
from app.security.crypto import encrypt_text
from app.security.passwords import hash_password
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


def _ensure_scope_fixture(db):
    suffix = uuid4().hex[:8]
    region = Region(code=f"T-R-{suffix}", name="Test Region", is_demo=True)
    db.add(region)
    db.flush()
    dept1 = Department(region_id=region.id, code=f"T-D1-{suffix}", name="Dept 1", is_demo=True)
    dept2 = Department(region_id=region.id, code=f"T-D2-{suffix}", name="Dept 2", is_demo=True)
    db.add_all([dept1, dept2])
    db.flush()
    sub1 = Subdivision(department_id=dept1.id, code=f"T-S1-{suffix}", name="Sub 1", is_demo=True)
    sub2 = Subdivision(department_id=dept2.id, code=f"T-S2-{suffix}", name="Sub 2", is_demo=True)
    db.add_all([sub1, sub2])
    db.flush()
    school1 = School(public_id=str(uuid4()), subdivision_id=sub1.id, code=f"SCH1-{suffix}", name="School One Demo", school_type="DEMO", education_subsystem="DEMO", is_demo=True, status="ACTIVE")
    school2 = School(public_id=str(uuid4()), subdivision_id=sub2.id, code=f"SCH2-{suffix}", name="School Two Demo", school_type="DEMO", education_subsystem="DEMO", is_demo=True, status="ACTIVE")
    db.add_all([school1, school2])
    db.flush()
    student1 = Student(public_id=str(uuid4()), student_number=f"STU1-{suffix}", last_name="Scope", first_name="One", birth_date=datetime(2012, 1, 1), status="ACTIVE", current_school_id=school1.id, is_demo=True)
    student2 = Student(public_id=str(uuid4()), student_number=f"STU2-{suffix}", last_name="Scope", first_name="Two", birth_date=datetime(2012, 1, 2), status="ACTIVE", current_school_id=school2.id, is_demo=True)
    db.add_all([student1, student2])
    db.flush()
    card2 = Card(public_id=str(uuid4()), student_id=student2.id, serial_number=f"CARD-{suffix}", status="ACTIVE", is_demo=True)
    db.add(card2)
    db.flush()
    return school1, school2, student1, student2, card2


def _login(username: str, password: str, mfa_secret: str | None = None):
    payload = {"username": username, "password": password}
    if mfa_secret:
        payload["mfa_code"] = pyotp.TOTP(mfa_secret).now()
    return client.post("/api/v1/auth/login", json=payload)


def _csrf(response):
    return response.json()["csrf_token"]


def test_login_logout_refresh_and_change_password() -> None:
    username = f"agent_{uuid4().hex[:8]}"
    password = "Phase3Pass!123"
    new_password = "Phase3Pass!456"
    with SessionLocal() as db:
        _create_user(db, username, password, ["AGENT_IMMATRICULATION"])
        db.commit()

    bad = _login(username, "wrong-password")
    assert bad.status_code == 401

    ok = _login(username, password)
    assert ok.status_code == 200
    csrf = _csrf(ok)

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert "student:create" in me.json()["permissions"]
    assert me.json()["preferred_language"] == "fr"

    language = client.post("/api/v1/auth/language", json={"preferred_language": "en"}, headers={"X-CSRF-Token": csrf})
    assert language.status_code == 200
    assert client.get("/api/v1/auth/me").json()["preferred_language"] == "en"

    refreshed = client.post("/api/v1/auth/refresh", headers={"X-CSRF-Token": csrf})
    assert refreshed.status_code == 200
    csrf = _csrf(refreshed)

    changed = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": password, "new_password": new_password},
        headers={"X-CSRF-Token": csrf},
    )
    assert changed.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401

    relogin = _login(username, new_password)
    assert relogin.status_code == 200
    logout = client.post("/api/v1/auth/logout", headers={"X-CSRF-Token": _csrf(relogin)})
    assert logout.status_code == 200
    assert client.get("/api/v1/auth/me").status_code == 401


def test_mfa_required_for_privileged_and_disable_controlled() -> None:
    username = f"admin_{uuid4().hex[:8]}"
    password = "Phase3Admin!123"
    secret = pyotp.random_base32()
    with SessionLocal() as db:
        _create_user(db, username, password, ["SUPER_ADMIN_TECHNIQUE"], mfa_secret=secret)
        db.commit()

    no_mfa = _login(username, password)
    assert no_mfa.status_code == 200
    assert no_mfa.json()["mfa_required"] is True

    bad_mfa = client.post("/api/v1/auth/login", json={"username": username, "password": password, "mfa_code": "000000"})
    assert bad_mfa.status_code == 401

    ok = _login(username, password, secret)
    assert ok.status_code == 200
    csrf = _csrf(ok)
    disabled = client.post("/api/v1/auth/mfa/disable", json={"code": pyotp.TOTP(secret).now()}, headers={"X-CSRF-Token": csrf})
    assert disabled.status_code == 200


def test_rbac_denies_vertical_escalation_and_allows_admin_user_management() -> None:
    admin_name = f"admin2_{uuid4().hex[:8]}"
    agent_name = f"agent2_{uuid4().hex[:8]}"
    password = "Phase3Mgmt!123"
    secret = pyotp.random_base32()
    with SessionLocal() as db:
        _create_user(db, admin_name, password, ["SUPER_ADMIN_TECHNIQUE"], mfa_secret=secret)
        _create_user(db, agent_name, password, ["AGENT_PRESENCE"])
        db.commit()

    agent_login = _login(agent_name, password)
    assert agent_login.status_code == 200
    denied = client.get("/api/v1/users")
    assert denied.status_code == 403

    admin_login = _login(admin_name, password, secret)
    csrf = _csrf(admin_login)
    created = client.post(
        "/api/v1/users",
        json={"username": f"created_{uuid4().hex[:8]}", "display_name": "Created Demo", "password": "CreatedPass!123", "role_codes": ["SUPPORT"]},
        headers={"X-CSRF-Token": csrf},
    )
    assert created.status_code == 201
    assert "SUPPORT" in created.json()["roles"]


def test_scope_helpers_block_horizontal_access() -> None:
    from app.api.v1.dependencies import CurrentPrincipal, assert_card_scope, assert_student_scope
    from app.security.rbac import permissions_for_roles

    with SessionLocal() as db:
        school1, _, student1, student2, card2 = _ensure_scope_fixture(db)
        user = _create_user(db, f"scoped_{uuid4().hex[:8]}", "ScopedPass!123", ["RESPONSABLE_ETABLISSEMENT"])
        scope = UserScope(user_id=user.id, scope_type="SCHOOL", school_id=school1.id)
        db.add(scope)
        db.commit()
        principal = CurrentPrincipal(user=user, role_codes={"RESPONSABLE_ETABLISSEMENT"}, permissions=permissions_for_roles({"RESPONSABLE_ETABLISSEMENT"}), scopes=[scope])

        assert_student_scope(db, principal, student1.id)
        try:
            assert_student_scope(db, principal, student2.id)
            raise AssertionError("Horizontal student access was not denied")
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 403
        try:
            assert_card_scope(db, principal, card2.id)
            raise AssertionError("Horizontal card access was not denied")
        except Exception as exc:
            assert getattr(exc, "status_code", None) == 403


def test_security_events_are_logged_for_failed_login() -> None:
    username = f"logger_{uuid4().hex[:8]}"
    with SessionLocal() as db:
        _create_user(db, username, "LoggerPass!123", ["SUPPORT"])
        db.commit()

    assert _login(username, "bad").status_code == 401
    with SessionLocal() as db:
        user = db.execute(select(User).where(User.username == username)).scalar_one()
        record_security_event(db, "DIRECT_API_DENIED", "MEDIUM", user_id=user.id, resource_type="test")
        db.commit()
        count = db.execute(select(User).where(User.id == user.id)).scalar_one()
        assert count.username == username


def test_expired_session_is_rejected() -> None:
    username = f"expired_{uuid4().hex[:8]}"
    password = "ExpiredPass!123"
    with SessionLocal() as db:
        _create_user(db, username, password, ["SUPPORT"])
        db.commit()

    ok = _login(username, password)
    assert ok.status_code == 200
    with SessionLocal() as db:
        user = db.execute(select(User).where(User.username == username)).scalar_one()
        session = db.execute(select(UserSession).where(UserSession.user_id == user.id).order_by(UserSession.id.desc())).scalars().first()
        session.expires_at = datetime.utcnow() - timedelta(minutes=1)
        db.commit()

    assert client.get("/api/v1/auth/me").status_code == 401


def test_progressive_lockout_after_repeated_failures() -> None:
    username = f"lock_{uuid4().hex[:8]}"
    password = "LockPass!123"
    with SessionLocal() as db:
        _create_user(db, username, password, ["SUPPORT"])
        db.commit()

    for _ in range(5):
        assert _login(username, "bad-password").status_code == 401

    with SessionLocal() as db:
        user = db.execute(select(User).where(User.username == username)).scalar_one()
        assert user.status == "LOCKED"

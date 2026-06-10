from datetime import datetime
from uuid import uuid4

import pyotp
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select

from app.core.config import get_settings
from app.core.database import SessionLocal, engine
from app.main import app
from app.models.entities import MfaMethod, Role, Student, User, UserRole, UserScope
from app.security.crypto import encrypt_text
from app.security.passwords import hash_password


client = TestClient(app)


def _login_super_admin() -> str:
    secret = pyotp.random_base32()
    username = f"v3_{uuid4().hex[:8]}"
    with SessionLocal() as db:
        role = db.execute(select(Role).where(Role.code == "SUPER_ADMIN_TECHNIQUE")).scalar_one()
        user = User(
            public_id=str(uuid4()),
            username=username,
            display_name="Administrateur volume 3 fictif",
            password_hash=hash_password("Volume3Pass!123"),
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
            "password": "Volume3Pass!123",
            "mfa_code": pyotp.TOTP(secret).now(),
        },
    )
    assert response.status_code == 200
    return response.json()["csrf_token"]


def test_volume3_migration_and_student_detail_contract() -> None:
    csrf = _login_super_admin()
    columns = {column["name"] for column in inspect(engine).get_columns("backup_events")}
    assert {"checksum_present", "file_size_bytes", "operator"} <= columns

    with SessionLocal() as db:
        student = db.execute(select(Student).order_by(Student.id)).scalars().first()
        assert student is not None
        student_id = student.id
        record_version = student.record_version

    detail = client.get(f"/api/v1/students/{student_id}")
    assert detail.status_code == 200
    assert {
        "current_enrollment",
        "active_card_status",
        "active_services_count",
        "last_activity",
        "guardian",
    } <= detail.json().keys()

    for suffix in ("summary", "enrollments", "cards", "services", "duplicates"):
        response = client.get(f"/api/v1/students/{student_id}/{suffix}")
        assert response.status_code == 200, (suffix, response.text)

    conflict = client.patch(
        f"/api/v1/students/{student_id}/archive",
        json={
            "reason_code": "ADMINISTRATIVE_DECISION",
            "reason_text": "Test de concurrence sans archivage effectif",
            "record_version": record_version + 100,
        },
        headers={"X-CSRF-Token": csrf},
    )
    assert conflict.status_code == 409
    assert "current_record" in conflict.json()["detail"]


def test_specialized_dashboard_routes() -> None:
    _login_super_admin()
    routes = (
        "/api/v1/dashboard/cards/kpi",
        "/api/v1/dashboard/cards/distribution",
        "/api/v1/dashboard/cards/trend",
        "/api/v1/dashboard/cards/by-school",
        "/api/v1/dashboard/attendance/kpi",
        "/api/v1/dashboard/attendance/distribution",
        "/api/v1/dashboard/attendance/weekly-trend",
        "/api/v1/dashboard/attendance/by-class",
        "/api/v1/dashboard/payments/kpi",
        "/api/v1/dashboard/payments/by-provider",
        "/api/v1/dashboard/payments/by-category",
        "/api/v1/dashboard/payments/by-school",
        "/api/v1/dashboard/security/kpi",
        "/api/v1/dashboard/security/distribution",
        "/api/v1/dashboard/security/critical-trend",
        "/api/v1/dashboard/security/by-event-type",
        "/api/v1/dashboard/services/kpi",
        "/api/v1/dashboard/services/distribution",
        "/api/v1/dashboard/services/by-type",
        "/api/v1/dashboard/services/by-type-provider",
    )
    for route in routes:
        response = client.get(route)
        assert response.status_code == 200, (route, response.text)
        assert isinstance(response.json(), dict)


def test_backup_service_logging_and_openapi_exclusion(monkeypatch) -> None:
    _login_super_admin()
    token = f"test-{uuid4().hex}"
    monkeypatch.setenv("BACKUP_SERVICE_TOKEN", token)
    get_settings.cache_clear()
    response = client.post(
        "/api/v1/backups/log",
        json={
            "event_type": "BACKUP_VERIFIED",
            "status": "CHECKSUM_OK",
            "file_reference": f"test_{uuid4().hex[:10]}",
            "checksum_present": True,
            "file_size_bytes": 1024,
            "started_at": datetime.utcnow().isoformat(),
            "finished_at": datetime.utcnow().isoformat(),
            "operator": "TEST_AUTOMATED",
        },
        headers={"X-Service-Token": token},
    )
    assert response.status_code == 200

    summary = client.get("/api/v1/backups/summary")
    assert summary.status_code == 200
    assert {"last_success", "last_verification", "last_failure", "age_hours"} <= summary.json().keys()

    openapi = client.get("/openapi.json").json()
    assert "/api/v1/backups/log" not in openapi["paths"]
    get_settings.cache_clear()

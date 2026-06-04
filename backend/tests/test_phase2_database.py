from pathlib import Path

import pytest
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import engine
from app.models import Base


EXPECTED_TABLES = {
    "users",
    "roles",
    "permissions",
    "user_roles",
    "role_permissions",
    "user_scopes",
    "login_attempts",
    "sessions",
    "mfa_methods",
    "password_history",
    "audit_events",
    "audit_event_hashes",
    "security_events",
    "regions",
    "departments",
    "subdivisions",
    "schools",
    "school_years",
    "grade_levels",
    "classrooms",
    "configuration_settings",
    "students",
    "student_guardians",
    "enrollments",
    "transfers",
    "student_status_history",
    "cards",
    "card_status_history",
    "card_issuance_events",
    "signing_key_versions",
    "qr_verification_events",
    "attendance_events",
    "attendance_corrections",
    "service_types",
    "service_providers",
    "service_entitlements",
    "service_verification_events",
    "payment_providers",
    "payment_transactions",
    "payment_reconciliations",
    "incidents",
    "incident_events",
    "exports",
    "export_events",
    "data_access_requests",
    "retention_rules",
    "data_processing_register",
    "backup_events",
    "notification_events",
}


def test_metadata_contains_required_tables() -> None:
    assert EXPECTED_TABLES.issubset(set(Base.metadata.tables))


def test_no_check_constraints_are_required() -> None:
    for table in Base.metadata.tables.values():
        assert not [constraint for constraint in table.constraints if constraint.__class__.__name__ == "CheckConstraint"]


def test_mysql_schema_and_transaction_when_configured() -> None:
    if not Path("../.env").resolve().exists():
        pytest.skip(".env is not configured")

    try:
        with engine.connect() as conn:
            table_count = conn.execute(
                text("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()")
            ).scalar()
            role_count = conn.execute(text("SELECT COUNT(*) FROM roles")).scalar()

            conn.rollback()
            trans = conn.begin()
            conn.execute(
                text(
                    """
                    INSERT INTO configuration_settings
                        (setting_key, setting_value_encrypted, is_sensitive, updated_at)
                    VALUES
                        ('pytest_transaction_probe', 'probe', 0, NOW())
                    """
                )
            )
            inside = conn.execute(
                text("SELECT COUNT(*) FROM configuration_settings WHERE setting_key='pytest_transaction_probe'")
            ).scalar()
            trans.rollback()
            outside = conn.execute(
                text("SELECT COUNT(*) FROM configuration_settings WHERE setting_key='pytest_transaction_probe'")
            ).scalar()
    except SQLAlchemyError as exc:
        pytest.fail(f"MySQL phase 2 validation failed: {exc}")

    assert table_count >= len(EXPECTED_TABLES)
    assert role_count >= 13
    assert inside == 1
    assert outside == 0

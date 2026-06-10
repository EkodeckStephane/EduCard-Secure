"""Add workflow volume 2 metadata.

Revision ID: 0004_redesign_workflows_volume2
Revises: 0003_administrative_capitals
Create Date: 2026-06-10
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql


revision = "0004_redesign_workflows_volume2"
down_revision = "0003_administrative_capitals"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    def add_column(table: str, column: sa.Column) -> None:
        if column.name not in {item["name"] for item in inspector.get_columns(table)}:
            op.add_column(table, column)

    add_column("users", sa.Column("preferred_theme", sa.String(10), nullable=False, server_default="system"))
    add_column("grade_levels", sa.Column("cycle", sa.String(80), nullable=True))
    add_column("grade_levels", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")))
    add_column("sessions", sa.Column("user_agent_summary", sa.String(255), nullable=True))
    add_column("sessions", sa.Column("last_active_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")))
    for name, column in [
        ("alert_status", sa.Column("alert_status", sa.String(40), nullable=False, server_default="OPEN")),
        ("acknowledged_by", sa.Column("acknowledged_by", mysql.BIGINT(unsigned=True), nullable=True)),
        ("acknowledged_at", sa.Column("acknowledged_at", sa.DateTime(), nullable=True)),
        ("acknowledgement_comment", sa.Column("acknowledgement_comment", sa.Text(), nullable=True)),
        ("resolved_by", sa.Column("resolved_by", mysql.BIGINT(unsigned=True), nullable=True)),
        ("resolved_at", sa.Column("resolved_at", sa.DateTime(), nullable=True)),
        ("resolution_note", sa.Column("resolution_note", sa.Text(), nullable=True)),
    ]:
        add_column("security_events", column)
    op.alter_column("security_events", "acknowledged_by", existing_type=sa.BigInteger(), type_=mysql.BIGINT(unsigned=True), existing_nullable=True)
    op.alter_column("security_events", "resolved_by", existing_type=sa.BigInteger(), type_=mysql.BIGINT(unsigned=True), existing_nullable=True)
    foreign_keys = {item["name"] for item in inspector.get_foreign_keys("security_events")}
    if "fk_security_events_ack_user" not in foreign_keys:
        op.create_foreign_key("fk_security_events_ack_user", "security_events", "users", ["acknowledged_by"], ["id"])
    if "fk_security_events_res_user" not in foreign_keys:
        op.create_foreign_key("fk_security_events_res_user", "security_events", "users", ["resolved_by"], ["id"])
    for name, type_ in [
        ("category", sa.String(80)), ("icon", sa.String(80)), ("eligibility_rules", sa.Text()),
        ("calendar_rules", sa.Text()), ("consumption_limits", sa.Text()),
    ]:
        add_column("service_types", sa.Column(name, type_, nullable=True))
    add_column("service_types", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")))
    add_column("service_providers", sa.Column("code", sa.String(60), nullable=True))
    if "uq_service_providers_code" not in {item["name"] for item in inspector.get_unique_constraints("service_providers")}:
        op.create_unique_constraint("uq_service_providers_code", "service_providers", ["code"])
    for name, type_ in [
        ("contact_name", sa.String(160)), ("phone_masked", sa.String(80)), ("school_ids", sa.Text()),
    ]:
        add_column("service_providers", sa.Column(name, type_, nullable=True))
    add_column("service_providers", sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("1")))
    add_column("service_entitlements", sa.Column("notes_minimized", sa.Text(), nullable=True))
    add_column("payment_transactions", sa.Column("external_reference", sa.String(120), nullable=True))
    add_column("payment_transactions", sa.Column("error_code", sa.String(80), nullable=True))
    add_column("payment_transactions", sa.Column("notes_minimized", sa.Text(), nullable=True))
    for name, type_ in [
        ("title", sa.String(120)), ("description_minimized", sa.Text()), ("resource_type", sa.String(80)),
        ("resource_public_id", sa.String(80)), ("occurred_at", sa.DateTime()),
    ]:
        add_column("incidents", sa.Column(name, type_, nullable=True))
    for name, type_ in [
        ("subject_last_name", sa.String(120)), ("subject_first_name", sa.String(120)),
        ("subject_contact_masked", sa.String(160)), ("request_object", sa.Text()),
    ]:
        add_column("data_access_requests", sa.Column(name, type_, nullable=True))
    for name, type_ in [
        ("name", sa.String(160)), ("trigger_type", sa.String(80)), ("duration_unit", sa.String(20)),
        ("last_run_at", sa.DateTime()), ("next_run_at", sa.DateTime()),
    ]:
        add_column("retention_rules", sa.Column(name, type_, nullable=True))
    for name, type_ in [
        ("data_subjects", sa.Text()), ("controller_name", sa.String(255)), ("processors_note", sa.Text()),
        ("security_measures", sa.Text()),
    ]:
        add_column("data_processing_register", sa.Column(name, type_, nullable=True))
    add_column("data_processing_register", sa.Column("status", sa.String(40), nullable=False, server_default="ACTIVE"))
    for name, column in [
        ("format", sa.Column("format", sa.String(20), nullable=False, server_default="CSV")),
        ("reason", sa.Column("reason", sa.Text(), nullable=True)),
        ("filters_json", sa.Column("filters_json", sa.Text(), nullable=True)),
        ("checksum_sha256", sa.Column("checksum_sha256", sa.String(64), nullable=True)),
        ("downloaded_at", sa.Column("downloaded_at", sa.DateTime(), nullable=True)),
    ]:
        add_column("exports", column)
    if "administrative_validations" in inspector.get_table_names():
        return
    op.create_table(
        "administrative_validations",
        sa.Column("id", mysql.BIGINT(unsigned=True), autoincrement=True, nullable=False),
        sa.Column("entity_type", sa.String(80), nullable=False),
        sa.Column("entity_id", mysql.BIGINT(unsigned=True), nullable=False),
        sa.Column("entity_label", sa.String(180), nullable=False),
        sa.Column("status", sa.String(40), nullable=False, server_default="PENDING_VALIDATION"),
        sa.Column("justification", sa.Text(), nullable=True),
        sa.Column("proposed_by", mysql.BIGINT(unsigned=True), nullable=True),
        sa.Column("reviewed_by", mysql.BIGINT(unsigned=True), nullable=True),
        sa.Column("review_comment", sa.Text(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.ForeignKeyConstraint(["proposed_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewed_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        mysql_engine="InnoDB",
        mysql_charset="utf8mb4",
        mysql_collate="utf8mb4_unicode_ci",
    )
    op.create_index("ix_admin_validation_status_type", "administrative_validations", ["status", "entity_type"])


def downgrade() -> None:
    op.drop_index("ix_admin_validation_status_type", table_name="administrative_validations")
    op.drop_table("administrative_validations")
    for table, columns in [
        ("exports", ["downloaded_at", "checksum_sha256", "filters_json", "reason", "format"]),
        ("data_processing_register", ["status", "security_measures", "processors_note", "controller_name", "data_subjects"]),
        ("retention_rules", ["next_run_at", "last_run_at", "duration_unit", "trigger_type", "name"]),
        ("data_access_requests", ["request_object", "subject_contact_masked", "subject_first_name", "subject_last_name"]),
        ("incidents", ["occurred_at", "resource_public_id", "resource_type", "description_minimized", "title"]),
        ("payment_transactions", ["notes_minimized", "error_code", "external_reference"]),
        ("service_entitlements", ["notes_minimized"]),
        ("service_providers", ["is_active", "school_ids", "phone_masked", "contact_name", "code"]),
        ("service_types", ["is_active", "consumption_limits", "calendar_rules", "eligibility_rules", "icon", "category"]),
    ]:
        for column in columns:
            op.drop_column(table, column)
    op.drop_constraint("fk_security_events_res_user", "security_events", type_="foreignkey")
    op.drop_constraint("fk_security_events_ack_user", "security_events", type_="foreignkey")
    for column in ["resolution_note", "resolved_at", "resolved_by", "acknowledgement_comment", "acknowledged_at", "acknowledged_by", "alert_status"]:
        op.drop_column("security_events", column)
    op.drop_column("sessions", "last_active_at")
    op.drop_column("sessions", "user_agent_summary")
    op.drop_column("grade_levels", "is_active")
    op.drop_column("grade_levels", "cycle")
    op.drop_column("users", "preferred_theme")

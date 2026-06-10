"""Volume 3 student workflow and backup metadata.

Revision ID: 0006_redesign_workflows_volume3
Revises: 0005_complete_redesign_workflows
Create Date: 2026-06-10
"""

from alembic import op
import sqlalchemy as sa


revision = "0006_redesign_workflows_volume3"
down_revision = "0005_complete_redesign_workflows"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("backup_events")}
    if "checksum_present" not in columns:
        op.add_column(
            "backup_events",
            sa.Column("checksum_present", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
    if "file_size_bytes" not in columns:
        op.add_column("backup_events", sa.Column("file_size_bytes", sa.Integer(), nullable=True))
    if "operator" not in columns:
        op.add_column("backup_events", sa.Column("operator", sa.String(120), nullable=True))


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("backup_events")}
    for column in ("operator", "file_size_bytes", "checksum_present"):
        if column in columns:
            op.drop_column("backup_events", column)

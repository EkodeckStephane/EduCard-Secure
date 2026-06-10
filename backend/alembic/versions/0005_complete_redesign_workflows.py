"""Complete redesign workflow state.

Revision ID: 0005_complete_redesign_workflows
Revises: 0004_redesign_workflows_volume2
Create Date: 2026-06-10
"""

from alembic import op
import sqlalchemy as sa


revision = "0005_complete_redesign_workflows"
down_revision = "0004_redesign_workflows_volume2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in ("regions", "departments", "subdivisions", "classrooms"):
        columns = {column["name"] for column in inspector.get_columns(table)}
        if "status" not in columns:
            op.add_column(
                table,
                sa.Column("status", sa.String(40), nullable=False, server_default="ACTIVE"),
            )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    for table in ("classrooms", "subdivisions", "departments", "regions"):
        columns = {column["name"] for column in inspector.get_columns(table)}
        if "status" in columns:
            op.drop_column(table, "status")

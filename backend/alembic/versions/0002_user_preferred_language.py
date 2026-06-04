"""add user preferred language

Revision ID: 0002_user_preferred_language
Revises: 0001_initial_schema
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa


revision = "0002_user_preferred_language"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("preferred_language", sa.String(length=5), nullable=False, server_default="fr"))
    op.alter_column("users", "preferred_language", server_default=None)


def downgrade() -> None:
    op.drop_column("users", "preferred_language")

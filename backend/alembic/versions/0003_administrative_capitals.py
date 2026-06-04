"""Add administrative capital fields.

Revision ID: 0003_administrative_capitals
Revises: 0002_user_preferred_language
Create Date: 2026-06-04
"""

from alembic import op
import sqlalchemy as sa


revision = "0003_administrative_capitals"
down_revision = "0002_user_preferred_language"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("regions", sa.Column("capital", sa.String(length=160), nullable=True))
    op.add_column("departments", sa.Column("capital", sa.String(length=160), nullable=True))
    op.add_column("subdivisions", sa.Column("capital", sa.String(length=160), nullable=True))


def downgrade() -> None:
    op.drop_column("subdivisions", "capital")
    op.drop_column("departments", "capital")
    op.drop_column("regions", "capital")


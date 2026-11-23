"""Add student_pets table for evolving SciPet companions (Unit 2).

Revision ID: 0005_student_pets
Revises: 0004_multi_grade_6_9
Create Date: 2026-11-23

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_student_pets"
down_revision: str | Sequence[str] | None = "0004_multi_grade_6_9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    is_pg = _is_postgres()
    schema_learning = "learning" if is_pg else None
    user_fk = "identity_billing.users.id" if is_pg else "users.id"

    op.create_table(
        "student_pets",
        sa.Column("student_id", sa.String(length=36), nullable=False),
        sa.Column("species", sa.String(length=16), nullable=False, server_default="owl"),
        sa.Column("nickname", sa.String(length=40), nullable=False, server_default="Lumo"),
        sa.Column("equipped_accessory", sa.String(length=32), nullable=True),
        sa.Column("equipped_habitat", sa.String(length=24), nullable=False, server_default="lab"),
        sa.Column("fed_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("petted_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_fed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_petted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["student_id"], [user_fk], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("student_id"),
        schema=schema_learning,
    )


def downgrade() -> None:
    schema_learning = "learning" if _is_postgres() else None
    op.drop_table("student_pets", schema=schema_learning)

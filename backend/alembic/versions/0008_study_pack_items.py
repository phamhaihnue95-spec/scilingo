"""Add curriculum.study_pack_items table for DB-backed 16-Unit Study Pack CMS.

Revision ID: 0008_study_pack_items
Revises: 0007_traffic_and_user_activity
Create Date: 2026-11-26

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008_study_pack_items"
down_revision: str | Sequence[str] | None = "0007_traffic_and_user_activity"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    schema_curriculum = "curriculum" if _is_postgres() else None
    op.create_table(
        "study_pack_items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("unit_no", sa.Integer(), nullable=False),
        sa.Column("order_no", sa.Integer(), nullable=False),
        sa.Column("term_en", sa.String(length=200), nullable=False),
        sa.Column("ipa", sa.String(length=200), nullable=False, server_default=""),
        sa.Column("pos", sa.String(length=64), nullable=False, server_default="n"),
        sa.Column("meaning_vi", sa.String(length=255), nullable=False),
        sa.Column("iupac_note", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("unit_no", "order_no", name="uq_study_pack_unit_order"),
        schema=schema_curriculum,
    )
    op.create_index(
        "ix_study_pack_items_unit_no",
        "study_pack_items",
        ["unit_no"],
        schema=schema_curriculum,
    )
    op.create_index(
        "ix_study_pack_items_order_no",
        "study_pack_items",
        ["order_no"],
        schema=schema_curriculum,
    )
    op.create_index(
        "ix_study_pack_items_term_en",
        "study_pack_items",
        ["term_en"],
        schema=schema_curriculum,
    )


def downgrade() -> None:
    schema_curriculum = "curriculum" if _is_postgres() else None
    op.drop_index(
        "ix_study_pack_items_term_en",
        table_name="study_pack_items",
        schema=schema_curriculum,
    )
    op.drop_index(
        "ix_study_pack_items_order_no",
        table_name="study_pack_items",
        schema=schema_curriculum,
    )
    op.drop_index(
        "ix_study_pack_items_unit_no",
        table_name="study_pack_items",
        schema=schema_curriculum,
    )
    op.drop_table("study_pack_items", schema=schema_curriculum)

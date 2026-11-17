"""Bolt 1 initial migration: identity_billing and curriculum schemas.

Revision ID: 0001_bolt1_initial
Revises:
Create Date: 2026-11-17

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "0001_bolt1_initial"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    is_pg = _is_postgres()
    schema_identity = "identity_billing" if is_pg else None
    schema_curriculum = "curriculum" if is_pg else None

    if is_pg:
        op.execute("CREATE SCHEMA IF NOT EXISTS identity_billing")
        op.execute("CREATE SCHEMA IF NOT EXISTS curriculum")
        op.execute(
            """
            DO $$
            BEGIN
                CREATE EXTENSION IF NOT EXISTS vector;
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'pgvector extension not available, continuing without it';
            END
            $$;
            """
        )

    op.create_table(
        "tenants",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("tenant_type", sa.String(length=32), nullable=False),
        sa.Column("province", sa.String(length=120), nullable=True),
        sa.Column("district", sa.String(length=120), nullable=True),
        sa.Column("target_tt94_level", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=schema_identity,
    )

    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=150), nullable=False),
        sa.Column("role", sa.String(length=32), nullable=False),
        sa.Column("grade_level", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["identity_billing.tenants.id" if is_pg else "tenants.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        schema=schema_identity,
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True, schema=schema_identity)
    op.create_index("ix_users_tenant_id", "users", ["tenant_id"], unique=False, schema=schema_identity)

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("plan_code", sa.String(length=32), nullable=False),
        sa.Column("ai_monthly_quota", sa.Integer(), nullable=False),
        sa.Column("ai_used_this_month", sa.Integer(), nullable=False),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=False),
        sa.Column("valid_to", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["identity_billing.tenants.id" if is_pg else "tenants.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        schema=schema_identity,
    )
    op.create_index(
        "ix_subscriptions_tenant_id",
        "subscriptions",
        ["tenant_id"],
        unique=False,
        schema=schema_identity,
    )

    op.create_table(
        "chapters",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("grade", sa.Integer(), nullable=False),
        sa.Column("textbook_series", sa.String(length=32), nullable=False),
        sa.Column("chapter_no", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=32), nullable=False),
        sa.Column("title_vi", sa.String(length=255), nullable=False),
        sa.Column("title_en", sa.String(length=255), nullable=False),
        sa.Column("discipline", sa.String(length=32), nullable=False),
        sa.Column("description_vi", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("grade", "textbook_series", "chapter_no", name="uq_chapter_grade_series_no"),
        schema=schema_curriculum,
    )

    op.create_table(
        "lessons",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("chapter_id", sa.String(length=36), nullable=False),
        sa.Column("lesson_no", sa.Integer(), nullable=False),
        sa.Column("title_vi", sa.String(length=255), nullable=False),
        sa.Column("title_en", sa.String(length=255), nullable=False),
        sa.Column("discipline", sa.String(length=32), nullable=False),
        sa.Column("is_practical", sa.Boolean(), nullable=False),
        sa.Column("integration_links_json", sa.JSON(), nullable=False),
        sa.Column("summary_vi", sa.Text(), nullable=True),
        sa.Column("summary_en", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(
            ["chapter_id"],
            ["curriculum.chapters.id" if is_pg else "chapters.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("chapter_id", "lesson_no", name="uq_lesson_chapter_no"),
        schema=schema_curriculum,
    )
    op.create_index("ix_lessons_chapter_id", "lessons", ["chapter_id"], unique=False, schema=schema_curriculum)
    op.create_index("ix_lessons_lesson_no", "lessons", ["lesson_no"], unique=False, schema=schema_curriculum)
    op.create_index("ix_lessons_discipline", "lessons", ["discipline"], unique=False, schema=schema_curriculum)

    op.create_table(
        "terms",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("slug", sa.String(length=160), nullable=False),
        sa.Column("term_en", sa.String(length=200), nullable=False),
        sa.Column("term_vi", sa.String(length=255), nullable=False),
        sa.Column("ipa", sa.String(length=200), nullable=True),
        sa.Column("audio_url", sa.String(length=500), nullable=True),
        sa.Column("discipline", sa.String(length=32), nullable=False),
        sa.Column("part_of_speech", sa.String(length=32), nullable=True),
        sa.Column("definition_vi", sa.Text(), nullable=True),
        sa.Column("definition_en", sa.Text(), nullable=True),
        sa.Column("example_en", sa.Text(), nullable=True),
        sa.Column("example_vi", sa.Text(), nullable=True),
        sa.Column("formula_or_symbol", sa.String(length=120), nullable=True),
        sa.Column("iupac_note", sa.Text(), nullable=True),
        sa.Column("is_13_exception_element", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=24), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        schema=schema_curriculum,
    )
    op.create_index("ix_terms_slug", "terms", ["slug"], unique=True, schema=schema_curriculum)
    op.create_index("ix_terms_term_en", "terms", ["term_en"], unique=False, schema=schema_curriculum)
    op.create_index("ix_terms_term_vi", "terms", ["term_vi"], unique=False, schema=schema_curriculum)
    op.create_index("ix_terms_discipline", "terms", ["discipline"], unique=False, schema=schema_curriculum)

    op.create_table(
        "lesson_terms",
        sa.Column("lesson_id", sa.String(length=36), nullable=False),
        sa.Column("term_id", sa.String(length=36), nullable=False),
        sa.Column("is_core", sa.Boolean(), nullable=False),
        sa.Column("display_order", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["lesson_id"],
            ["curriculum.lessons.id" if is_pg else "lessons.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["term_id"],
            ["curriculum.terms.id" if is_pg else "terms.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("lesson_id", "term_id"),
        schema=schema_curriculum,
    )


def downgrade() -> None:
    is_pg = _is_postgres()
    schema_identity = "identity_billing" if is_pg else None
    schema_curriculum = "curriculum" if is_pg else None

    op.drop_table("lesson_terms", schema=schema_curriculum)
    op.drop_table("terms", schema=schema_curriculum)
    op.drop_table("lessons", schema=schema_curriculum)
    op.drop_table("chapters", schema=schema_curriculum)
    op.drop_table("subscriptions", schema=schema_identity)
    op.drop_table("users", schema=schema_identity)
    op.drop_table("tenants", schema=schema_identity)

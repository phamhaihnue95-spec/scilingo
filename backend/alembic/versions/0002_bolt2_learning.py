"""Bolt 2 learning schema: SRS flashcards, practice attempts, gamification.

Revision ID: 0002_bolt2_learning
Revises: 0001_bolt1_initial
Create Date: 2026-11-17

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002_bolt2_learning"
down_revision: str | Sequence[str] | None = "0001_bolt1_initial"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    is_pg = _is_postgres()
    schema_learning = "learning" if is_pg else None

    if is_pg:
        op.execute("CREATE SCHEMA IF NOT EXISTS learning")

    op.create_table(
        "srs_cards",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("student_id", sa.String(length=36), nullable=False),
        sa.Column("term_id", sa.String(length=36), nullable=False),
        sa.Column("ease_factor", sa.Float(), nullable=False),
        sa.Column("interval_days", sa.Integer(), nullable=False),
        sa.Column("repetitions", sa.Integer(), nullable=False),
        sa.Column("next_review_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_quality", sa.Integer(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["identity_billing.users.id" if is_pg else "users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["term_id"],
            ["curriculum.terms.id" if is_pg else "terms.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("student_id", "term_id", name="uq_srs_student_term"),
        schema=schema_learning,
    )
    op.create_index(
        "ix_srs_cards_student_id", "srs_cards", ["student_id"], unique=False, schema=schema_learning
    )
    op.create_index(
        "ix_srs_cards_term_id", "srs_cards", ["term_id"], unique=False, schema=schema_learning
    )

    op.create_table(
        "student_practice_attempts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("student_id", sa.String(length=36), nullable=False),
        sa.Column("lesson_no", sa.Integer(), nullable=False),
        sa.Column("mode", sa.String(length=24), nullable=False),
        sa.Column("total_questions", sa.Integer(), nullable=False),
        sa.Column("english_questions_count", sa.Integer(), nullable=False),
        sa.Column("english_ratio", sa.Float(), nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("vi_score", sa.Float(), nullable=True),
        sa.Column("en_score", sa.Float(), nullable=True),
        sa.Column("questions_json", sa.JSON(), nullable=False),
        sa.Column("answers_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["identity_billing.users.id" if is_pg else "users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        schema=schema_learning,
    )
    op.create_index(
        "ix_student_practice_attempts_student_id",
        "student_practice_attempts",
        ["student_id"],
        unique=False,
        schema=schema_learning,
    )
    op.create_index(
        "ix_student_practice_attempts_lesson_no",
        "student_practice_attempts",
        ["lesson_no"],
        unique=False,
        schema=schema_learning,
    )

    op.create_table(
        "student_gamification",
        sa.Column("student_id", sa.String(length=36), nullable=False),
        sa.Column("current_streak", sa.Integer(), nullable=False),
        sa.Column("longest_streak", sa.Integer(), nullable=False),
        sa.Column("total_xp", sa.Integer(), nullable=False),
        sa.Column("badges_json", sa.JSON(), nullable=False),
        sa.Column("discipline_xp_json", sa.JSON(), nullable=False),
        sa.Column("last_study_date", sa.Date(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["identity_billing.users.id" if is_pg else "users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("student_id"),
        schema=schema_learning,
    )


def downgrade() -> None:
    is_pg = _is_postgres()
    schema_learning = "learning" if is_pg else None

    op.drop_table("student_gamification", schema=schema_learning)
    op.drop_table("student_practice_attempts", schema=schema_learning)
    op.drop_table("srs_cards", schema=schema_learning)

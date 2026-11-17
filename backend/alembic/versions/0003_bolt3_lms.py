"""Bolt 3 LMS schema: classrooms, resources, question bank, exams, assignments, TT94 logs.

Revision ID: 0003_bolt3_lms
Revises: 0002_bolt2_learning
Create Date: 2026-11-17

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003_bolt3_lms"
down_revision: str | Sequence[str] | None = "0002_bolt2_learning"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    is_pg = _is_postgres()
    schema_lms = "lms" if is_pg else None

    if is_pg:
        op.execute("CREATE SCHEMA IF NOT EXISTS lms")

    op.create_table(
        "classrooms",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("teacher_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("grade", sa.Integer(), nullable=False),
        sa.Column("academic_year", sa.String(length=20), nullable=False),
        sa.Column("join_code", sa.String(length=24), nullable=False),
        sa.Column("is_tt94_pilot_class", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["identity_billing.tenants.id" if is_pg else "tenants.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["teacher_id"],
            ["identity_billing.users.id" if is_pg else "users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        schema=schema_lms,
    )
    op.create_index(
        "ix_classrooms_tenant_id", "classrooms", ["tenant_id"], unique=False, schema=schema_lms
    )
    op.create_index(
        "ix_classrooms_teacher_id", "classrooms", ["teacher_id"], unique=False, schema=schema_lms
    )
    op.create_index(
        "ix_classrooms_join_code", "classrooms", ["join_code"], unique=True, schema=schema_lms
    )

    op.create_table(
        "classroom_members",
        sa.Column("classroom_id", sa.String(length=36), nullable=False),
        sa.Column("student_id", sa.String(length=36), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["classroom_id"],
            ["lms.classrooms.id" if is_pg else "classrooms.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["identity_billing.users.id" if is_pg else "users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("classroom_id", "student_id"),
        schema=schema_lms,
    )

    op.create_table(
        "teacher_resources",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("lesson_no", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("resource_type", sa.String(length=32), nullable=False),
        sa.Column("clil_mode", sa.String(length=32), nullable=False),
        sa.Column("content_markdown", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("is_official", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["identity_billing.tenants.id" if is_pg else "tenants.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        schema=schema_lms,
    )
    op.create_index(
        "ix_teacher_resources_lesson_no",
        "teacher_resources",
        ["lesson_no"],
        unique=False,
        schema=schema_lms,
    )

    op.create_table(
        "question_bank",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("lesson_no", sa.Integer(), nullable=False),
        sa.Column("author_id", sa.String(length=36), nullable=True),
        sa.Column("tenant_id", sa.String(length=36), nullable=True),
        sa.Column("question_type", sa.String(length=24), nullable=False),
        sa.Column("language", sa.String(length=16), nullable=False),
        sa.Column("cognitive_level", sa.String(length=24), nullable=False),
        sa.Column("discipline", sa.String(length=32), nullable=False),
        sa.Column("prompt_text", sa.Text(), nullable=False),
        sa.Column("options_json", sa.JSON(), nullable=False),
        sa.Column("correct_answer", sa.Text(), nullable=False),
        sa.Column("explanation_vi", sa.Text(), nullable=False),
        sa.Column("linked_term_ids_json", sa.JSON(), nullable=False),
        sa.Column("linter_verified", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["author_id"],
            ["identity_billing.users.id" if is_pg else "users.id"],
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["identity_billing.tenants.id" if is_pg else "tenants.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        schema=schema_lms,
    )
    op.create_index(
        "ix_question_bank_lesson_no",
        "question_bank",
        ["lesson_no"],
        unique=False,
        schema=schema_lms,
    )
    op.create_index(
        "ix_question_bank_language",
        "question_bank",
        ["language"],
        unique=False,
        schema=schema_lms,
    )

    op.create_table(
        "exams",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("teacher_id", sa.String(length=36), nullable=False),
        sa.Column("classroom_id", sa.String(length=36), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("target_en_ratio", sa.Float(), nullable=False),
        sa.Column("achieved_en_ratio", sa.Float(), nullable=False),
        sa.Column("total_points", sa.Float(), nullable=False),
        sa.Column("duration_minutes", sa.Integer(), nullable=False),
        sa.Column("matrix_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["identity_billing.tenants.id" if is_pg else "tenants.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["teacher_id"],
            ["identity_billing.users.id" if is_pg else "users.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["classroom_id"],
            ["lms.classrooms.id" if is_pg else "classrooms.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        schema=schema_lms,
    )
    op.create_index("ix_exams_tenant_id", "exams", ["tenant_id"], unique=False, schema=schema_lms)

    op.create_table(
        "exam_questions",
        sa.Column("exam_id", sa.String(length=36), nullable=False),
        sa.Column("question_id", sa.String(length=36), nullable=False),
        sa.Column("order_no", sa.Integer(), nullable=False),
        sa.Column("points", sa.Float(), nullable=False),
        sa.ForeignKeyConstraint(
            ["exam_id"], ["lms.exams.id" if is_pg else "exams.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["question_id"],
            ["lms.question_bank.id" if is_pg else "question_bank.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("exam_id", "question_id"),
        schema=schema_lms,
    )

    op.create_table(
        "assignments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("classroom_id", sa.String(length=36), nullable=False),
        sa.Column("exam_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["classroom_id"],
            ["lms.classrooms.id" if is_pg else "classrooms.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["exam_id"], ["lms.exams.id" if is_pg else "exams.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        schema=schema_lms,
    )
    op.create_index(
        "ix_assignments_classroom_id",
        "assignments",
        ["classroom_id"],
        unique=False,
        schema=schema_lms,
    )

    op.create_table(
        "student_submissions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("assignment_id", sa.String(length=36), nullable=False),
        sa.Column("student_id", sa.String(length=36), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("max_score", sa.Float(), nullable=False),
        sa.Column("vi_score", sa.Float(), nullable=False),
        sa.Column("en_score", sa.Float(), nullable=False),
        sa.Column("answers_json", sa.JSON(), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["assignment_id"],
            ["lms.assignments.id" if is_pg else "assignments.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["student_id"],
            ["identity_billing.users.id" if is_pg else "users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("assignment_id", "student_id", name="uq_submission_assignment_student"),
        schema=schema_lms,
    )
    op.create_index(
        "ix_student_submissions_assignment_id",
        "student_submissions",
        ["assignment_id"],
        unique=False,
        schema=schema_lms,
    )

    op.create_table(
        "teaching_session_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=False),
        sa.Column("classroom_id", sa.String(length=36), nullable=False),
        sa.Column("teacher_id", sa.String(length=36), nullable=False),
        sa.Column("lesson_no", sa.Integer(), nullable=False),
        sa.Column("taught_date", sa.Date(), nullable=False),
        sa.Column("periods_count", sa.Integer(), nullable=False),
        sa.Column("clil_mode", sa.String(length=32), nullable=False),
        sa.Column("english_minutes", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["tenant_id"],
            ["identity_billing.tenants.id" if is_pg else "tenants.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["classroom_id"],
            ["lms.classrooms.id" if is_pg else "classrooms.id"],
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["teacher_id"],
            ["identity_billing.users.id" if is_pg else "users.id"],
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id"),
        schema=schema_lms,
    )
    op.create_index(
        "ix_teaching_session_logs_tenant_id",
        "teaching_session_logs",
        ["tenant_id"],
        unique=False,
        schema=schema_lms,
    )
    op.create_index(
        "ix_teaching_session_logs_classroom_id",
        "teaching_session_logs",
        ["classroom_id"],
        unique=False,
        schema=schema_lms,
    )


def downgrade() -> None:
    is_pg = _is_postgres()
    schema_lms = "lms" if is_pg else None

    op.drop_table("teaching_session_logs", schema=schema_lms)
    op.drop_table("student_submissions", schema=schema_lms)
    op.drop_table("assignments", schema=schema_lms)
    op.drop_table("exam_questions", schema=schema_lms)
    op.drop_table("exams", schema=schema_lms)
    op.drop_table("question_bank", schema=schema_lms)
    op.drop_table("teacher_resources", schema=schema_lms)
    op.drop_table("classroom_members", schema=schema_lms)
    op.drop_table("classrooms", schema=schema_lms)

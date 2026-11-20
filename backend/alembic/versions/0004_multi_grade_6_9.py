"""Multi-grade expansion (Grades 6, 7, 8, 9): add grade column across learning and lms tables.

Revision ID: 0004_multi_grade_6_9
Revises: 0003_bolt3_lms
Create Date: 2026-11-20

"""
from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_multi_grade_6_9"
down_revision: str | Sequence[str] | None = "0003_bolt3_lms"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    is_pg = _is_postgres()
    schema_learning = "learning" if is_pg else None
    schema_lms = "lms" if is_pg else None

    targets = [
        ("student_practice_attempts", schema_learning, "ix_practice_attempts_grade"),
        ("teacher_resources", schema_lms, "ix_teacher_resources_grade"),
        ("question_bank", schema_lms, "ix_question_bank_grade"),
        ("exams", schema_lms, "ix_exams_grade"),
        ("teaching_session_logs", schema_lms, "ix_teaching_logs_grade"),
    ]
    for table_name, schema_name, index_name in targets:
        op.add_column(
            table_name,
            sa.Column("grade", sa.Integer(), nullable=False, server_default="8"),
            schema=schema_name,
        )
        op.create_index(index_name, table_name, ["grade"], unique=False, schema=schema_name)


def downgrade() -> None:
    is_pg = _is_postgres()
    schema_learning = "learning" if is_pg else None
    schema_lms = "lms" if is_pg else None

    targets = [
        ("teaching_session_logs", schema_lms, "ix_teaching_logs_grade"),
        ("exams", schema_lms, "ix_exams_grade"),
        ("question_bank", schema_lms, "ix_question_bank_grade"),
        ("teacher_resources", schema_lms, "ix_teacher_resources_grade"),
        ("student_practice_attempts", schema_learning, "ix_practice_attempts_grade"),
    ]
    for table_name, schema_name, index_name in targets:
        op.drop_index(index_name, table_name=table_name, schema=schema_name)
        op.drop_column(table_name, "grade", schema=schema_name)

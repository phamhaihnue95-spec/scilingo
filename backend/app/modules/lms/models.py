"""ORM models for Unit 3 (lms schema)."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_uuid() -> str:
    return str(uuid.uuid4())


class Classroom(Base):
    """School classroom participating in KHTN 8 CLIL / TT94 pilot."""

    __tablename__ = "classrooms"
    __table_args__ = {"schema": "lms"}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("identity_billing.tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    teacher_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("identity_billing.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    grade: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    academic_year: Mapped[str] = mapped_column(String(20), nullable=False, default="2026-2027")
    join_code: Mapped[str] = mapped_column(String(24), unique=True, nullable=False, index=True)
    is_tt94_pilot_class: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    members: Mapped[list[ClassroomMember]] = relationship(
        back_populates="classroom", cascade="all, delete-orphan"
    )
    assignments: Mapped[list[Assignment]] = relationship(
        back_populates="classroom", cascade="all, delete-orphan"
    )


class ClassroomMember(Base):
    """Student membership in a classroom."""

    __tablename__ = "classroom_members"
    __table_args__ = {"schema": "lms"}

    classroom_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lms.classrooms.id", ondelete="CASCADE"), primary_key=True
    )
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("identity_billing.users.id", ondelete="CASCADE"), primary_key=True
    )
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    classroom: Mapped[Classroom] = relationship(back_populates="members")


class TeacherResource(Base):
    """Curated or custom CLIL lesson plan, bilingual slide deck, or worksheet."""

    __tablename__ = "teacher_resources"
    __table_args__ = {"schema": "lms"}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    grade: Mapped[int] = mapped_column(Integer, nullable=False, default=8, index=True)
    lesson_no: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    tenant_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("identity_billing.tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(32), nullable=False)
    clil_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="bilingual_10")
    content_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    is_official: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class QuestionBankItem(Base):
    """Question item stored in the tenant/official bank for Exam Builder."""

    __tablename__ = "question_bank"
    __table_args__ = {"schema": "lms"}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    grade: Mapped[int] = mapped_column(Integer, nullable=False, default=8, index=True)
    lesson_no: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    author_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("identity_billing.users.id", ondelete="SET NULL"),
        nullable=True,
    )
    tenant_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("identity_billing.tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    question_type: Mapped[str] = mapped_column(String(24), nullable=False, default="mcq")
    language: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    cognitive_level: Mapped[str] = mapped_column(String(24), nullable=False, default="know")
    discipline: Mapped[str] = mapped_column(String(32), nullable=False, default="chemistry")
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    options_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    correct_answer: Mapped[str] = mapped_column(Text, nullable=False)
    explanation_vi: Mapped[str] = mapped_column(Text, nullable=False, default="")
    linked_term_ids_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    linter_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)


class Exam(Base):
    """Generated periodic exam with explicit TT94 English point percentage."""

    __tablename__ = "exams"
    __table_args__ = {"schema": "lms"}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("identity_billing.tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    teacher_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("identity_billing.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    classroom_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("lms.classrooms.id", ondelete="SET NULL"), nullable=True
    )
    grade: Mapped[int] = mapped_column(Integer, nullable=False, default=8, index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    target_en_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    achieved_en_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    total_points: Mapped[float] = mapped_column(Float, nullable=False, default=10.0)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=45)
    matrix_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    exam_questions: Mapped[list[ExamQuestion]] = relationship(
        back_populates="exam",
        cascade="all, delete-orphan",
        order_by="ExamQuestion.order_no",
    )


class ExamQuestion(Base):
    """Ordered link between an Exam and a QuestionBankItem with exact point weight."""

    __tablename__ = "exam_questions"
    __table_args__ = {"schema": "lms"}

    exam_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lms.exams.id", ondelete="CASCADE"), primary_key=True
    )
    question_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lms.question_bank.id", ondelete="CASCADE"), primary_key=True
    )
    order_no: Mapped[int] = mapped_column(Integer, nullable=False)
    points: Mapped[float] = mapped_column(Float, nullable=False)

    exam: Mapped[Exam] = relationship(back_populates="exam_questions")
    question: Mapped[QuestionBankItem] = relationship()


class Assignment(Base):
    """Exam assigned to a specific classroom."""

    __tablename__ = "assignments"
    __table_args__ = {"schema": "lms"}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    classroom_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lms.classrooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    exam_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lms.exams.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    classroom: Mapped[Classroom] = relationship(back_populates="assignments")
    exam: Mapped[Exam] = relationship()
    submissions: Mapped[list[StudentSubmission]] = relationship(
        back_populates="assignment", cascade="all, delete-orphan"
    )


class StudentSubmission(Base):
    """Student submission and split VI/EN grading for an assigned exam."""

    __tablename__ = "student_submissions"
    __table_args__ = (
        UniqueConstraint("assignment_id", "student_id", name="uq_submission_assignment_student"),
        {"schema": "lms"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    assignment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lms.assignments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    student_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("identity_billing.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    score: Mapped[float] = mapped_column(Float, nullable=False)
    max_score: Mapped[float] = mapped_column(Float, nullable=False)
    vi_score: Mapped[float] = mapped_column(Float, nullable=False)
    en_score: Mapped[float] = mapped_column(Float, nullable=False)
    answers_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    assignment: Mapped[Assignment] = relationship(back_populates="submissions")


class TeachingSessionLog(Base):
    """Logged KHTN class periods taught using English / CLIL for TT94 reporting."""

    __tablename__ = "teaching_session_logs"
    __table_args__ = {"schema": "lms"}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    tenant_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("identity_billing.tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    classroom_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lms.classrooms.id", ondelete="CASCADE"), nullable=False, index=True
    )
    teacher_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("identity_billing.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    grade: Mapped[int] = mapped_column(Integer, nullable=False, default=8, index=True)
    lesson_no: Mapped[int] = mapped_column(Integer, nullable=False)
    taught_date: Mapped[date] = mapped_column(Date, nullable=False)
    periods_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    clil_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="bilingual_10")
    english_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

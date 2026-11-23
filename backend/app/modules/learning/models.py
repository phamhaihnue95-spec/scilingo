"""ORM models for Unit 2 (learning schema)."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _new_uuid() -> str:
    return str(uuid.uuid4())


class SRSCard(Base):
    """Spaced-repetition review state for a (student, term) pair."""

    __tablename__ = "srs_cards"
    __table_args__ = (
        UniqueConstraint("student_id", "term_id", name="uq_srs_student_term"),
        {"schema": "learning"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    student_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("identity_billing.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    term_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("curriculum.terms.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    ease_factor: Mapped[float] = mapped_column(Float, nullable=False, default=2.5)
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    repetitions: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    next_review_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    last_quality: Mapped[int | None] = mapped_column(Integer, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class StudentPracticeAttempt(Base):
    """Generated adaptive quiz attempt supporting 10% / 50% / 100% English modes."""

    __tablename__ = "student_practice_attempts"
    __table_args__ = {"schema": "learning"}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    student_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("identity_billing.users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    grade: Mapped[int] = mapped_column(Integer, nullable=False, default=8, index=True)
    lesson_no: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    mode: Mapped[str] = mapped_column(String(24), nullable=False)
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    english_questions_count: Mapped[int] = mapped_column(Integer, nullable=False)
    english_ratio: Mapped[float] = mapped_column(Float, nullable=False)
    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    vi_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    en_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    questions_json: Mapped[list[dict[str, Any]]] = mapped_column(JSON, nullable=False, default=list)
    answers_json: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class StudentGamification(Base):
    """Streak, XP, discipline progress, and unlocked badges for each student."""

    __tablename__ = "student_gamification"
    __table_args__ = {"schema": "learning"}

    student_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("identity_billing.users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    current_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    longest_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_xp: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    badges_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    discipline_xp_json: Mapped[dict[str, int]] = mapped_column(JSON, nullable=False, default=dict)
    last_study_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )


class StudentPet(Base):
    """Evolving KHTN companion pet state persisted per user."""

    __tablename__ = "student_pets"
    __table_args__ = {"schema": "learning"}

    student_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("identity_billing.users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    species: Mapped[str] = mapped_column(String(16), nullable=False, default="owl")
    nickname: Mapped[str] = mapped_column(String(40), nullable=False, default="Lumo")
    equipped_accessory: Mapped[str | None] = mapped_column(String(32), nullable=True)
    equipped_habitat: Mapped[str] = mapped_column(String(24), nullable=False, default="lab")
    fed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    petted_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_fed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_petted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow
    )

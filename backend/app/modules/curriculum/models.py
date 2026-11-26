"""ORM models for Unit 1 (curriculum schema)."""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


def _new_uuid() -> str:
    return str(uuid.uuid4())


class Chapter(Base):
    """Textbook chapter in KHTN 8 (KNTT)."""

    __tablename__ = "chapters"
    __table_args__ = (
        UniqueConstraint(
            "grade", "textbook_series", "chapter_no", name="uq_chapter_grade_series_no"
        ),
        {"schema": "curriculum"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    grade: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    textbook_series: Mapped[str] = mapped_column(String(32), nullable=False, default="kntt")
    chapter_no: Mapped[int] = mapped_column(Integer, nullable=False)
    code: Mapped[str] = mapped_column(String(32), nullable=False)
    title_vi: Mapped[str] = mapped_column(String(255), nullable=False)
    title_en: Mapped[str] = mapped_column(String(255), nullable=False)
    discipline: Mapped[str] = mapped_column(String(32), nullable=False)
    description_vi: Mapped[str | None] = mapped_column(Text, nullable=True)

    lessons: Mapped[list[Lesson]] = relationship(
        back_populates="chapter",
        cascade="all, delete-orphan",
        order_by="Lesson.lesson_no",
    )


class Lesson(Base):
    """Single lesson (1..47) belonging to a KNTT chapter."""

    __tablename__ = "lessons"
    __table_args__ = (
        UniqueConstraint("chapter_id", "lesson_no", name="uq_lesson_chapter_no"),
        {"schema": "curriculum"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    chapter_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("curriculum.chapters.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lesson_no: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    title_vi: Mapped[str] = mapped_column(String(255), nullable=False)
    title_en: Mapped[str] = mapped_column(String(255), nullable=False)
    discipline: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    is_practical: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    integration_links_json: Mapped[list[dict[str, Any]]] = mapped_column(
        JSON, nullable=False, default=list
    )
    summary_vi: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_en: Mapped[str | None] = mapped_column(Text, nullable=True)

    chapter: Mapped[Chapter] = relationship(back_populates="lessons")
    lesson_terms: Mapped[list[LessonTerm]] = relationship(
        back_populates="lesson",
        cascade="all, delete-orphan",
        order_by="LessonTerm.display_order",
    )


class Term(Base):
    """Verified bilingual terminology card adhering to IUPAC/SI/Biology rules."""

    __tablename__ = "terms"
    __table_args__ = {"schema": "curriculum"}

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    slug: Mapped[str] = mapped_column(String(160), unique=True, nullable=False, index=True)
    term_en: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    term_vi: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    ipa: Mapped[str | None] = mapped_column(String(200), nullable=True)
    audio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    discipline: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    part_of_speech: Mapped[str | None] = mapped_column(String(32), nullable=True, default="noun")
    definition_vi: Mapped[str | None] = mapped_column(Text, nullable=True)
    definition_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    example_en: Mapped[str | None] = mapped_column(Text, nullable=True)
    example_vi: Mapped[str | None] = mapped_column(Text, nullable=True)
    formula_or_symbol: Mapped[str | None] = mapped_column(String(120), nullable=True)
    iupac_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_13_exception_element: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="verified")

    lesson_terms: Mapped[list[LessonTerm]] = relationship(
        back_populates="term", cascade="all, delete-orphan"
    )


class LessonTerm(Base):
    """Join table linking curriculum lessons and standardized terms."""

    __tablename__ = "lesson_terms"
    __table_args__ = {"schema": "curriculum"}

    lesson_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("curriculum.lessons.id", ondelete="CASCADE"), primary_key=True
    )
    term_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("curriculum.terms.id", ondelete="CASCADE"), primary_key=True
    )
    is_core: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    lesson: Mapped[Lesson] = relationship(back_populates="lesson_terms")
    term: Mapped[Term] = relationship(back_populates="lesson_terms")


class StudyPackItem(Base):
    """Vocabulary item in the 16-Unit English Dictionary for Science study pack."""

    __tablename__ = "study_pack_items"
    __table_args__ = (
        UniqueConstraint("unit_no", "order_no", name="uq_study_pack_unit_order"),
        {"schema": "curriculum"},
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_new_uuid)
    unit_no: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    order_no: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    term_en: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    ipa: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    pos: Mapped[str] = mapped_column(String(64), nullable=False, default="n")
    meaning_vi: Mapped[str] = mapped_column(String(255), nullable=False)
    iupac_note: Mapped[str | None] = mapped_column(Text, nullable=True)

"""Database queries for Unit 1 (curriculum)."""

from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.modules.curriculum.models import Chapter, Lesson, LessonTerm, Term


class CurriculumRepository:
    """Encapsulates queries against chapters, lessons, and standardized terms."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def list_available_grades(self, textbook_series: str = "kntt") -> list[int]:
        stmt = (
            select(Chapter.grade)
            .where(Chapter.textbook_series == textbook_series)
            .distinct()
            .order_by(Chapter.grade)
        )
        return [int(g) for g in self.db.scalars(stmt).all()]

    def count_terms_for_grade(self, grade: int, textbook_series: str = "kntt") -> int:
        stmt = (
            select(func.count(func.distinct(LessonTerm.term_id)))
            .join(Lesson, Lesson.id == LessonTerm.lesson_id)
            .join(Chapter, Chapter.id == Lesson.chapter_id)
            .where(Chapter.grade == grade, Chapter.textbook_series == textbook_series)
        )
        return int(self.db.scalar(stmt) or 0)

    def list_chapters_with_lessons(
        self, grade: int = 8, textbook_series: str = "kntt"
    ) -> list[Chapter]:
        stmt = (
            select(Chapter)
            .options(
                selectinload(Chapter.lessons).selectinload(Lesson.lesson_terms),
            )
            .where(Chapter.grade == grade, Chapter.textbook_series == textbook_series)
            .order_by(Chapter.chapter_no)
        )
        return list(self.db.scalars(stmt).all())

    def get_lesson_by_no(
        self,
        lesson_no: int,
        grade: int = 8,
        textbook_series: str = "kntt",
    ) -> Lesson | None:
        stmt = (
            select(Lesson)
            .join(Chapter, Lesson.chapter_id == Chapter.id)
            .options(
                joinedload(Lesson.chapter),
                selectinload(Lesson.lesson_terms).joinedload(LessonTerm.term),
            )
            .where(
                Chapter.grade == grade,
                Chapter.textbook_series == textbook_series,
                Lesson.lesson_no == lesson_no,
            )
        )
        return self.db.scalar(stmt)

    def get_lessons_by_numbers(
        self,
        lesson_nos: list[int],
        grade: int = 8,
        textbook_series: str = "kntt",
    ) -> dict[int, Lesson]:
        if not lesson_nos:
            return {}
        stmt = (
            select(Lesson)
            .join(Chapter, Lesson.chapter_id == Chapter.id)
            .where(
                Chapter.grade == grade,
                Chapter.textbook_series == textbook_series,
                Lesson.lesson_no.in_(lesson_nos),
            )
        )
        lessons = self.db.scalars(stmt).all()
        return {lesson.lesson_no: lesson for lesson in lessons}

    def search_terms(
        self,
        *,
        q: str | None = None,
        discipline: str | None = None,
        grade: int | None = None,
        lesson_no: int | None = None,
        status_filter: str | None = "verified",
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[int, list[Term]]:
        stmt = select(Term)
        if status_filter and status_filter != "all":
            stmt = stmt.where(Term.status == status_filter)
        if grade is not None or lesson_no is not None:
            stmt = (
                stmt.join(LessonTerm, LessonTerm.term_id == Term.id)
                .join(Lesson, Lesson.id == LessonTerm.lesson_id)
                .join(Chapter, Chapter.id == Lesson.chapter_id)
            )
            if grade is not None:
                stmt = stmt.where(Chapter.grade == grade)
            if lesson_no is not None:
                stmt = stmt.where(Lesson.lesson_no == lesson_no)
            stmt = stmt.distinct()
        if discipline:
            stmt = stmt.where(Term.discipline == discipline)
        if q and q.strip():
            pattern = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Term.term_en.ilike(pattern),
                    Term.term_vi.ilike(pattern),
                    Term.formula_or_symbol.ilike(pattern),
                    Term.iupac_note.ilike(pattern),
                )
            )

        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)

        items_stmt = stmt.order_by(Term.term_en).limit(limit).offset(offset)
        items = list(self.db.scalars(items_stmt).all())
        return total, items

    def get_term_by_slug(self, slug: str) -> Term | None:
        stmt = (
            select(Term)
            .options(
                selectinload(Term.lesson_terms)
                .joinedload(LessonTerm.lesson)
                .joinedload(Lesson.chapter)
            )
            .where(Term.slug == slug)
        )
        return self.db.scalar(stmt)

    def get_term_by_id(self, term_id: str) -> Term | None:
        stmt = select(Term).options(selectinload(Term.lesson_terms)).where(Term.id == term_id)
        return self.db.scalar(stmt)

    def get_lesson_by_id(self, lesson_id: str) -> Lesson | None:
        stmt = (
            select(Lesson)
            .options(
                joinedload(Lesson.chapter),
                selectinload(Lesson.lesson_terms).joinedload(LessonTerm.term),
            )
            .where(Lesson.id == lesson_id)
        )
        return self.db.scalar(stmt)

    def list_cms_lessons(
        self,
        *,
        grade: int | None = None,
        discipline: str | None = None,
        q: str | None = None,
    ) -> list[Lesson]:
        stmt = (
            select(Lesson)
            .join(Chapter, Lesson.chapter_id == Chapter.id)
            .options(joinedload(Lesson.chapter), selectinload(Lesson.lesson_terms))
            .where(Chapter.textbook_series == "kntt")
        )
        if grade is not None:
            stmt = stmt.where(Chapter.grade == grade)
        if discipline:
            stmt = stmt.where(Lesson.discipline == discipline)
        if q and q.strip():
            pattern = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Lesson.title_vi.ilike(pattern),
                    Lesson.title_en.ilike(pattern),
                    Lesson.summary_vi.ilike(pattern),
                    Lesson.summary_en.ilike(pattern),
                )
            )
        stmt = stmt.order_by(Chapter.grade, Lesson.lesson_no)
        return list(self.db.scalars(stmt).all())

    def list_cms_terms(
        self,
        *,
        q: str | None = None,
        discipline: str | None = None,
        status_filter: str = "all",
        grade: int | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[int, list[Term]]:
        stmt = select(Term).options(selectinload(Term.lesson_terms))
        if status_filter and status_filter != "all":
            stmt = stmt.where(Term.status == status_filter)
        if grade is not None:
            stmt = (
                stmt.join(LessonTerm, LessonTerm.term_id == Term.id)
                .join(Lesson, Lesson.id == LessonTerm.lesson_id)
                .join(Chapter, Chapter.id == Lesson.chapter_id)
                .where(Chapter.grade == grade)
                .distinct()
            )
        if discipline:
            stmt = stmt.where(Term.discipline == discipline)
        if q and q.strip():
            pattern = f"%{q.strip()}%"
            stmt = stmt.where(
                or_(
                    Term.term_en.ilike(pattern),
                    Term.term_vi.ilike(pattern),
                    Term.formula_or_symbol.ilike(pattern),
                    Term.iupac_note.ilike(pattern),
                )
            )
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = int(self.db.scalar(count_stmt) or 0)
        items = list(
            self.db.scalars(
                stmt.order_by(Term.status, Term.term_en).limit(limit).offset(offset)
            ).all()
        )
        return total, items

    def slug_exists(self, slug: str) -> bool:
        return self.db.scalar(select(Term.id).where(Term.slug == slug)) is not None

    def create_term(self, term: Term) -> Term:
        self.db.add(term)
        self.db.flush()
        return term

    def set_term_lessons(self, term: Term, lesson_ids: list[str]) -> None:
        existing_by_id = {lt.lesson_id: lt for lt in list(term.lesson_terms)}
        desired_set = set(lesson_ids)
        for lid, lt in existing_by_id.items():
            if lid not in desired_set:
                self.db.delete(lt)
        for idx, lid in enumerate(lesson_ids):
            if lid not in existing_by_id:
                self.db.add(
                    LessonTerm(lesson_id=lid, term_id=term.id, is_core=True, display_order=idx)
                )
        self.db.flush()

    def delete_term(self, term: Term) -> None:
        self.db.delete(term)
        self.db.flush()

"""Business logic for Unit 1 (curriculum)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.curriculum.repository import CurriculumRepository
from app.modules.curriculum.schemas import (
    ChapterWithLessonsOut,
    CurriculumTreeResponse,
    IntegrationLinkOut,
    LessonDetailOut,
    LessonSummaryOut,
    LinkedLessonRefOut,
    TermDetailOut,
    TerminologyRulebookOut,
    TermSearchResponse,
    TermSummaryOut,
)


@lru_cache
def _load_rulebook_payload(rules_path: str) -> TerminologyRulebookOut:
    raw = json.loads(Path(rules_path).read_text(encoding="utf-8"))
    return TerminologyRulebookOut(
        name=raw["metadata"]["name"],
        legal_basis=raw["metadata"]["legal_basis"],
        exception_13_elements=raw["exception_13_elements"],
        deprecated_terms_to_flag=raw["deprecated_terms_to_flag"],
    )


class CurriculumService:
    """Service layer for browsing KHTN 8 lessons, terms, and IUPAC/SI standards."""

    def __init__(self, db: Session) -> None:
        self.repo = CurriculumRepository(db)

    def get_curriculum_tree(self, discipline: str | None = None) -> CurriculumTreeResponse:
        chapters = self.repo.list_chapters_with_lessons(grade=8, textbook_series="kntt")
        chapter_outs: list[ChapterWithLessonsOut] = []
        total_lessons = 0

        for ch in chapters:
            filtered_lessons = [
                lesson
                for lesson in sorted(ch.lessons, key=lambda item: item.lesson_no)
                if discipline is None or lesson.discipline == discipline
            ]
            if not filtered_lessons:
                continue

            lesson_outs = [
                LessonSummaryOut(
                    id=lesson.id,
                    lesson_no=lesson.lesson_no,
                    title_vi=lesson.title_vi,
                    title_en=lesson.title_en,
                    discipline=lesson.discipline,
                    is_practical=lesson.is_practical,
                    term_count=len(lesson.lesson_terms),
                    integration_count=len(lesson.integration_links_json or []),
                )
                for lesson in filtered_lessons
            ]
            total_lessons += len(lesson_outs)
            chapter_outs.append(
                ChapterWithLessonsOut(
                    id=ch.id,
                    grade=ch.grade,
                    textbook_series=ch.textbook_series,
                    chapter_no=ch.chapter_no,
                    code=ch.code,
                    title_vi=ch.title_vi,
                    title_en=ch.title_en,
                    discipline=ch.discipline,
                    lessons=lesson_outs,
                )
            )

        return CurriculumTreeResponse(
            grade=8,
            textbook_series="Kết nối tri thức với cuộc sống",
            total_chapters=len(chapter_outs),
            total_lessons=total_lessons,
            chapters=chapter_outs,
        )

    def get_lesson_detail(self, lesson_no: int) -> LessonDetailOut:
        lesson = self.repo.get_lesson_by_no(lesson_no)
        if lesson is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy Bài {lesson_no} trong chương trình KHTN 8 KNTT.",
            )

        raw_links = lesson.integration_links_json or []
        target_nos = [int(item["target_lesson_no"]) for item in raw_links]
        target_map = self.repo.get_lessons_by_numbers(target_nos)

        integration_links: list[IntegrationLinkOut] = []
        for link in raw_links:
            target = target_map.get(int(link["target_lesson_no"]))
            if target is not None:
                integration_links.append(
                    IntegrationLinkOut(
                        target_lesson_no=target.lesson_no,
                        target_title_vi=target.title_vi,
                        target_title_en=target.title_en,
                        target_discipline=target.discipline,
                        note_vi=link["note_vi"],
                    )
                )

        ordered_links = sorted(lesson.lesson_terms, key=lambda lt: lt.display_order)
        terms = [TermSummaryOut.model_validate(lt.term) for lt in ordered_links]

        return LessonDetailOut(
            id=lesson.id,
            lesson_no=lesson.lesson_no,
            title_vi=lesson.title_vi,
            title_en=lesson.title_en,
            discipline=lesson.discipline,
            is_practical=lesson.is_practical,
            chapter_no=lesson.chapter.chapter_no,
            chapter_title_vi=lesson.chapter.title_vi,
            chapter_title_en=lesson.chapter.title_en,
            summary_vi=lesson.summary_vi,
            summary_en=lesson.summary_en,
            integration_links=integration_links,
            terms=terms,
        )

    def search_terms(
        self,
        *,
        q: str | None = None,
        discipline: str | None = None,
        lesson_no: int | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> TermSearchResponse:
        total, items = self.repo.search_terms(
            q=q,
            discipline=discipline,
            lesson_no=lesson_no,
            limit=limit,
            offset=offset,
        )
        return TermSearchResponse(
            total=total,
            items=[TermSummaryOut.model_validate(term) for term in items],
        )

    def get_term_detail(self, slug: str) -> TermDetailOut:
        term = self.repo.get_term_by_slug(slug)
        if term is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy thuật ngữ '{slug}'.",
            )

        linked_lessons = sorted(
            (lt.lesson for lt in term.lesson_terms),
            key=lambda item: item.lesson_no,
        )
        base_data = TermSummaryOut.model_validate(term).model_dump()
        return TermDetailOut(
            **base_data,
            part_of_speech=term.part_of_speech,
            definition_vi=term.definition_vi,
            definition_en=term.definition_en,
            example_en=term.example_en,
            example_vi=term.example_vi,
            lessons=[LinkedLessonRefOut.model_validate(lesson) for lesson in linked_lessons],
        )

    def get_term_by_id(self, term_id: str) -> TermSummaryOut | None:
        term = self.repo.get_term_by_id(term_id)
        return TermSummaryOut.model_validate(term) if term is not None else None

    def get_iupac_rulebook(self) -> TerminologyRulebookOut:
        rules_file = get_settings().data_dir / "terminology_rules.json"
        return _load_rulebook_payload(str(rules_file))

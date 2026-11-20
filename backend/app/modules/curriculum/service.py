"""Business logic for Unit 1 (curriculum)."""

from __future__ import annotations

import json
import math
import random
from functools import lru_cache
from pathlib import Path

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.curriculum.repository import CurriculumRepository
from app.modules.curriculum.schemas import (
    ChapterWithLessonsOut,
    CurriculumTreeResponse,
    GradeOverviewOut,
    IntegrationLinkOut,
    LessonDetailOut,
    LessonSummaryOut,
    LinkedLessonRefOut,
    StudyPackItemOut,
    StudyPackOverviewOut,
    StudyPackQuizOut,
    StudyPackQuizQuestionOut,
    StudyPackQuizStartRequest,
    StudyPackSearchResponse,
    StudyPackUnitDetailOut,
    StudyPackUnitSummaryOut,
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


@lru_cache
def _load_study_pack_raw(pack_path: str) -> dict:
    return json.loads(Path(pack_path).read_text(encoding="utf-8"))


GRADE_METADATA: dict[int, tuple[str, str]] = {
    6: ("Khoa học tự nhiên 6", "Natural Sciences Grade 6"),
    7: ("Khoa học tự nhiên 7", "Natural Sciences Grade 7"),
    8: ("Khoa học tự nhiên 8", "Natural Sciences Grade 8"),
    9: ("Khoa học tự nhiên 9", "Natural Sciences Grade 9"),
}

UNIT_GRADE_LESSONS_FALLBACK: dict[int, dict[str, list[int]]] = {
    1: {"6": [52, 53, 54], "7": [9], "9": [43]},
    2: {"6": [9, 10], "7": [2, 3, 4], "9": [19, 20]},
    3: {"6": [11, 14, 15], "7": [5, 6, 7], "9": [22, 23, 25]},
    4: {"6": [12, 13, 16], "7": [3, 6], "9": [24, 26, 28]},
    5: {"6": [40, 41, 46], "7": [8, 10, 11], "9": [1, 2, 3]},
    6: {"6": [35, 36, 48], "7": [13, 15, 19], "9": [4, 7, 11]},
    7: {"6": [37, 49, 50], "7": [12, 16, 18], "9": [8, 12, 14]},
    8: {"6": [18, 20, 21], "7": [26, 30, 42], "9": [36, 37]},
    9: {"6": [22, 24], "7": [23, 28, 31], "9": [38, 39]},
    10: {"6": [23, 25], "7": [29, 32, 38], "9": [40, 41]},
    11: {"6": [17, 19], "7": [22, 24], "9": [35, 42]},
    12: {"6": [26, 28], "7": [27, 34, 36], "9": [36, 40]},
    13: {"6": [3, 4, 6], "7": [1, 20], "9": [17, 30]},
    14: {"6": [1, 2], "7": [1, 10], "9": [3, 18]},
    15: {"6": [29, 30, 31], "7": [21, 35], "9": [44, 45]},
    16: {"6": [10, 33, 55], "7": [23, 25], "9": [33, 34]},
}


def _build_related_lessons_by_grade(unit_raw: dict) -> dict[str, list[int]]:
    explicit = dict(unit_raw.get("related_lessons_by_grade") or {})
    fallback = UNIT_GRADE_LESSONS_FALLBACK.get(int(unit_raw["unit_no"]), {})
    merged: dict[str, list[int]] = {
        "6": list(explicit.get("6") or fallback.get("6") or []),
        "7": list(explicit.get("7") or fallback.get("7") or []),
        "8": list(explicit.get("8") or unit_raw.get("kntt8_related_lessons") or []),
        "9": list(explicit.get("9") or fallback.get("9") or []),
    }
    return merged


def _flatten_study_pack_unit(
    unit_raw: dict,
) -> tuple[StudyPackUnitSummaryOut, list[StudyPackItemOut]]:
    summary = StudyPackUnitSummaryOut(
        unit_no=unit_raw["unit_no"],
        title_en=unit_raw["title_en"],
        title_vi=unit_raw["title_vi"],
        discipline=unit_raw["discipline"],
        kntt8_related_lessons=unit_raw["kntt8_related_lessons"],
        related_lessons_by_grade=_build_related_lessons_by_grade(unit_raw),
        item_count=unit_raw["item_count"],
    )
    items = [
        StudyPackItemOut(
            unit_no=unit_raw["unit_no"],
            unit_title_en=unit_raw["title_en"],
            unit_title_vi=unit_raw["title_vi"],
            discipline=unit_raw["discipline"],
            order_no=entry["order_no"],
            term_en=entry["term_en"],
            ipa=entry["ipa"],
            pos=entry["pos"],
            meaning_vi=entry["meaning_vi"],
            iupac_note=entry.get("iupac_note"),
        )
        for entry in unit_raw["items"]
    ]
    return summary, items


class CurriculumService:
    """Service layer for browsing KHTN 6-9 lessons, terms, and IUPAC/SI standards."""

    def __init__(self, db: Session) -> None:
        self.repo = CurriculumRepository(db)

    def list_grades(self) -> list[GradeOverviewOut]:
        grades = self.repo.list_available_grades(textbook_series="kntt")
        out: list[GradeOverviewOut] = []
        for g in grades:
            chapters = self.repo.list_chapters_with_lessons(grade=g, textbook_series="kntt")
            lesson_count = sum(len(ch.lessons) for ch in chapters)
            term_count = self.repo.count_terms_for_grade(grade=g, textbook_series="kntt")
            title_vi, title_en = GRADE_METADATA.get(
                g, (f"Khoa học tự nhiên {g}", f"Natural Sciences Grade {g}")
            )
            out.append(
                GradeOverviewOut(
                    grade=g,
                    title_vi=title_vi,
                    title_en=title_en,
                    total_chapters=len(chapters),
                    total_lessons=lesson_count,
                    total_terms=term_count,
                )
            )
        return out

    def get_curriculum_tree(
        self, discipline: str | None = None, grade: int = 8
    ) -> CurriculumTreeResponse:
        if grade not in GRADE_METADATA:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Chương trình chỉ hỗ trợ các khối 6, 7, 8, 9 (không có Khối {grade}).",
            )
        chapters = self.repo.list_chapters_with_lessons(grade=grade, textbook_series="kntt")
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
                    grade=ch.grade,
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
            grade=grade,
            textbook_series="Kết nối tri thức với cuộc sống",
            total_chapters=len(chapter_outs),
            total_lessons=total_lessons,
            chapters=chapter_outs,
        )

    def get_lesson_detail(self, lesson_no: int, grade: int = 8) -> LessonDetailOut:
        lesson = self.repo.get_lesson_by_no(lesson_no, grade=grade)
        if lesson is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy Bài {lesson_no} trong chương trình KHTN {grade} KNTT.",
            )

        raw_links = lesson.integration_links_json or []
        by_grade: dict[int, list[int]] = {}
        for item in raw_links:
            t_grade = int(item.get("target_grade", grade))
            t_no = int(item["target_lesson_no"])
            by_grade.setdefault(t_grade, []).append(t_no)

        target_maps: dict[int, dict[int, object]] = {
            t_grade: self.repo.get_lessons_by_numbers(nos, grade=t_grade)
            for t_grade, nos in by_grade.items()
        }

        integration_links: list[IntegrationLinkOut] = []
        for link in raw_links:
            t_grade = int(link.get("target_grade", grade))
            t_no = int(link["target_lesson_no"])
            target = target_maps.get(t_grade, {}).get(t_no)
            if target is not None:
                integration_links.append(
                    IntegrationLinkOut(
                        target_grade=t_grade,
                        target_lesson_no=target.lesson_no,  # type: ignore[attr-defined]
                        target_title_vi=target.title_vi,  # type: ignore[attr-defined]
                        target_title_en=target.title_en,  # type: ignore[attr-defined]
                        target_discipline=target.discipline,  # type: ignore[attr-defined]
                        note_vi=link["note_vi"],
                    )
                )

        ordered_links = sorted(lesson.lesson_terms, key=lambda lt: lt.display_order)
        terms = [TermSummaryOut.model_validate(lt.term) for lt in ordered_links]

        return LessonDetailOut(
            id=lesson.id,
            grade=lesson.chapter.grade,
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
        grade: int | None = None,
        lesson_no: int | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> TermSearchResponse:
        total, items = self.repo.search_terms(
            q=q,
            discipline=discipline,
            grade=grade,
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
            key=lambda item: (item.chapter.grade, item.lesson_no),
        )
        base_data = TermSummaryOut.model_validate(term).model_dump()
        return TermDetailOut(
            **base_data,
            part_of_speech=term.part_of_speech,
            definition_vi=term.definition_vi,
            definition_en=term.definition_en,
            example_en=term.example_en,
            example_vi=term.example_vi,
            lessons=[
                LinkedLessonRefOut(
                    grade=lesson.chapter.grade,
                    lesson_no=lesson.lesson_no,
                    title_vi=lesson.title_vi,
                    title_en=lesson.title_en,
                    discipline=lesson.discipline,
                )
                for lesson in linked_lessons
            ],
        )

    def get_term_by_id(self, term_id: str) -> TermSummaryOut | None:
        term = self.repo.get_term_by_id(term_id)
        return TermSummaryOut.model_validate(term) if term is not None else None

    def get_iupac_rulebook(self) -> TerminologyRulebookOut:
        rules_file = get_settings().data_dir / "terminology_rules.json"
        return _load_rulebook_payload(str(rules_file))

    def _get_study_pack_raw(self) -> dict:
        pack_file = get_settings().data_dir / "english_for_science_study_pack.json"
        return _load_study_pack_raw(str(pack_file))

    def get_english_science_pack_overview(self) -> StudyPackOverviewOut:
        raw = self._get_study_pack_raw()
        meta = raw["metadata"]
        unit_summaries = [
            StudyPackUnitSummaryOut(
                unit_no=u["unit_no"],
                title_en=u["title_en"],
                title_vi=u["title_vi"],
                discipline=u["discipline"],
                kntt8_related_lessons=u["kntt8_related_lessons"],
                related_lessons_by_grade=_build_related_lessons_by_grade(u),
                item_count=u["item_count"],
            )
            for u in raw["units"]
        ]
        return StudyPackOverviewOut(
            id=meta["id"],
            title=meta["title"],
            subtitle=meta["subtitle"],
            author=meta["author"],
            source_org=meta["source_org"],
            school_context=meta["school_context"],
            total_units=meta["total_units"],
            total_items=meta["total_items"],
            units=unit_summaries,
        )

    def get_english_science_unit(self, unit_no: int) -> StudyPackUnitDetailOut:
        raw = self._get_study_pack_raw()
        for u in raw["units"]:
            if u["unit_no"] == unit_no:
                summary, items = _flatten_study_pack_unit(u)
                return StudyPackUnitDetailOut(unit=summary, items=items)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Không tìm thấy Unit {unit_no} trong bộ The English Dictionary for SCIENCE.",
        )

    def search_english_science_items(
        self,
        *,
        q: str | None = None,
        unit_no: int | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> StudyPackSearchResponse:
        raw = self._get_study_pack_raw()
        all_items: list[StudyPackItemOut] = []
        for u in raw["units"]:
            if unit_no is not None and u["unit_no"] != unit_no:
                continue
            _, unit_items = _flatten_study_pack_unit(u)
            all_items.extend(unit_items)

        needle = q.strip().lower() if q else ""
        if needle:
            filtered = [
                item
                for item in all_items
                if needle in item.term_en.lower()
                or needle in item.meaning_vi.lower()
                or needle in item.ipa.lower()
            ]
        else:
            filtered = all_items

        return StudyPackSearchResponse(
            total=len(filtered),
            items=filtered[offset : offset + limit],
        )

    def generate_study_pack_quiz(self, payload: StudyPackQuizStartRequest) -> StudyPackQuizOut:
        unique_units = sorted(set(payload.unit_nos))
        selected_items: list[StudyPackItemOut] = []
        unit_titles: list[str] = []
        for u_no in unique_units:
            detail = self.get_english_science_unit(u_no)
            unit_titles.append(f"Unit {u_no}: {detail.unit.title_en}")
            selected_items.extend(detail.items)

        all_pack_items = self.search_english_science_items(limit=1000).items
        rng = random.Random()
        pool = list(selected_items)
        rng.shuffle(pool)
        actual_count = min(payload.question_count, len(pool))
        chosen = pool[:actual_count]

        ratio_map = {"quiz_10": 0.10, "quiz_50": 0.50, "quiz_100": 1.00}
        target_ratio = ratio_map[payload.mode]
        en_count = min(actual_count, max(1, math.ceil(actual_count * target_ratio)))
        base_pt = round(10.0 / actual_count, 2)
        points_list = [base_pt for _ in range(actual_count)]
        diff = round(10.0 - sum(points_list), 2)
        if diff != 0:
            points_list[0 if diff > 0 else -1] = round(points_list[0 if diff > 0 else -1] + diff, 2)

        en_indices = set(range(actual_count - en_count, actual_count))
        en_pool = [i.term_en for i in all_pack_items]
        vi_pool = [i.meaning_vi for i in all_pack_items]

        questions: list[StudyPackQuizQuestionOut] = []
        en_points = 0.0
        vi_points = 0.0
        for idx, entry in enumerate(chosen):
            pts = points_list[idx]
            is_en = idx in en_indices
            if is_en:
                en_points += pts
                correct_text = entry.term_en
                distractors = [
                    val
                    for val in dict.fromkeys(rng.sample(en_pool, k=min(25, len(en_pool))))
                    if val.lower() != correct_text.lower()
                ][:3]
                prompt = (
                    f"[Unit {entry.unit_no} · {entry.pos}] Choose the English scientific term "
                    f"for '{entry.meaning_vi}':"
                )
            else:
                vi_points += pts
                correct_text = entry.meaning_vi
                distractors = [
                    val
                    for val in dict.fromkeys(rng.sample(vi_pool, k=min(25, len(vi_pool))))
                    if val.lower() != correct_text.lower()
                ][:3]
                prompt = (
                    f"[Unit {entry.unit_no}] Thuật ngữ '{entry.term_en}' {entry.ipa} ({entry.pos}) "
                    f"mang nghĩa tiếng Việt nào sau đây?"
                )

            options = [correct_text, *distractors]
            rng.shuffle(options)
            correct_idx = options.index(correct_text)
            note_suffix = f" | Lưu ý GDPT 2018: {entry.iupac_note}" if entry.iupac_note else ""
            questions.append(
                StudyPackQuizQuestionOut(
                    index=idx,
                    unit_no=entry.unit_no,
                    language="en" if is_en else "vi",
                    prompt_text=prompt,
                    options=options,
                    correct_index=correct_idx,
                    points=pts,
                    ipa=entry.ipa,
                    iupac_note=entry.iupac_note,
                    explanation_vi=(
                        f"{entry.term_en} {entry.ipa} ({entry.pos}) = "
                        f"{entry.meaning_vi}{note_suffix}."
                    ),
                )
            )

        en_points = round(en_points, 2)
        vi_points = round(vi_points, 2)
        title_label = ", ".join(unit_titles[:2]) + (
            f" (+{len(unit_titles) - 2} Unit)" if len(unit_titles) > 2 else ""
        )
        return StudyPackQuizOut(
            title=f"Bộ đề thực hành: {title_label}",
            unit_nos=unique_units,
            mode=payload.mode,
            total_points=10.0,
            en_points=en_points,
            vi_points=vi_points,
            english_ratio=round(en_points / 10.0, 4),
            questions=questions,
        )

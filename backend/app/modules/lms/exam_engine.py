"""Deterministic Exam Matrix & Question Selection Engine for Thông tư 94/2026."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

from app.modules.curriculum.schemas import (
    LessonDetailOut,
    StudyPackItemOut,
    StudyPackUnitDetailOut,
    TermSummaryOut,
)


@dataclass(frozen=True)
class AllocatedExamPlan:
    """Allocated point distribution meeting exact total_points and target_en_ratio."""

    en_count: int
    vi_count: int
    points_per_question: list[float]
    en_points: float
    vi_points: float
    achieved_en_ratio: float


def compute_exam_allocation(
    *,
    question_count: int,
    total_points: float,
    target_en_ratio: float,
) -> AllocatedExamPlan:
    """Compute exact per-question points summing to total_points and meeting target_en_ratio."""
    if question_count < 1:
        raise ValueError("Số câu hỏi phải lớn hơn 0.")
    if target_en_ratio <= 0.0:
        en_count = 0
    else:
        en_count = min(question_count, max(1, math.ceil(question_count * target_en_ratio)))
    vi_count = question_count - en_count

    # Distribute points cleanly to 2 decimal places so sum == total_points exactly
    base_pt = round(total_points / question_count, 2)
    points_list = [base_pt for _ in range(question_count)]
    diff = round(total_points - sum(points_list), 2)
    if diff != 0:
        # Adjust on the first EN question if positive diff helps preserve >= target_en_ratio
        idx = 0 if (diff > 0 and en_count > 0) else (question_count - 1)
        points_list[idx] = round(points_list[idx] + diff, 2)

    # First vi_count questions are VI, remaining en_count questions are EN
    # (or EN placed cleanly at the end as Part II - English Section)
    vi_points = round(sum(points_list[:vi_count]), 2)
    en_points = round(sum(points_list[vi_count:]), 2)
    achieved_ratio = round(en_points / total_points, 4) if total_points > 0 else 0.0

    return AllocatedExamPlan(
        en_count=en_count,
        vi_count=vi_count,
        points_per_question=points_list,
        en_points=en_points,
        vi_points=vi_points,
        achieved_en_ratio=achieved_ratio,
    )


def _pick_distinct_distractors(
    correct_value: str,
    pool_values: list[str],
    rng: random.Random,
    needed: int = 3,
) -> list[str]:
    candidates = list(
        dict.fromkeys(
            v.strip()
            for v in pool_values
            if v and v.strip() and v.strip().lower() != correct_value.strip().lower()
        )
    )
    rng.shuffle(candidates)
    return candidates[:needed]


def synthesize_questions_from_curriculum(
    *,
    lessons: list[LessonDetailOut],
    all_terms: list[TermSummaryOut],
    language: str,
    needed: int,
    seed: int | None = None,
) -> list[dict]:
    """Generate zero-hallucination question dicts grounded strictly in Unit 1 terms."""
    if needed <= 0:
        return []

    rng = random.Random(seed)
    lesson_term_pairs: list[tuple[int, TermSummaryOut]] = []
    seen_term_ids: set[str] = set()

    for lesson in lessons:
        for term in lesson.terms:
            if term.id not in seen_term_ids:
                seen_term_ids.add(term.id)
                lesson_term_pairs.append((lesson.lesson_no, term))

    # Top up from same discipline / all terms if selected lessons have fewer terms than needed
    target_disciplines = {lesson.discipline for lesson in lessons}
    fallback_lesson_no = lessons[0].lesson_no
    extra_same_disc = [
        t for t in all_terms if t.id not in seen_term_ids and t.discipline in target_disciplines
    ]
    extra_other = [
        t for t in all_terms if t.id not in seen_term_ids and t.discipline not in target_disciplines
    ]
    rng.shuffle(lesson_term_pairs)
    rng.shuffle(extra_same_disc)
    rng.shuffle(extra_other)

    ordered_pairs = [
        *lesson_term_pairs,
        *((fallback_lesson_no, t) for t in extra_same_disc),
        *((fallback_lesson_no, t) for t in extra_other),
    ]

    all_en = [t.term_en for t in all_terms]
    all_vi = [t.term_vi for t in all_terms]
    all_formulas = [t.formula_or_symbol for t in all_terms if t.formula_or_symbol]

    generated: list[dict] = []
    for idx in range(needed):
        lesson_no, term = ordered_pairs[idx % len(ordered_pairs)]
        if language == "en":
            use_formula = bool(term.formula_or_symbol) and idx % 2 == 1
            formula_distractors = (
                _pick_distinct_distractors(term.formula_or_symbol or "", all_formulas, rng)
                if use_formula
                else []
            )
            if use_formula and len(formula_distractors) == 3:
                correct_text = term.formula_or_symbol or ""
                distractors = formula_distractors
                prompt = (
                    f"Which chemical formula or SI unit/symbol represents '{term.term_en}'?"
                )
            else:
                correct_text = term.term_en
                distractors = _pick_distinct_distractors(correct_text, all_en, rng)
                prompt = (
                    f"Choose the standardized English scientific term for '{term.term_vi}':"
                )
        else:
            correct_text = term.term_vi
            distractors = _pick_distinct_distractors(correct_text, all_vi, rng)
            prompt = (
                f"Theo chương trình KHTN 8 (KNTT), thuật ngữ '{term.term_en}' "
                f"có nghĩa tiếng Việt chuẩn nào sau đây?"
            )

        options = [correct_text, *distractors]
        rng.shuffle(options)
        note_text = f" ({term.iupac_note})" if term.iupac_note else ""
        formula_text = f" [{term.formula_or_symbol}]" if term.formula_or_symbol else ""
        explanation_vi = f"{term.term_en} = {term.term_vi}{formula_text}{note_text}."

        generated.append(
            {
                "lesson_no": lesson_no,
                "language": language,
                "cognitive_level": "understand" if idx % 3 == 2 else "know",
                "discipline": term.discipline,
                "prompt_text": prompt,
                "options": options,
                "correct_answer": correct_text,
                "explanation_vi": explanation_vi,
                "linked_term_ids": [term.id],
            }
        )

    return generated


def synthesize_questions_from_study_pack(
    *,
    units: list[StudyPackUnitDetailOut],
    all_items: list[StudyPackItemOut],
    language: str,
    needed: int,
    seed: int | None = None,
) -> list[dict]:
    """Generate MCQ questions directly from The English Dictionary for SCIENCE (16 Units)."""
    if needed <= 0 or not units:
        return []

    rng = random.Random(seed)
    pool_entries: list[tuple[int, StudyPackItemOut]] = []
    for unit_detail in units:
        related_lesson = (
            unit_detail.unit.kntt8_related_lessons[0]
            if unit_detail.unit.kntt8_related_lessons
            else 1
        )
        for item in unit_detail.items:
            pool_entries.append((related_lesson, item))

    rng.shuffle(pool_entries)
    all_en = [item.term_en for item in all_items]
    all_vi = [item.meaning_vi for item in all_items]

    generated: list[dict] = []
    for idx in range(needed):
        lesson_no, entry = pool_entries[idx % len(pool_entries)]
        if language == "en":
            correct_text = entry.term_en
            distractors = _pick_distinct_distractors(correct_text, all_en, rng)
            prompt = (
                f"[Unit {entry.unit_no} - {entry.unit_title_en}] Which English scientific term "
                f"({entry.pos}) corresponds to '{entry.meaning_vi}'?"
            )
        else:
            correct_text = entry.meaning_vi
            distractors = _pick_distinct_distractors(correct_text, all_vi, rng)
            prompt = (
                f"[Chuyên đề Unit {entry.unit_no}: {entry.unit_title_vi}] Thuật ngữ "
                f"'{entry.term_en}' {entry.ipa} ({entry.pos}) có nghĩa tiếng Việt là gì?"
            )

        options = [correct_text, *distractors]
        rng.shuffle(options)
        note_text = f" | {entry.iupac_note}" if entry.iupac_note else ""
        explanation_vi = (
            f"{entry.term_en} {entry.ipa} ({entry.pos}) = {entry.meaning_vi}{note_text}."
        )
        generated.append(
            {
                "lesson_no": lesson_no,
                "language": language,
                "cognitive_level": "understand" if idx % 3 == 2 else "know",
                "discipline": entry.discipline,
                "prompt_text": prompt,
                "options": options,
                "correct_answer": correct_text,
                "explanation_vi": explanation_vi,
                "linked_term_ids": [],
            }
        )

    return generated

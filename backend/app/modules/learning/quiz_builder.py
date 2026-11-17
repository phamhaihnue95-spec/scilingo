"""Deterministic adaptive quiz generator grounded in Unit 1 verified terms."""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from typing import Literal

from app.modules.curriculum.schemas import TermSummaryOut

PracticeMode = Literal["quiz_10", "quiz_50", "quiz_100"]

MODE_RATIOS: dict[PracticeMode, float] = {
    "quiz_10": 0.10,
    "quiz_50": 0.50,
    "quiz_100": 1.00,
}


@dataclass(frozen=True)
class BuiltQuiz:
    """Generated quiz questions with exact Thông tư 94/2026 English ratio."""

    total_questions: int
    english_questions_count: int
    english_ratio: float
    questions: list[dict]


def _pick_distractors(
    correct_value: str,
    candidate_values: list[str],
    rng: random.Random,
    needed: int = 3,
) -> list[str]:
    unique_pool = list(
        dict.fromkeys(
            val.strip()
            for val in candidate_values
            if val and val.strip() and val.strip().lower() != correct_value.strip().lower()
        )
    )
    rng.shuffle(unique_pool)
    return unique_pool[:needed]


def build_lesson_quiz(
    *,
    lesson_terms: list[TermSummaryOut],
    discipline_pool: list[TermSummaryOut],
    fallback_pool: list[TermSummaryOut],
    mode: PracticeMode,
    total_questions: int = 10,
    seed: int | None = None,
) -> BuiltQuiz:
    """Build a 10-point MCQ quiz meeting exact 10% / 50% / 100% English point ratios."""
    rng = random.Random(seed)
    seen_ids: set[str] = set()
    ordered_candidates: list[TermSummaryOut] = []

    for term in [*lesson_terms, *discipline_pool, *fallback_pool]:
        if term.id not in seen_ids:
            seen_ids.add(term.id)
            ordered_candidates.append(term)

    if len(ordered_candidates) < 4:
        raise ValueError("Cần tối thiểu 4 thuật ngữ chuẩn để tạo câu hỏi trắc nghiệm.")

    primary = list(lesson_terms)
    rng.shuffle(primary)
    extras = [t for t in ordered_candidates if t.id not in {p.id for p in primary}]
    rng.shuffle(extras)

    selected_terms = (primary + extras)[:total_questions]
    actual_total = len(selected_terms)
    target_ratio = MODE_RATIOS[mode]
    en_count = min(actual_total, max(1, math.ceil(actual_total * target_ratio)))
    points_per_question = round(10.0 / actual_total, 2)

    en_indices = set(rng.sample(range(actual_total), k=en_count))
    all_en_values = [t.term_en for t in ordered_candidates]
    all_vi_values = [t.term_vi for t in ordered_candidates]
    all_formula_values = [t.formula_or_symbol for t in ordered_candidates if t.formula_or_symbol]

    questions: list[dict] = []
    for idx, term in enumerate(selected_terms):
        is_en = idx in en_indices
        language: Literal["vi", "en"] = "en" if is_en else "vi"

        if is_en:
            use_formula = bool(term.formula_or_symbol) and idx % 2 == 1
            formula_distractors = (
                _pick_distractors(term.formula_or_symbol or "", all_formula_values, rng)
                if use_formula
                else []
            )
            if use_formula and len(formula_distractors) == 3:
                correct_text = term.formula_or_symbol or ""
                distractors = formula_distractors
                prompt = (
                    f"Which standard chemical formula or SI symbol represents '{term.term_en}'?"
                )
            else:
                correct_text = term.term_en
                distractors = _pick_distractors(correct_text, all_en_values, rng)
                prompt = (
                    f"Which English scientific term matches the Vietnamese concept: "
                    f"'{term.term_vi}'?"
                )
        else:
            correct_text = term.term_vi
            distractors = _pick_distractors(correct_text, all_vi_values, rng)
            prompt = (
                f"Trong KHTN 8 (KNTT), thuật ngữ '{term.term_en}' tương ứng với "
                f"khái niệm tiếng Việt nào sau đây?"
            )

        options = [correct_text, *distractors]
        rng.shuffle(options)
        correct_index = options.index(correct_text)

        note_suffix = f" Lưu ý chuẩn hóa: {term.iupac_note}." if term.iupac_note else ""
        formula_suffix = (
            f" (Ký hiệu/Công thức: {term.formula_or_symbol})" if term.formula_or_symbol else ""
        )
        explanation_vi = f"{term.term_en} = {term.term_vi}{formula_suffix}.{note_suffix}"

        questions.append(
            {
                "index": idx,
                "term_id": term.id,
                "term_en": term.term_en,
                "term_vi": term.term_vi,
                "language": language,
                "points": points_per_question,
                "prompt": prompt,
                "options": options,
                "correct_index": correct_index,
                "discipline": term.discipline,
                "explanation_vi": explanation_vi,
            }
        )

    achieved_ratio = round(en_count / actual_total, 4)
    return BuiltQuiz(
        total_questions=actual_total,
        english_questions_count=en_count,
        english_ratio=achieved_ratio,
        questions=questions,
    )

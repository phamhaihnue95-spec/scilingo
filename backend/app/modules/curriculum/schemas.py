"""Pydantic response schemas for Unit 1 (curriculum)."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class LessonSummaryOut(BaseModel):
    """Compact lesson representation used inside the curriculum map."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    lesson_no: int
    title_vi: str
    title_en: str
    discipline: str
    is_practical: bool
    term_count: int = 0
    integration_count: int = 0


class ChapterWithLessonsOut(BaseModel):
    """Chapter block containing its ordered lessons."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    grade: int
    textbook_series: str
    chapter_no: int
    code: str
    title_vi: str
    title_en: str
    discipline: str
    lessons: list[LessonSummaryOut]


class CurriculumTreeResponse(BaseModel):
    """Full KNTT Grade 8 curriculum tree payload."""

    grade: int
    textbook_series: str
    total_chapters: int
    total_lessons: int
    chapters: list[ChapterWithLessonsOut]


class TermSummaryOut(BaseModel):
    """Term card summary for lesson views and glossary search."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    slug: str
    term_en: str
    term_vi: str
    ipa: str | None = None
    audio_url: str | None = None
    discipline: str
    formula_or_symbol: str | None = None
    iupac_note: str | None = None
    is_13_exception_element: bool
    status: str


class LinkedLessonRefOut(BaseModel):
    """Compact reference to a lesson linked via term or cross-discipline integration."""

    model_config = ConfigDict(from_attributes=True)

    lesson_no: int
    title_vi: str
    title_en: str
    discipline: str


class IntegrationLinkOut(BaseModel):
    """Cross-disciplinary link honoring CV 5208 (integrated KHTN teaching)."""

    target_lesson_no: int
    target_title_vi: str
    target_title_en: str
    target_discipline: str
    note_vi: str


class LessonDetailOut(BaseModel):
    """Detailed lesson payload with standardized terms and cross-discipline links."""

    id: str
    lesson_no: int
    title_vi: str
    title_en: str
    discipline: str
    is_practical: bool
    chapter_no: int
    chapter_title_vi: str
    chapter_title_en: str
    summary_vi: str | None = None
    summary_en: str | None = None
    integration_links: list[IntegrationLinkOut]
    terms: list[TermSummaryOut]


class TermDetailOut(TermSummaryOut):
    """Full term details including definitions, examples, and linked lessons."""

    part_of_speech: str | None = None
    definition_vi: str | None = None
    definition_en: str | None = None
    example_en: str | None = None
    example_vi: str | None = None
    lessons: list[LinkedLessonRefOut]


class TermSearchResponse(BaseModel):
    """Paginated glossary search results."""

    total: int
    items: list[TermSummaryOut]


class ExceptionElementOut(BaseModel):
    """One of the 13 elements permitted in Vietnamese at elemental/everyday level."""

    symbol: str
    vi_elemental: str
    iupac_en: str
    allowed_elemental_contexts: list[str]
    compound_example_iupac: str


class DeprecatedTermRuleOut(BaseModel):
    """Guardrail rule flagging legacy Vietnamese-French spellings."""

    pattern: str
    recommended: str
    discipline: str
    severity: str
    reason: str


class TerminologyRulebookOut(BaseModel):
    """Official KHTN 8 IUPAC/SI/Biology terminology reference."""

    name: str
    legal_basis: list[str]
    exception_13_elements: list[ExceptionElementOut]
    deprecated_terms_to_flag: list[DeprecatedTermRuleOut]

"""Pydantic response schemas for Unit 1 (curriculum)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


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


class StudyPackItemOut(BaseModel):
    """Single vocabulary entry from The English Dictionary for SCIENCE."""

    unit_no: int
    unit_title_en: str
    unit_title_vi: str
    discipline: str
    order_no: int
    term_en: str
    ipa: str
    pos: str
    meaning_vi: str
    iupac_note: str | None = None


class StudyPackUnitSummaryOut(BaseModel):
    """Summary metadata for one unit (1..16) in the attached study pack."""

    unit_no: int
    title_en: str
    title_vi: str
    discipline: str
    kntt8_related_lessons: list[int]
    item_count: int


class StudyPackOverviewOut(BaseModel):
    """Overview and 16-unit index for The English Dictionary for SCIENCE."""

    id: str
    title: str
    subtitle: str
    author: str
    source_org: str
    school_context: str
    total_units: int
    total_items: int
    units: list[StudyPackUnitSummaryOut]


class StudyPackUnitDetailOut(BaseModel):
    """Detailed unit payload containing all extracted bilingual items."""

    unit: StudyPackUnitSummaryOut
    items: list[StudyPackItemOut]


class StudyPackSearchResponse(BaseModel):
    """Search results across all 16 units of the study pack."""

    total: int
    items: list[StudyPackItemOut]


class StudyPackQuizStartRequest(BaseModel):
    """Request to build a bilingual practice quiz from selected Study Pack unit(s)."""

    unit_nos: list[int] = Field(min_length=1)
    mode: Literal["quiz_10", "quiz_50", "quiz_100"] = "quiz_10"
    question_count: int = Field(default=10, ge=4, le=40)


class StudyPackQuizQuestionOut(BaseModel):
    """Single generated bilingual question grounded strictly in Study Pack entries."""

    index: int
    unit_no: int
    language: Literal["vi", "en"]
    prompt_text: str
    options: list[str]
    correct_index: int
    points: float
    ipa: str
    iupac_note: str | None = None
    explanation_vi: str


class StudyPackQuizOut(BaseModel):
    """Deterministic 10-point practice quiz from the 16-Unit Dictionary for Science."""

    title: str
    unit_nos: list[int]
    mode: str
    total_points: float
    en_points: float
    vi_points: float
    english_ratio: float
    questions: list[StudyPackQuizQuestionOut]

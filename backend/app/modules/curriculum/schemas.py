"""Pydantic response schemas for Unit 1 (curriculum)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class GradeOverviewOut(BaseModel):
    """Curriculum summary metadata for one middle-school grade (6, 7, 8, or 9)."""

    grade: int
    title_vi: str
    title_en: str
    total_chapters: int
    total_lessons: int
    total_terms: int


class LessonSummaryOut(BaseModel):
    """Compact lesson representation used inside the curriculum map."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    grade: int = 8
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

    grade: int = 8
    lesson_no: int
    title_vi: str
    title_en: str
    discipline: str


class IntegrationLinkOut(BaseModel):
    """Cross-disciplinary link honoring CV 5208 (integrated KHTN teaching)."""

    target_grade: int = 8
    target_lesson_no: int
    target_title_vi: str
    target_title_en: str
    target_discipline: str
    note_vi: str


class LessonDetailOut(BaseModel):
    """Detailed lesson payload with standardized terms and cross-discipline links."""

    id: str
    grade: int = 8
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
    related_lessons_by_grade: dict[str, list[int]] = Field(default_factory=dict)
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


class LintIssueOut(BaseModel):
    """Single deterministic IUPAC/SI/Biology terminology violation or warning."""

    matched_text: str
    recommended: str
    discipline: str
    severity: str
    reason: str


class LintCheckRequest(BaseModel):
    """Text snippet submitted for deterministic IUPAC/SI guardrail checking."""

    text: str = Field(min_length=1, max_length=20000)
    discipline: str | None = None


class LintCheckOut(BaseModel):
    """Structured pedagogical guardrail result returned by Unit 1 Linter."""

    passed: bool
    error_count: int
    warning_count: int
    issues: list[LintIssueOut] = Field(default_factory=list)
    exception_notes: list[str] = Field(default_factory=list)


class CmsLessonItemOut(BaseModel):
    """Curriculum lesson row for CMS management."""

    id: str
    grade: int
    chapter_no: int
    chapter_title_vi: str
    lesson_no: int
    title_vi: str
    title_en: str
    discipline: str
    is_practical: bool
    summary_vi: str | None = None
    summary_en: str | None = None
    term_count: int
    integration_links_json: list[dict[str, Any]] = Field(default_factory=list)


class CmsLessonListOut(BaseModel):
    """Filtered list of KNTT lessons for CMS management."""

    total: int
    items: list[CmsLessonItemOut]


class CmsLessonUpdateRequest(BaseModel):
    """Platform-admin update request for a curriculum lesson."""

    title_vi: str | None = Field(default=None, min_length=2, max_length=255)
    title_en: str | None = Field(default=None, min_length=2, max_length=255)
    discipline: Literal["general_lab", "chemistry", "physics", "biology", "earth_space"] | None = (
        None
    )
    is_practical: bool | None = None
    summary_vi: str | None = Field(default=None, max_length=2000)
    summary_en: str | None = Field(default=None, max_length=2000)
    integration_links_json: list[dict[str, Any]] | None = None
    strict_lint: bool = True


class CmsLessonUpdateResponse(BaseModel):
    """Updated lesson details paired with its IUPAC/SI lint evaluation."""

    lesson: LessonDetailOut
    lint_report: LintCheckOut


class CmsTermOut(TermSummaryOut):
    """CMS glossary term item with full editorial fields and lesson links count."""

    part_of_speech: str | None = None
    definition_vi: str | None = None
    definition_en: str | None = None
    example_en: str | None = None
    example_vi: str | None = None
    lesson_ids: list[str] = Field(default_factory=list)
    lesson_count: int = 0


class CmsTermListOut(BaseModel):
    """Paginated CMS glossary search results (includes draft and verified terms)."""

    total: int
    items: list[CmsTermOut]


class CmsTermCreateRequest(BaseModel):
    """Create or propose a glossary term in Unit 1."""

    term_en: str = Field(min_length=1, max_length=200)
    term_vi: str = Field(min_length=1, max_length=255)
    ipa: str | None = Field(default=None, max_length=200)
    discipline: Literal["general_lab", "chemistry", "physics", "biology", "earth_space"] = (
        "chemistry"
    )
    part_of_speech: str | None = Field(default="noun", max_length=32)
    formula_or_symbol: str | None = Field(default=None, max_length=120)
    iupac_note: str | None = Field(default=None, max_length=1000)
    definition_vi: str | None = Field(default=None, max_length=1000)
    definition_en: str | None = Field(default=None, max_length=1000)
    example_en: str | None = Field(default=None, max_length=1000)
    example_vi: str | None = Field(default=None, max_length=1000)
    status: Literal["draft", "verified"] = "draft"
    lesson_ids: list[str] = Field(default_factory=list)


class CmsTermUpdateRequest(BaseModel):
    """Update or verify a glossary term in Unit 1."""

    term_en: str | None = Field(default=None, min_length=1, max_length=200)
    term_vi: str | None = Field(default=None, min_length=1, max_length=255)
    ipa: str | None = Field(default=None, max_length=200)
    discipline: Literal["general_lab", "chemistry", "physics", "biology", "earth_space"] | None = (
        None
    )
    part_of_speech: str | None = Field(default=None, max_length=32)
    formula_or_symbol: str | None = Field(default=None, max_length=120)
    iupac_note: str | None = Field(default=None, max_length=1000)
    definition_vi: str | None = Field(default=None, max_length=1000)
    definition_en: str | None = Field(default=None, max_length=1000)
    example_en: str | None = Field(default=None, max_length=1000)
    example_vi: str | None = Field(default=None, max_length=1000)
    status: Literal["draft", "verified"] | None = None
    lesson_ids: list[str] | None = None


class CmsTermMutationOut(BaseModel):
    """Created/updated glossary term along with its IUPAC/SI lint evaluation."""

    term: CmsTermOut
    lint_report: LintCheckOut


class CmsStudyPackItemOut(BaseModel):
    """Editable Study Pack vocabulary item returned by CMS."""

    id: str
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


class CmsStudyPackListOut(BaseModel):
    """Paginated Study Pack items for CMS management."""

    total: int
    items: list[CmsStudyPackItemOut]


class CmsStudyPackCreateRequest(BaseModel):
    """Create a Study Pack entry inside Unit 1..16."""

    unit_no: int = Field(ge=1, le=16)
    order_no: int | None = Field(default=None, ge=1, le=9999)
    term_en: str = Field(min_length=1, max_length=200)
    ipa: str = Field(default="", max_length=200)
    pos: str = Field(default="n", max_length=64)
    meaning_vi: str = Field(min_length=1, max_length=255)
    iupac_note: str | None = Field(default=None, max_length=1000)


class CmsStudyPackUpdateRequest(BaseModel):
    """Update fields of a Study Pack item in CMS."""

    unit_no: int | None = Field(default=None, ge=1, le=16)
    order_no: int | None = Field(default=None, ge=1, le=9999)
    term_en: str | None = Field(default=None, min_length=1, max_length=200)
    ipa: str | None = Field(default=None, max_length=200)
    pos: str | None = Field(default=None, max_length=64)
    meaning_vi: str | None = Field(default=None, min_length=1, max_length=255)
    iupac_note: str | None = Field(default=None, max_length=1000)


class CmsStudyPackMutationOut(BaseModel):
    """Created/updated Study Pack item paired with IUPAC/SI lint evaluation."""

    item: CmsStudyPackItemOut
    lint_report: LintCheckOut

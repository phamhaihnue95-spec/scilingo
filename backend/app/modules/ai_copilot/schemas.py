"""Pydantic schemas for Unit 4 (ai_copilot)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.modules.curriculum.schemas import LintCheckOut, LintIssueOut


class CopilotStatusOut(BaseModel):
    """Current AI Copilot runtime mode and tenant quota status."""

    provider_mode: Literal["gemini", "grounded_rag"]
    plan_code: str
    ai_monthly_quota: int
    ai_used_this_month: int
    ai_remaining: int


class CopilotLintRequest(BaseModel):
    """Request to validate science text against IUPAC/SI rules and 13 exceptions."""

    text: str = Field(min_length=1, max_length=20000)
    discipline: str | None = None


class CopilotLintOut(BaseModel):
    """IUPAC/SI lint result enriched with a suggested corrected text preview."""

    passed: bool
    error_count: int
    warning_count: int
    issues: list[LintIssueOut] = Field(default_factory=list)
    exception_notes: list[str] = Field(default_factory=list)
    corrected_preview: str


class RagCitationOut(BaseModel):
    """Verified Unit 1 citation backing a Copilot response."""

    source_type: Literal["lesson", "term", "study_pack"]
    title: str
    detail: str
    grade: int | None = None
    lesson_no: int | None = None


class TutorAskRequest(BaseModel):
    """Student or teacher question constrained to KHTN 6-9 curriculum."""

    grade: int = Field(default=8, ge=6, le=9)
    lesson_no: int | None = Field(default=None, ge=1, le=60)
    question: str = Field(min_length=3, max_length=600)
    response_mode: Literal["bilingual", "vi", "en"] = "bilingual"


class TutorAskOut(BaseModel):
    """Grounded bilingual tutor answer passing Unit 1 IUPAC/SI guardrails."""

    on_topic: bool
    provider: Literal["gemini", "grounded_rag"]
    answer_vi: str
    answer_en: str
    citations: list[RagCitationOut] = Field(default_factory=list)
    lint_report: LintCheckOut
    quota_remaining: int
    refusal_reason: str | None = None


class ClilGenerateRequest(BaseModel):
    """Teacher request to generate grounded bilingual CLIL MCQ questions."""

    grade: int = Field(default=8, ge=6, le=9)
    lesson_no: int = Field(ge=1, le=60)
    language: Literal["en", "vi", "bilingual"] = "en"
    cognitive_level: Literal["know", "understand", "apply"] = "understand"
    count: int = Field(default=3, ge=1, le=6)
    focus_topic: str | None = Field(default=None, max_length=200)


class GeneratedClilQuestionOut(BaseModel):
    """Single generated CLIL question verified by the Unit 1 IUPAC/SI Linter."""

    grade: int
    lesson_no: int
    language: Literal["vi", "en"]
    cognitive_level: Literal["know", "understand", "apply"]
    discipline: str
    prompt_text: str
    options: list[str]
    correct_index: int
    explanation_vi: str
    classroom_english_tip: str
    linter_verified: bool
    lint_report: LintCheckOut


class ClilGenerateOut(BaseModel):
    """Generated CLIL question set grounded in a KHTN 6-9 lesson."""

    grade: int
    lesson_no: int
    lesson_title_vi: str
    lesson_title_en: str
    provider: Literal["gemini", "grounded_rag"]
    questions: list[GeneratedClilQuestionOut]
    quota_remaining: int


class PronunciationEvalRequest(BaseModel):
    """Pronunciation practice evaluation request."""

    target_term: str = Field(min_length=1, max_length=120)
    spoken_transcript: str = Field(min_length=1, max_length=200)
    ipa: str | None = Field(default=None, max_length=200)


class PronunciationEvalOut(BaseModel):
    """Pronunciation score, feedback, and phoneme coaching tips."""

    target_term: str
    spoken_transcript: str
    score: int
    grade_band: Literal["excellent", "good", "needs_practice"]
    ipa: str | None = None
    feedback_vi: str
    feedback_en: str
    tips: list[str] = Field(default_factory=list)

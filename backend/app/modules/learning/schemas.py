"""Pydantic schemas for Unit 2 (learning)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

PracticeMode = Literal["quiz_10", "quiz_50", "quiz_100"]


class SRSDueCardOut(BaseModel):
    """Flashcard scheduled for review or first-time learning."""

    term_id: str
    slug: str
    term_en: str
    term_vi: str
    ipa: str | None = None
    discipline: str
    formula_or_symbol: str | None = None
    iupac_note: str | None = None
    is_13_exception_element: bool
    is_new: bool
    repetitions: int
    interval_days: int
    ease_factor: float
    next_review_at: datetime | None = None


class SRSDueResponse(BaseModel):
    """List of due/new flashcards for a student session."""

    total_due: int
    total_new: int
    cards: list[SRSDueCardOut]


class SRSReviewRequest(BaseModel):
    """Student flashcard recall quality rating (0..5)."""

    term_id: str
    quality: int = Field(ge=0, le=5)


class SRSReviewResultOut(BaseModel):
    """Updated SRS scheduling state and XP reward after reviewing a card."""

    term_id: str
    repetitions: int
    interval_days: int
    ease_factor: float
    next_review_at: datetime
    xp_earned: int
    total_xp: int
    current_streak: int
    newly_unlocked_badges: list[str]


class MindmapNodeOut(BaseModel):
    """Node inside an interactive bilingual concept mindmap."""

    id: str
    node_type: Literal["lesson", "term", "integration"]
    label_vi: str
    label_en: str
    discipline: str
    ipa: str | None = None
    formula_or_symbol: str | None = None
    note: str | None = None
    target_lesson_no: int | None = None
    is_13_exception_element: bool = False


class MindmapEdgeOut(BaseModel):
    """Directed edge linking concept nodes."""

    source: str
    target: str
    relation: Literal["contains_term", "cross_discipline"]
    label_vi: str | None = None


class LessonMindmapOut(BaseModel):
    """Full bilingual mindmap payload for a KHTN 8 lesson."""

    lesson_no: int
    title_vi: str
    title_en: str
    discipline: str
    nodes: list[MindmapNodeOut]
    edges: list[MindmapEdgeOut]


class PracticeStartRequest(BaseModel):
    """Request to launch an adaptive quiz for a lesson."""

    lesson_no: int = Field(ge=1, le=47)
    mode: PracticeMode = "quiz_10"
    total_questions: int = Field(default=10, ge=5, le=10)


class QuizQuestionPublicOut(BaseModel):
    """Quiz question sent to the student (correct_index stripped)."""

    index: int
    term_id: str
    language: Literal["vi", "en"]
    points: float
    prompt: str
    options: list[str]
    discipline: str


class PracticeSessionOut(BaseModel):
    """Active quiz attempt started by the student."""

    attempt_id: str
    lesson_no: int
    lesson_title_vi: str
    lesson_title_en: str
    mode: PracticeMode
    total_questions: int
    english_questions_count: int
    english_ratio: float
    questions: list[QuizQuestionPublicOut]


class PracticeAnswerItem(BaseModel):
    """Single student choice in a quiz submission."""

    index: int = Field(ge=0)
    selected_index: int = Field(ge=0, le=3)


class PracticeSubmitRequest(BaseModel):
    """Full quiz submission payload."""

    answers: list[PracticeAnswerItem]


class QuestionFeedbackOut(BaseModel):
    """Per-question grading breakdown with IUPAC/SI explanation."""

    index: int
    language: Literal["vi", "en"]
    prompt: str
    options: list[str]
    selected_index: int | None
    correct_index: int
    is_correct: bool
    points_earned: float
    max_points: float
    term_en: str
    term_vi: str
    explanation_vi: str


class PracticeResultOut(BaseModel):
    """Final graded quiz result and gamification delta."""

    attempt_id: str
    lesson_no: int
    mode: PracticeMode
    score: float
    max_score: float
    vi_score: float
    en_score: float
    english_ratio: float
    xp_earned: int
    total_xp: int
    current_streak: int
    newly_unlocked_badges: list[str]
    feedback: list[QuestionFeedbackOut]


class PracticeHistoryItemOut(BaseModel):
    """Compact summary of a completed student quiz attempt."""

    attempt_id: str
    lesson_no: int
    mode: str
    score: float
    english_ratio: float
    completed_at: datetime


class GamificationSummaryOut(BaseModel):
    """Student gamification profile, progress across 4 strands, and recent attempts."""

    student_id: str
    current_streak: int
    longest_streak: int
    total_xp: int
    level: int
    next_level_xp: int
    cards_mastered: int
    cards_in_review: int
    badges: list[str]
    discipline_xp: dict[str, int]
    last_study_date: date | None = None
    recent_attempts: list[PracticeHistoryItemOut]

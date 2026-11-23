"""Pydantic schemas for Unit 2 (learning)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

PracticeMode = Literal["quiz_10", "quiz_50", "quiz_100"]
GameType = Literal["lightning_match", "iupac_lab", "sequence_lab"]
PetSpecies = Literal["owl", "fox", "cat"]
PetHabitat = Literal["lab", "cosmos", "forest", "atom"]
PetTreatType = Literal["h2o", "glucose", "photon"]
PetMood = Literal["ecstatic", "happy", "sleepy"]


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
    target_grade: int | None = None
    target_lesson_no: int | None = None
    is_13_exception_element: bool = False


class MindmapEdgeOut(BaseModel):
    """Directed edge linking concept nodes."""

    source: str
    target: str
    relation: Literal["contains_term", "cross_discipline"]
    label_vi: str | None = None


class LessonMindmapOut(BaseModel):
    """Full bilingual mindmap payload for a KHTN 6-9 lesson."""

    grade: int = 8
    lesson_no: int
    title_vi: str
    title_en: str
    discipline: str
    nodes: list[MindmapNodeOut]
    edges: list[MindmapEdgeOut]


class PracticeStartRequest(BaseModel):
    """Request to launch an adaptive quiz for a lesson."""

    grade: int = Field(default=8, ge=6, le=9)
    lesson_no: int = Field(ge=1, le=60)
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
    grade: int = 8
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
    grade: int = 8
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
    grade: int = 8
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


class GameRewardRequest(BaseModel):
    """Summary submitted at the end of a mini-game round to claim XP and badges."""

    game_type: GameType
    correct_count: int = Field(ge=0, le=80)
    total_attempts: int = Field(ge=1, le=160)
    max_combo: int = Field(default=0, ge=0, le=80)
    discipline: Literal["general_lab", "chemistry", "physics", "biology"] = "chemistry"
    study_pack_unit_no: int | None = Field(default=None, ge=1, le=16)


class GameRewardOut(BaseModel):
    """Persisted gamification update after finishing a mini-game session."""

    game_type: GameType
    xp_earned: int
    total_xp: int
    level: int
    current_streak: int
    newly_unlocked_badges: list[str]


class PetAccessoryCatalogItemOut(BaseModel):
    """Unlockable SciPet science accessory item."""

    id: str
    name_vi: str
    icon: str
    unlock_hint_vi: str
    unlocked: bool


class PetHabitatCatalogItemOut(BaseModel):
    """Unlockable SciPet habitat island item."""

    id: str
    name_vi: str
    icon: str
    unlock_hint_vi: str
    unlocked: bool


class StudentPetStateOut(BaseModel):
    """Full personalized SciPet companion state synchronized with Unit 2 progress."""

    student_id: str
    species: PetSpecies
    species_name_vi: str
    nickname: str
    level: int
    total_xp: int
    current_streak: int
    stage: int
    stage_label_vi: str
    stage_label_en: str
    next_evolution_level: int | None = None
    xp_to_next_level: int
    energy: int
    mood: PetMood
    treat_points_available: int
    total_treats_earned: int
    fed_count: int
    petted_count: int
    equipped_accessory: str | None = None
    equipped_habitat: PetHabitat
    unlocked_accessories: list[str]
    unlocked_habitats: list[str]
    accessories_catalog: list[PetAccessoryCatalogItemOut]
    habitats_catalog: list[PetHabitatCatalogItemOut]
    last_fed_at: datetime | None = None


class StudentPetUpdateRequest(BaseModel):
    """Request to customize pet species, nickname, accessory, or habitat."""

    species: PetSpecies | None = None
    nickname: str | None = Field(default=None, min_length=1, max_length=24)
    equipped_accessory: str | None = None
    clear_accessory: bool = False
    equipped_habitat: PetHabitat | None = None


class StudentPetFeedRequest(BaseModel):
    """Request to feed the companion pet one earned Science Treat."""

    treat: PetTreatType


class StudentPetActionOut(BaseModel):
    """Updated pet state alongside a bilingual scientific reaction."""

    pet: StudentPetStateOut
    reaction_vi: str
    reaction_en: str

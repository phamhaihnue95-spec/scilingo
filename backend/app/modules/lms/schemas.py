"""Pydantic schemas for Unit 3 (lms)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ClilMode = Literal["term_only", "bilingual_10", "bilingual_50", "full_english"]
ResourceType = Literal["lesson_plan", "bilingual_slide", "worksheet", "glossary_card"]
CognitiveLevel = Literal["know", "understand", "apply"]
QuestionLang = Literal["vi", "en"]


class ClassroomCreateRequest(BaseModel):
    """Create a KHTN 8 classroom inside the teacher/admin's school tenant."""

    name: str = Field(min_length=2, max_length=120)
    grade: int = Field(default=8, ge=6, le=9)
    academic_year: str = Field(default="2026-2027", min_length=4, max_length=20)
    is_tt94_pilot_class: bool = True


class JoinClassroomRequest(BaseModel):
    """Join a classroom using its invite join_code."""

    join_code: str = Field(min_length=4, max_length=24)


class ClassroomOut(BaseModel):
    """Serialized classroom summary."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    teacher_id: str
    name: str
    grade: int
    academic_year: str
    join_code: str
    is_tt94_pilot_class: bool
    created_at: datetime
    student_count: int = 0
    logged_periods: int = 0


class TeacherResourceOut(BaseModel):
    """CLIL lesson plan, bilingual slide, or worksheet resource for a lesson."""

    id: str
    lesson_no: int
    title: str
    resource_type: ResourceType
    clil_mode: ClilMode
    content_markdown: str
    is_official: bool


class QuestionCreateRequest(BaseModel):
    """Teacher-authored question saved into the school tenant's question bank."""

    lesson_no: int = Field(ge=1, le=47)
    language: QuestionLang = "en"
    cognitive_level: CognitiveLevel = "know"
    discipline: str = "chemistry"
    prompt_text: str = Field(min_length=5, max_length=1000)
    options: list[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    explanation_vi: str = Field(default="", max_length=1000)


class QuestionOut(BaseModel):
    """Question bank entry returned to teachers."""

    id: str
    lesson_no: int
    language: str
    cognitive_level: str
    discipline: str
    prompt_text: str
    options: list[str]
    correct_answer: str
    explanation_vi: str
    linter_verified: bool


class ExamGenerateRequest(BaseModel):
    """Matrix specification for Exam Builder (supports TT94 10% and 50% presets)."""

    title: str = Field(min_length=3, max_length=255)
    lesson_nos: list[int] = Field(min_length=1)
    classroom_id: str | None = None
    target_en_ratio: float = Field(default=0.10, ge=0.0, le=1.0)
    total_points: float = Field(default=10.0, gt=0.0, le=100.0)
    question_count: int = Field(default=10, ge=2, le=40)
    duration_minutes: int = Field(default=45, ge=10, le=120)


class ExamQuestionOut(BaseModel):
    """Ordered exam question with point weight."""

    order_no: int
    question_id: str
    lesson_no: int
    language: str
    cognitive_level: str
    discipline: str
    points: float
    prompt_text: str
    options: list[str]
    correct_answer: str
    explanation_vi: str


class ExamSummaryOut(BaseModel):
    """Compact exam summary for teacher lists."""

    id: str
    title: str
    classroom_id: str | None = None
    target_en_ratio: float
    achieved_en_ratio: float
    total_points: float
    duration_minutes: int
    question_count: int
    created_at: datetime


class ExamDetailOut(ExamSummaryOut):
    """Full generated exam with weighted questions and compliance breakdown."""

    en_points: float
    vi_points: float
    meets_tt94_10: bool
    meets_tt94_50: bool
    questions: list[ExamQuestionOut]


class AssignmentCreateRequest(BaseModel):
    """Assign a generated exam to a classroom."""

    exam_id: str
    title: str | None = None
    due_at: datetime | None = None


class AssignmentOut(BaseModel):
    """Serialized assignment."""

    id: str
    classroom_id: str
    classroom_name: str
    exam_id: str
    title: str
    total_points: float
    achieved_en_ratio: float
    duration_minutes: int
    due_at: datetime | None = None
    created_at: datetime
    submitted: bool = False
    student_score: float | None = None


class AssignmentQuestionPublicOut(BaseModel):
    """Public question delivered to student when taking an assignment."""

    order_no: int
    question_id: str
    language: str
    points: float
    prompt_text: str
    options: list[str]


class AssignmentTakeOut(BaseModel):
    """Student view of an assigned exam (correct_answer hidden)."""

    assignment_id: str
    title: str
    classroom_name: str
    total_points: float
    achieved_en_ratio: float
    duration_minutes: int
    questions: list[AssignmentQuestionPublicOut]


class AssignmentAnswerItem(BaseModel):
    """Student answer for a single question inside an assignment."""

    question_id: str
    selected_index: int = Field(ge=0, le=3)


class AssignmentSubmitRequest(BaseModel):
    """Submission payload for an assigned exam."""

    answers: list[AssignmentAnswerItem]


class SubmissionResultOut(BaseModel):
    """Graded assignment submission separating VI and EN scores."""

    submission_id: str
    assignment_id: str
    score: float
    max_score: float
    vi_score: float
    en_score: float
    submitted_at: datetime


class StudentSubmissionSummaryOut(BaseModel):
    """Per-student score entry inside classroom analytics."""

    student_id: str
    student_name: str
    assignment_title: str
    score: float
    max_score: float
    vi_score: float
    en_score: float
    submitted_at: datetime


class WeakQuestionOut(BaseModel):
    """Question with highest miss rate in a classroom."""

    question_id: str
    prompt_text: str
    language: str
    miss_count: int
    total_attempts: int


class ClassroomAnalyticsOut(BaseModel):
    """Teacher analytics view for classroom scores and weak spots."""

    classroom_id: str
    classroom_name: str
    student_count: int
    submissions_count: int
    average_score: float
    average_en_score: float
    submissions: list[StudentSubmissionSummaryOut]
    weak_questions: list[WeakQuestionOut]


class TeachingSessionCreateRequest(BaseModel):
    """Log one or more taught KHTN periods using English / CLIL."""

    classroom_id: str
    lesson_no: int = Field(ge=1, le=47)
    taught_date: date
    periods_count: int = Field(default=1, ge=1, le=5)
    clil_mode: ClilMode = "bilingual_10"
    english_minutes: int = Field(default=15, ge=3, le=225)
    notes: str | None = Field(default=None, max_length=500)


class TeachingSessionOut(BaseModel):
    """Recorded CLIL teaching session."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    classroom_id: str
    teacher_id: str
    lesson_no: int
    taught_date: date
    periods_count: int
    clil_mode: str
    english_minutes: int
    notes: str | None = None
    created_at: datetime


class ClassroomTT94MetricsOut(BaseModel):
    """Per-classroom progress toward TT94 Appendix II thresholds (35 and 105 periods)."""

    classroom_id: str
    classroom_name: str
    is_tt94_pilot_class: bool
    student_count: int
    total_periods_logged: int
    total_english_minutes: int
    meets_35_periods: bool
    meets_105_periods: bool


class TT94ComplianceReportOut(BaseModel):
    """School-wide self-assessment dashboard for Circular 94/2026/TT-BGDDT."""

    tenant_id: str
    tenant_name: str
    academic_year: str
    total_classrooms: int
    classrooms_meeting_35_periods: int
    classrooms_meeting_105_periods: int
    total_periods_logged: int
    total_exams_generated: int
    exams_meeting_10_pct: int
    exams_meeting_50_pct: int
    estimated_tt94_level: int
    level_label: str
    next_level_gaps: list[str]
    classrooms: list[ClassroomTT94MetricsOut]

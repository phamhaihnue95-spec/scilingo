"""FastAPI routes for Unit 3 (lms): Teacher Studio, Exam Builder & TT94 Reporting."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.identity_billing.dependencies import get_current_user, require_roles
from app.modules.identity_billing.models import User
from app.modules.lms.schemas import (
    AssignmentCreateRequest,
    AssignmentOut,
    AssignmentSubmitRequest,
    AssignmentTakeOut,
    ClassroomAnalyticsOut,
    ClassroomCreateRequest,
    ClassroomLeaderboardOut,
    ClassroomOut,
    CmsQuestionCreateRequest,
    CmsQuestionCsvImportOut,
    CmsQuestionCsvImportRequest,
    CmsQuestionListOut,
    CmsQuestionOut,
    CmsQuestionUpdateRequest,
    CmsResourceCreateRequest,
    CmsResourceListOut,
    CmsResourceOut,
    CmsResourceUpdateRequest,
    ExamDetailOut,
    ExamGenerateRequest,
    ExamSummaryOut,
    GameChallengeCreateRequest,
    GameChallengeOut,
    JoinClassroomRequest,
    QuestionCreateRequest,
    QuestionOut,
    SubmissionResultOut,
    TeacherResourceOut,
    TeachingSessionCreateRequest,
    TeachingSessionOut,
    TT94ComplianceReportOut,
)
from app.modules.lms.service import LMSService

router = APIRouter(tags=["Teacher Studio & LMS (Unit 3)"])

TEACHER_ROLES = ("teacher", "school_admin", "platform_admin")


# --- Classrooms ---
@router.post("/lms/classrooms", response_model=ClassroomOut)
def create_classroom(
    payload: ClassroomCreateRequest,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> ClassroomOut:
    """Create a classroom inside the teacher's school tenant."""
    return LMSService(db).create_classroom(current_user, payload)


@router.get("/lms/classrooms", response_model=list[ClassroomOut])
def list_classrooms(
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> list[ClassroomOut]:
    """List classrooms strictly scoped to the caller's tenant."""
    return LMSService(db).list_classrooms(current_user)


@router.post("/lms/classrooms/join", response_model=ClassroomOut)
def join_classroom(
    payload: JoinClassroomRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ClassroomOut:
    """Allow a student to enroll in a classroom via its join code."""
    return LMSService(db).join_classroom(current_user, payload.join_code)


@router.get("/lms/classrooms/{classroom_id}/analytics", response_model=ClassroomAnalyticsOut)
def get_classroom_analytics(
    classroom_id: str,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> ClassroomAnalyticsOut:
    """Return student submission breakdown (VI vs EN scores) and weak questions."""
    return LMSService(db).get_classroom_analytics(current_user, classroom_id)


@router.get("/lms/my-classrooms", response_model=list[ClassroomOut])
def list_my_classrooms(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ClassroomOut]:
    """List classrooms that the authenticated student has joined."""
    return LMSService(db).list_student_classrooms(current_user)


@router.get("/lms/classrooms/{classroom_id}/leaderboard", response_model=ClassroomLeaderboardOut)
def get_classroom_leaderboard(
    classroom_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ClassroomLeaderboardOut:
    """Return tenant- and classroom-isolated gamification leaderboard."""
    return LMSService(db).get_classroom_leaderboard(current_user, classroom_id)


@router.post("/lms/classrooms/{classroom_id}/game-challenges", response_model=GameChallengeOut)
def create_game_challenge(
    classroom_id: str,
    payload: GameChallengeCreateRequest,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> GameChallengeOut:
    """Assign a 5-minute mini-game challenge to a classroom."""
    return LMSService(db).create_game_challenge(current_user, classroom_id, payload)


@router.get("/lms/classrooms/{classroom_id}/game-challenges", response_model=list[GameChallengeOut])
def list_classroom_game_challenges(
    classroom_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GameChallengeOut]:
    """List active mini-game challenges assigned to a classroom."""
    return LMSService(db).list_classroom_game_challenges(current_user, classroom_id)


@router.get("/lms/my-game-challenges", response_model=list[GameChallengeOut])
def list_my_game_challenges(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[GameChallengeOut]:
    """List active mini-game challenges assigned to the student's classrooms."""
    return LMSService(db).list_student_game_challenges(current_user)


# --- CLIL Resources ---
@router.get("/lms/resources", response_model=list[TeacherResourceOut])
def get_lesson_resources(
    lesson_no: int = Query(default=8, ge=1, le=60),
    grade: int = Query(default=8, ge=6, le=9),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[TeacherResourceOut]:
    """Retrieve CLIL lesson plan, bilingual slides, and worksheet for a lesson."""
    return LMSService(db).get_resources_for_lesson(current_user, lesson_no, grade=grade)


# --- Question Bank & Exam Builder ---
@router.post("/lms/questions", response_model=QuestionOut)
def create_question(
    payload: QuestionCreateRequest,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> QuestionOut:
    """Add a teacher-authored question into the school tenant's question bank."""
    return LMSService(db).create_question(current_user, payload)


@router.get("/lms/questions", response_model=list[QuestionOut])
def list_questions(
    grade: int | None = Query(default=None, ge=6, le=9),
    lesson_no: int | None = Query(default=None, ge=1, le=60),
    language: str | None = Query(default=None),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> list[QuestionOut]:
    """List questions available to the teacher's tenant."""
    return LMSService(db).list_questions(
        current_user, grade=grade, lesson_no=lesson_no, language=language
    )


@router.post("/lms/exams/generate", response_model=ExamDetailOut)
def generate_exam(
    payload: ExamGenerateRequest,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> ExamDetailOut:
    """Generate a periodic exam matching exact 10% / 50% / custom English point ratio."""
    return LMSService(db).generate_exam(current_user, payload)


@router.get("/lms/exams", response_model=list[ExamSummaryOut])
def list_exams(
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> list[ExamSummaryOut]:
    """List generated exams belonging to the caller's tenant."""
    return LMSService(db).list_exams(current_user)


@router.get("/lms/exams/{exam_id}", response_model=ExamDetailOut)
def get_exam_detail(
    exam_id: str,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> ExamDetailOut:
    """Fetch full details for a generated exam."""
    return LMSService(db).get_exam_detail(current_user, exam_id)


@router.get("/lms/exams/{exam_id}/export")
def export_exam(
    exam_id: str,
    format: str = Query(default="docx", pattern="^(docx|pdf)$"),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> Response:
    """Export a generated exam with answer key to Word (.docx) or PDF (.pdf)."""
    content, media_type, filename = LMSService(db).export_exam(current_user, exam_id, format)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# --- Assignments ---
@router.post("/lms/classrooms/{classroom_id}/assignments", response_model=AssignmentOut)
def assign_exam(
    classroom_id: str,
    payload: AssignmentCreateRequest,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> AssignmentOut:
    """Assign an exam to a classroom."""
    return LMSService(db).assign_exam_to_classroom(current_user, classroom_id, payload)


@router.get("/lms/my-assignments", response_model=list[AssignmentOut])
def list_my_assignments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AssignmentOut]:
    """List exams assigned to classrooms the current student has joined."""
    return LMSService(db).list_student_assignments(current_user)


@router.get("/lms/assignments/{assignment_id}/take", response_model=AssignmentTakeOut)
def take_assignment(
    assignment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssignmentTakeOut:
    """Fetch public questions (without answer key) for a classroom assignment."""
    return LMSService(db).take_assignment(current_user, assignment_id)


@router.post("/lms/assignments/{assignment_id}/submit", response_model=SubmissionResultOut)
def submit_assignment(
    assignment_id: str,
    payload: AssignmentSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SubmissionResultOut:
    """Submit and grade an assigned exam with split VI/EN scores."""
    return LMSService(db).submit_assignment(current_user, assignment_id, payload)


# --- Teaching Logs & TT94 Compliance Report ---
@router.post("/lms/sessions/log", response_model=TeachingSessionOut)
def log_teaching_session(
    payload: TeachingSessionCreateRequest,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> TeachingSessionOut:
    """Log taught KHTN periods using English / CLIL for TT94 tracking."""
    return LMSService(db).log_teaching_session(current_user, payload)


@router.get("/lms/sessions", response_model=list[TeachingSessionOut])
def list_teaching_sessions(
    classroom_id: str | None = Query(default=None),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> list[TeachingSessionOut]:
    """List logged CLIL teaching sessions for the school tenant."""
    return LMSService(db).list_teaching_sessions(current_user, classroom_id=classroom_id)


@router.get("/lms/reports/tt94-compliance", response_model=TT94ComplianceReportOut)
def get_tt94_compliance_report(
    academic_year: str = Query(default="2026-2027"),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> TT94ComplianceReportOut:
    """Generate the Circular 94/2026 self-assessment evidence report for school leadership."""
    return LMSService(db).get_tt94_compliance_report(current_user, academic_year=academic_year)


@router.get("/lms/reports/tt94-compliance/export-csv")
def export_tt94_compliance_csv(
    academic_year: str = Query(default="2026-2027"),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> Response:
    """Export Circular 94/2026 evidence metrics by grade and classroom as UTF-8 BOM CSV."""
    csv_bytes = LMSService(db).export_tt94_compliance_csv(current_user, academic_year=academic_year)
    safe_year = "".join(ch for ch in academic_year if ch.isalnum() or ch in "-_") or "report"
    return Response(
        content=csv_bytes,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="scilingo-tt94-{safe_year}.csv"'},
    )


# --- Unit 3 Content CMS: Question Bank & CLIL Resources ---
@router.get("/lms/cms/questions", response_model=CmsQuestionListOut)
def list_cms_questions(
    grade: int | None = Query(default=None, ge=6, le=9),
    lesson_no: int | None = Query(default=None, ge=1, le=60),
    language: str | None = Query(default=None),
    cognitive_level: str | None = Query(default=None),
    discipline: str | None = Query(default=None),
    linter_verified: bool | None = Query(default=None),
    scope: str = Query(default="all", pattern="^(all|official|tenant)$"),
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> CmsQuestionListOut:
    """List question bank items inside CMS with full filters and lint metadata."""
    return LMSService(db).list_questions_cms(
        current_user,
        grade=grade,
        lesson_no=lesson_no,
        language=language,
        cognitive_level=cognitive_level,
        discipline=discipline,
        linter_verified=linter_verified,
        scope=scope,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/lms/cms/questions",
    response_model=CmsQuestionOut,
    status_code=status.HTTP_201_CREATED,
)
def create_cms_question(
    payload: CmsQuestionCreateRequest,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> CmsQuestionOut:
    """Create a question in CMS with automatic IUPAC/SI lint evaluation."""
    return LMSService(db).create_question_cms(current_user, payload)


@router.patch("/lms/cms/questions/{question_id}", response_model=CmsQuestionOut)
def update_cms_question(
    question_id: str,
    payload: CmsQuestionUpdateRequest,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> CmsQuestionOut:
    """Update a question item inside caller's authorized scope."""
    return LMSService(db).update_question_cms(current_user, question_id, payload)


@router.delete("/lms/cms/questions/{question_id}")
def delete_cms_question(
    question_id: str,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete a question item inside caller's authorized scope."""
    return LMSService(db).delete_question_cms(current_user, question_id)


@router.post("/lms/cms/questions/import-csv", response_model=CmsQuestionCsvImportOut)
def import_cms_questions_csv(
    payload: CmsQuestionCsvImportRequest,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> CmsQuestionCsvImportOut:
    """Bulk import MCQ questions from CSV with automatic IUPAC/SI lint verification."""
    return LMSService(db).import_questions_csv_cms(current_user, payload)


@router.get("/lms/cms/resources", response_model=CmsResourceListOut)
def list_cms_resources(
    grade: int | None = Query(default=None, ge=6, le=9),
    lesson_no: int | None = Query(default=None, ge=1, le=60),
    resource_type: str | None = Query(default=None),
    clil_mode: str | None = Query(default=None),
    scope: str = Query(default="all", pattern="^(all|official|tenant)$"),
    q: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> CmsResourceListOut:
    """List CLIL lesson plans, bilingual slides, and worksheets in CMS."""
    return LMSService(db).list_resources_cms(
        current_user,
        grade=grade,
        lesson_no=lesson_no,
        resource_type=resource_type,
        clil_mode=clil_mode,
        scope=scope,
        q=q,
        limit=limit,
        offset=offset,
    )


@router.post(
    "/lms/cms/resources",
    response_model=CmsResourceOut,
    status_code=status.HTTP_201_CREATED,
)
def create_cms_resource(
    payload: CmsResourceCreateRequest,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> CmsResourceOut:
    """Create a CLIL Markdown resource in CMS with live IUPAC/SI linting."""
    return LMSService(db).create_resource_cms(current_user, payload)


@router.patch("/lms/cms/resources/{resource_id}", response_model=CmsResourceOut)
def update_cms_resource(
    resource_id: str,
    payload: CmsResourceUpdateRequest,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> CmsResourceOut:
    """Update a CLIL Markdown resource inside caller's authorized scope."""
    return LMSService(db).update_resource_cms(current_user, resource_id, payload)


@router.delete("/lms/cms/resources/{resource_id}")
def delete_cms_resource(
    resource_id: str,
    current_user: User = Depends(require_roles(*TEACHER_ROLES)),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete a CLIL Markdown resource inside caller's authorized scope."""
    return LMSService(db).delete_resource_cms(current_user, resource_id)

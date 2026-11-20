"""Database queries for Unit 3 (lms)."""

from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload, selectinload

from app.modules.lms.models import (
    Assignment,
    Classroom,
    ClassroomMember,
    Exam,
    ExamQuestion,
    QuestionBankItem,
    StudentSubmission,
    TeacherResource,
    TeachingSessionLog,
)


class LMSRepository:
    """Encapsulates tenant-scoped persistence for classrooms, exams, and TT94 logs."""

    def __init__(self, db: Session) -> None:
        self.db = db

    # --- Classrooms & Members ---
    def create_classroom(self, classroom: Classroom) -> Classroom:
        self.db.add(classroom)
        self.db.flush()
        return classroom

    def get_classroom(self, classroom_id: str) -> Classroom | None:
        stmt = (
            select(Classroom)
            .options(selectinload(Classroom.members))
            .where(Classroom.id == classroom_id)
        )
        return self.db.scalar(stmt)

    def get_classroom_by_join_code(self, join_code: str) -> Classroom | None:
        stmt = (
            select(Classroom)
            .options(selectinload(Classroom.members))
            .where(Classroom.join_code == join_code.strip().upper())
        )
        return self.db.scalar(stmt)

    def list_classrooms_for_tenant(self, tenant_id: str) -> list[Classroom]:
        stmt = (
            select(Classroom)
            .options(selectinload(Classroom.members))
            .where(Classroom.tenant_id == tenant_id)
            .order_by(Classroom.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_membership(self, classroom_id: str, student_id: str) -> ClassroomMember | None:
        stmt = select(ClassroomMember).where(
            ClassroomMember.classroom_id == classroom_id,
            ClassroomMember.student_id == student_id,
        )
        return self.db.scalar(stmt)

    def add_member(self, member: ClassroomMember) -> ClassroomMember:
        self.db.add(member)
        self.db.flush()
        return member

    def list_student_classroom_ids(self, student_id: str) -> list[str]:
        stmt = select(ClassroomMember.classroom_id).where(
            ClassroomMember.student_id == student_id
        )
        return list(self.db.scalars(stmt).all())

    def list_classrooms_for_student(self, student_id: str) -> list[Classroom]:
        stmt = (
            select(Classroom)
            .join(ClassroomMember, ClassroomMember.classroom_id == Classroom.id)
            .options(selectinload(Classroom.members))
            .where(ClassroomMember.student_id == student_id)
            .order_by(Classroom.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    # --- Resources ---
    def create_teacher_resource(self, resource: TeacherResource) -> TeacherResource:
        self.db.add(resource)
        self.db.flush()
        return resource

    def list_custom_resources(
        self, tenant_id: str, lesson_no: int | None = None, grade: int | None = None
    ) -> list[TeacherResource]:
        stmt = select(TeacherResource).where(
            or_(TeacherResource.tenant_id.is_(None), TeacherResource.tenant_id == tenant_id),
            TeacherResource.resource_type != "game_challenge",
        )
        if grade is not None:
            stmt = stmt.where(TeacherResource.grade == grade)
        if lesson_no is not None:
            stmt = stmt.where(TeacherResource.lesson_no == lesson_no)
        return list(self.db.scalars(stmt).all())

    def list_game_challenges_for_tenants(self, tenant_ids: list[str]) -> list[TeacherResource]:
        if not tenant_ids:
            return []
        stmt = (
            select(TeacherResource)
            .where(
                TeacherResource.tenant_id.in_(tenant_ids),
                TeacherResource.resource_type == "game_challenge",
            )
            .order_by(TeacherResource.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    # --- Question Bank ---
    def create_question(self, item: QuestionBankItem) -> QuestionBankItem:
        self.db.add(item)
        self.db.flush()
        return item

    def list_questions(
        self,
        *,
        tenant_id: str,
        grade: int | None = None,
        lesson_nos: list[int] | None = None,
        language: str | None = None,
    ) -> list[QuestionBankItem]:
        stmt = select(QuestionBankItem).where(
            or_(QuestionBankItem.tenant_id.is_(None), QuestionBankItem.tenant_id == tenant_id)
        )
        if grade is not None:
            stmt = stmt.where(QuestionBankItem.grade == grade)
        if lesson_nos:
            stmt = stmt.where(QuestionBankItem.lesson_no.in_(lesson_nos))
        if language:
            stmt = stmt.where(QuestionBankItem.language == language)
        stmt = stmt.order_by(QuestionBankItem.created_at.desc())
        return list(self.db.scalars(stmt).all())

    # --- Exams ---
    def create_exam(self, exam: Exam, links: list[ExamQuestion]) -> Exam:
        self.db.add(exam)
        self.db.flush()
        for link in links:
            link.exam_id = exam.id
            self.db.add(link)
        self.db.flush()
        return exam

    def get_exam(self, exam_id: str) -> Exam | None:
        stmt = (
            select(Exam)
            .options(selectinload(Exam.exam_questions).joinedload(ExamQuestion.question))
            .where(Exam.id == exam_id)
        )
        return self.db.scalar(stmt)

    def list_exams_for_tenant(self, tenant_id: str) -> list[Exam]:
        stmt = (
            select(Exam)
            .options(selectinload(Exam.exam_questions))
            .where(Exam.tenant_id == tenant_id)
            .order_by(Exam.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    # --- Assignments & Submissions ---
    def create_assignment(self, assignment: Assignment) -> Assignment:
        self.db.add(assignment)
        self.db.flush()
        return assignment

    def get_assignment(self, assignment_id: str) -> Assignment | None:
        stmt = (
            select(Assignment)
            .options(
                joinedload(Assignment.classroom),
                joinedload(Assignment.exam)
                .selectinload(Exam.exam_questions)
                .joinedload(ExamQuestion.question),
            )
            .where(Assignment.id == assignment_id)
        )
        return self.db.scalar(stmt)

    def list_assignments_for_classrooms(self, classroom_ids: list[str]) -> list[Assignment]:
        if not classroom_ids:
            return []
        stmt = (
            select(Assignment)
            .options(
                joinedload(Assignment.classroom),
                joinedload(Assignment.exam),
            )
            .where(Assignment.classroom_id.in_(classroom_ids))
            .order_by(Assignment.created_at.desc())
        )
        return list(self.db.scalars(stmt).all())

    def get_submission(self, assignment_id: str, student_id: str) -> StudentSubmission | None:
        stmt = select(StudentSubmission).where(
            StudentSubmission.assignment_id == assignment_id,
            StudentSubmission.student_id == student_id,
        )
        return self.db.scalar(stmt)

    def list_submissions_for_student(self, student_id: str) -> dict[str, StudentSubmission]:
        stmt = select(StudentSubmission).where(StudentSubmission.student_id == student_id)
        return {s.assignment_id: s for s in self.db.scalars(stmt).all()}

    def list_submissions_for_classroom(
        self, classroom_id: str
    ) -> list[tuple[StudentSubmission, str]]:
        stmt = (
            select(StudentSubmission, Assignment.title)
            .join(Assignment, Assignment.id == StudentSubmission.assignment_id)
            .where(Assignment.classroom_id == classroom_id)
            .order_by(StudentSubmission.submitted_at.desc())
        )
        return list(self.db.execute(stmt).all())  # type: ignore[arg-type]

    def create_submission(self, submission: StudentSubmission) -> StudentSubmission:
        self.db.add(submission)
        self.db.flush()
        return submission

    # --- Teaching Session Logs ---
    def create_session_log(self, log: TeachingSessionLog) -> TeachingSessionLog:
        self.db.add(log)
        self.db.flush()
        return log

    def list_session_logs(
        self, tenant_id: str, classroom_id: str | None = None
    ) -> list[TeachingSessionLog]:
        stmt = select(TeachingSessionLog).where(TeachingSessionLog.tenant_id == tenant_id)
        if classroom_id:
            stmt = stmt.where(TeachingSessionLog.classroom_id == classroom_id)
        stmt = stmt.order_by(
            TeachingSessionLog.taught_date.desc(), TeachingSessionLog.created_at.desc()
        )
        return list(self.db.scalars(stmt).all())

    def sum_periods_by_classroom(self, tenant_id: str) -> dict[str, tuple[int, int]]:
        stmt = (
            select(
                TeachingSessionLog.classroom_id,
                func.sum(TeachingSessionLog.periods_count),
                func.sum(TeachingSessionLog.english_minutes),
            )
            .where(TeachingSessionLog.tenant_id == tenant_id)
            .group_by(TeachingSessionLog.classroom_id)
        )
        result: dict[str, tuple[int, int]] = {}
        for cid, periods, minutes in self.db.execute(stmt).all():
            result[str(cid)] = (int(periods or 0), int(minutes or 0))
        return result

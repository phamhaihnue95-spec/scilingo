"""Business logic for Unit 3: Teacher Studio, LMS, Exam Builder & TT94 Compliance."""

from __future__ import annotations

import csv
import io
import secrets
import string
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.curriculum.schemas import LintCheckOut
from app.modules.curriculum.service import CurriculumService
from app.modules.identity_billing.models import User
from app.modules.identity_billing.service import IdentityService
from app.modules.learning.service import LearningService
from app.modules.lms.exam_engine import (
    compute_exam_allocation,
    synthesize_questions_from_curriculum,
    synthesize_questions_from_study_pack,
)
from app.modules.lms.exporter import export_exam_docx, export_exam_pdf
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
from app.modules.lms.repository import LMSRepository
from app.modules.lms.resources_builder import build_lesson_clil_pack
from app.modules.lms.schemas import (
    AssignmentCreateRequest,
    AssignmentOut,
    AssignmentQuestionPublicOut,
    AssignmentSubmitRequest,
    AssignmentTakeOut,
    ClassroomAnalyticsOut,
    ClassroomCreateRequest,
    ClassroomLeaderboardOut,
    ClassroomOut,
    ClassroomTT94MetricsOut,
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
    ExamQuestionOut,
    ExamSummaryOut,
    GameChallengeCreateRequest,
    GameChallengeOut,
    GradeTT94MetricsOut,
    LeaderboardEntryOut,
    QuestionCreateRequest,
    QuestionOut,
    StudentSubmissionSummaryOut,
    SubmissionResultOut,
    TeacherResourceOut,
    TeachingSessionCreateRequest,
    TeachingSessionOut,
    TT94ComplianceReportOut,
    WeakQuestionOut,
)


def _generate_join_code(grade: int) -> str:
    alphabet = string.ascii_uppercase + string.digits
    suffix = "".join(secrets.choice(alphabet) for _ in range(4))
    return f"KHTN{grade}-{suffix}"


class LMSService:
    """Coordinates classroom LMS, CLIL resources, Exam Builder, and TT94 reporting."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = LMSRepository(db)
        self.curriculum = CurriculumService(db)
        self.identity = IdentityService(db)
        self.learning = LearningService(db)

    # --- Classrooms ---
    def create_classroom(self, teacher: User, payload: ClassroomCreateRequest) -> ClassroomOut:
        join_code = _generate_join_code(payload.grade)
        while self.repo.get_classroom_by_join_code(join_code) is not None:
            join_code = _generate_join_code(payload.grade)

        classroom = Classroom(
            tenant_id=teacher.tenant_id,
            teacher_id=teacher.id,
            name=payload.name.strip(),
            grade=payload.grade,
            academic_year=payload.academic_year.strip(),
            join_code=join_code,
            is_tt94_pilot_class=payload.is_tt94_pilot_class,
        )
        self.repo.create_classroom(classroom)
        self.db.commit()
        self.db.refresh(classroom)
        return ClassroomOut(
            id=classroom.id,
            tenant_id=classroom.tenant_id,
            teacher_id=classroom.teacher_id,
            name=classroom.name,
            grade=classroom.grade,
            academic_year=classroom.academic_year,
            join_code=classroom.join_code,
            is_tt94_pilot_class=classroom.is_tt94_pilot_class,
            created_at=classroom.created_at,
            student_count=0,
            logged_periods=0,
        )

    def list_classrooms(self, current_user: User) -> list[ClassroomOut]:
        classrooms = self.repo.list_classrooms_for_tenant(current_user.tenant_id)
        periods_map = self.repo.sum_periods_by_classroom(current_user.tenant_id)
        return [
            ClassroomOut(
                id=c.id,
                tenant_id=c.tenant_id,
                teacher_id=c.teacher_id,
                name=c.name,
                grade=c.grade,
                academic_year=c.academic_year,
                join_code=c.join_code,
                is_tt94_pilot_class=c.is_tt94_pilot_class,
                created_at=c.created_at,
                student_count=len(c.members),
                logged_periods=periods_map.get(c.id, (0, 0))[0],
            )
            for c in classrooms
        ]

    def join_classroom(self, student: User, join_code: str) -> ClassroomOut:
        classroom = self.repo.get_classroom_by_join_code(join_code)
        if classroom is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy lớp học với mã tham gia này.",
            )
        existing = self.repo.get_membership(classroom.id, student.id)
        if existing is None:
            self.repo.add_member(ClassroomMember(classroom_id=classroom.id, student_id=student.id))
            self.db.commit()
            self.db.refresh(classroom, attribute_names=["members"])

        periods_map = self.repo.sum_periods_by_classroom(classroom.tenant_id)
        return ClassroomOut(
            id=classroom.id,
            tenant_id=classroom.tenant_id,
            teacher_id=classroom.teacher_id,
            name=classroom.name,
            grade=classroom.grade,
            academic_year=classroom.academic_year,
            join_code=classroom.join_code,
            is_tt94_pilot_class=classroom.is_tt94_pilot_class,
            created_at=classroom.created_at,
            student_count=len(classroom.members),
            logged_periods=periods_map.get(classroom.id, (0, 0))[0],
        )

    def list_student_classrooms(self, student: User) -> list[ClassroomOut]:
        classrooms = self.repo.list_classrooms_for_student(student.id)
        tenant_ids = {c.tenant_id for c in classrooms}
        periods_map: dict[str, tuple[int, int]] = {}
        for tid in tenant_ids:
            periods_map.update(self.repo.sum_periods_by_classroom(tid))
        return [
            ClassroomOut(
                id=c.id,
                tenant_id=c.tenant_id,
                teacher_id=c.teacher_id,
                name=c.name,
                grade=c.grade,
                academic_year=c.academic_year,
                join_code=c.join_code,
                is_tt94_pilot_class=c.is_tt94_pilot_class,
                created_at=c.created_at,
                student_count=len(c.members),
                logged_periods=periods_map.get(c.id, (0, 0))[0],
            )
            for c in classrooms
        ]

    def _ensure_classroom_access(self, caller: User, classroom_id: str) -> Classroom:
        classroom = self.repo.get_classroom(classroom_id)
        if classroom is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy lớp học.",
            )
        if caller.role in ("teacher", "school_admin", "platform_admin"):
            if classroom.tenant_id != caller.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Không tìm thấy lớp học trong trường của bạn.",
                )
        else:
            if self.repo.get_membership(classroom.id, caller.id) is None:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Bạn chưa tham gia lớp học này.",
                )
        return classroom

    def get_classroom_leaderboard(self, caller: User, classroom_id: str) -> ClassroomLeaderboardOut:
        classroom = self._ensure_classroom_access(caller, classroom_id)
        member_ids = [m.student_id for m in classroom.members]
        names_map = self.identity.get_user_names_map(member_ids)
        gamif_map = self.learning.get_students_gamification_map(member_ids)
        pet_map = self.learning.get_students_pet_map(member_ids, gamif_map)

        sub_scores: dict[str, list[float]] = {}
        for sub, _ in self.repo.list_submissions_for_classroom(classroom.id):
            sub_scores.setdefault(sub.student_id, []).append(float(sub.score))

        raw_entries: list[LeaderboardEntryOut] = []
        for sid in member_ids:
            stats = gamif_map.get(sid, {})
            pet_info = pet_map.get(sid, {})
            badges = list(stats.get("badges", []))
            scidex_count = sum(1 for b in badges if str(b).startswith("SciDex: Unit "))
            scores = sub_scores.get(sid, [])
            avg_score = round(sum(scores) / len(scores), 2) if scores else None
            raw_entries.append(
                LeaderboardEntryOut(
                    rank=0,
                    student_id=sid,
                    student_name=names_map.get(sid, "Học sinh"),
                    total_xp=int(stats.get("total_xp", 0)),
                    level=int(stats.get("level", 1)),
                    current_streak=int(stats.get("current_streak", 0)),
                    badges_count=len(badges),
                    scidex_count=scidex_count,
                    badges=badges,
                    avg_assignment_score=avg_score,
                    pet_species=pet_info.get("species"),
                    pet_nickname=pet_info.get("nickname"),
                    pet_stage=pet_info.get("stage"),
                    pet_accessory=pet_info.get("accessory"),
                )
            )

        raw_entries.sort(key=lambda e: (-e.total_xp, -e.current_streak, e.student_name.lower()))
        ranked = [
            entry.model_copy(update={"rank": idx + 1}) for idx, entry in enumerate(raw_entries)
        ]
        return ClassroomLeaderboardOut(
            classroom_id=classroom.id,
            classroom_name=classroom.name,
            join_code=classroom.join_code,
            total_students=len(ranked),
            entries=ranked,
        )

    def _to_game_challenge_out(
        self, res: TeacherResource, classroom_names: dict[str, str]
    ) -> GameChallengeOut:
        meta = dict(res.metadata_json or {})
        cid = str(meta.get("classroom_id", ""))
        unit_raw = meta.get("unit_no")
        unit_no = int(unit_raw) if unit_raw is not None else None
        return GameChallengeOut(
            id=res.id,
            classroom_id=cid,
            classroom_name=classroom_names.get(cid, "Lớp KHTN 8"),
            title=res.title,
            game_type=str(meta.get("game_type", "lightning_match")),  # type: ignore[arg-type]
            unit_no=unit_no,
            target_score=int(meta.get("target_score", 80)),
            duration_minutes=int(meta.get("duration_minutes", 5)),
            instructions=res.content_markdown,
            created_by_name=str(meta.get("created_by_name", "Giáo viên")),
            created_at=res.created_at,
        )

    def create_game_challenge(
        self, teacher: User, classroom_id: str, payload: GameChallengeCreateRequest
    ) -> GameChallengeOut:
        classroom = self.repo.get_classroom(classroom_id)
        if classroom is None or classroom.tenant_id != teacher.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy lớp học trong trường của bạn.",
            )
        instructions = payload.instructions.strip() or (
            f"Hoàn thành thử thách {payload.duration_minutes} phút cho lớp {classroom.name}."
        )
        res = TeacherResource(
            lesson_no=payload.unit_no or 1,
            tenant_id=teacher.tenant_id,
            title=payload.title.strip(),
            resource_type="game_challenge",
            clil_mode="bilingual_50",
            content_markdown=instructions,
            metadata_json={
                "classroom_id": classroom.id,
                "game_type": payload.game_type,
                "unit_no": payload.unit_no,
                "target_score": payload.target_score,
                "duration_minutes": payload.duration_minutes,
                "created_by_name": teacher.full_name,
            },
            is_official=False,
        )
        self.repo.create_teacher_resource(res)
        self.db.commit()
        self.db.refresh(res)
        return self._to_game_challenge_out(res, {classroom.id: classroom.name})

    def list_classroom_game_challenges(
        self, caller: User, classroom_id: str
    ) -> list[GameChallengeOut]:
        classroom = self._ensure_classroom_access(caller, classroom_id)
        rows = self.repo.list_game_challenges_for_tenants([classroom.tenant_id])
        cnames = {classroom.id: classroom.name}
        return [
            self._to_game_challenge_out(r, cnames)
            for r in rows
            if (r.metadata_json or {}).get("classroom_id") == classroom.id
        ]

    def list_student_game_challenges(self, student: User) -> list[GameChallengeOut]:
        classrooms = self.repo.list_classrooms_for_student(student.id)
        if not classrooms:
            return []
        classroom_names = {c.id: c.name for c in classrooms}
        tenant_ids = list({c.tenant_id for c in classrooms})
        rows = self.repo.list_game_challenges_for_tenants(tenant_ids)
        return [
            self._to_game_challenge_out(r, classroom_names)
            for r in rows
            if (r.metadata_json or {}).get("classroom_id") in classroom_names
        ]

    # --- CLIL Resources ---
    def get_resources_for_lesson(
        self, current_user: User, lesson_no: int, grade: int = 8
    ) -> list[TeacherResourceOut]:
        lesson = self.curriculum.get_lesson_detail(lesson_no, grade=grade)
        official_pack = build_lesson_clil_pack(lesson)
        custom = self.repo.list_custom_resources(
            current_user.tenant_id, lesson_no=lesson_no, grade=grade
        )
        custom_outs = [
            TeacherResourceOut(
                id=r.id,
                grade=r.grade,
                lesson_no=r.lesson_no,
                title=r.title,
                resource_type=r.resource_type,  # type: ignore[arg-type]
                clil_mode=r.clil_mode,  # type: ignore[arg-type]
                content_markdown=r.content_markdown,
                is_official=r.is_official,
            )
            for r in custom
        ]
        return [*official_pack, *custom_outs]

    # --- Question Bank ---
    def create_question(self, teacher: User, payload: QuestionCreateRequest) -> QuestionOut:
        self.curriculum.get_lesson_detail(payload.lesson_no, grade=payload.grade)
        correct_answer = payload.options[payload.correct_index]
        item = QuestionBankItem(
            grade=payload.grade,
            lesson_no=payload.lesson_no,
            author_id=teacher.id,
            tenant_id=teacher.tenant_id,
            question_type="mcq",
            language=payload.language,
            cognitive_level=payload.cognitive_level,
            discipline=payload.discipline,
            prompt_text=payload.prompt_text.strip(),
            options_json=payload.options,
            correct_answer=correct_answer,
            explanation_vi=payload.explanation_vi.strip(),
            linked_term_ids_json=[],
            linter_verified=True,
        )
        self.repo.create_question(item)
        self.db.commit()
        return QuestionOut(
            id=item.id,
            grade=item.grade,
            lesson_no=item.lesson_no,
            language=item.language,
            cognitive_level=item.cognitive_level,
            discipline=item.discipline,
            prompt_text=item.prompt_text,
            options=item.options_json,
            correct_answer=item.correct_answer,
            explanation_vi=item.explanation_vi,
            linter_verified=item.linter_verified,
        )

    def list_questions(
        self,
        teacher: User,
        grade: int | None = None,
        lesson_no: int | None = None,
        language: str | None = None,
    ) -> list[QuestionOut]:
        items = self.repo.list_questions(
            tenant_id=teacher.tenant_id,
            grade=grade,
            lesson_nos=[lesson_no] if lesson_no else None,
            language=language,
        )
        return [
            QuestionOut(
                id=q.id,
                grade=q.grade,
                lesson_no=q.lesson_no,
                language=q.language,
                cognitive_level=q.cognitive_level,
                discipline=q.discipline,
                prompt_text=q.prompt_text,
                options=q.options_json,
                correct_answer=q.correct_answer,
                explanation_vi=q.explanation_vi,
                linter_verified=q.linter_verified,
            )
            for q in items
        ]

    # --- Exam Builder & Export ---
    def _save_synthesized_questions(
        self, teacher: User, grade: int, synthesized: list[dict]
    ) -> list[QuestionBankItem]:
        saved: list[QuestionBankItem] = []
        for q_dict in synthesized:
            item = QuestionBankItem(
                grade=grade,
                lesson_no=q_dict["lesson_no"],
                author_id=teacher.id,
                tenant_id=teacher.tenant_id,
                question_type="mcq",
                language=q_dict["language"],
                cognitive_level=q_dict["cognitive_level"],
                discipline=q_dict["discipline"],
                prompt_text=q_dict["prompt_text"],
                options_json=q_dict["options"],
                correct_answer=q_dict["correct_answer"],
                explanation_vi=q_dict["explanation_vi"],
                linked_term_ids_json=q_dict["linked_term_ids"],
                linter_verified=True,
            )
            self.repo.create_question(item)
            saved.append(item)
        return saved

    def _ensure_questions_for_language(
        self,
        *,
        teacher: User,
        grade: int,
        lessons: list,
        all_terms: list,
        study_pack_units: list,
        all_pack_items: list,
        language: str,
        needed: int,
    ) -> list[QuestionBankItem]:
        if needed <= 0:
            return []
        if study_pack_units and not lessons:
            synthesized = synthesize_questions_from_study_pack(
                units=study_pack_units,
                all_items=all_pack_items,
                language=language,
                needed=needed,
            )
            return self._save_synthesized_questions(teacher, grade, synthesized)[:needed]

        lesson_nos = [lesson.lesson_no for lesson in lessons]
        existing = self.repo.list_questions(
            tenant_id=teacher.tenant_id,
            grade=grade,
            lesson_nos=lesson_nos,
            language=language,
        )
        selected = existing[:needed]
        shortfall = needed - len(selected)
        if shortfall > 0:
            if study_pack_units:
                study_count = max(1, shortfall // 2)
                synthesized_pack = synthesize_questions_from_study_pack(
                    units=study_pack_units,
                    all_items=all_pack_items,
                    language=language,
                    needed=study_count,
                )
                selected.extend(self._save_synthesized_questions(teacher, grade, synthesized_pack))
                shortfall = needed - len(selected)
            if shortfall > 0 and lessons:
                synthesized = synthesize_questions_from_curriculum(
                    lessons=lessons,
                    all_terms=all_terms,
                    language=language,
                    needed=shortfall,
                )
                selected.extend(self._save_synthesized_questions(teacher, grade, synthesized))
        return selected[:needed]

    def _to_exam_detail(self, exam: Exam) -> ExamDetailOut:
        ordered = sorted(exam.exam_questions, key=lambda eq: eq.order_no)
        q_outs: list[ExamQuestionOut] = []
        en_points = 0.0
        vi_points = 0.0
        for eq in ordered:
            q = eq.question
            if q.language == "en":
                en_points += eq.points
            else:
                vi_points += eq.points
            q_outs.append(
                ExamQuestionOut(
                    order_no=eq.order_no,
                    question_id=q.id,
                    lesson_no=q.lesson_no,
                    language=q.language,
                    cognitive_level=q.cognitive_level,
                    discipline=q.discipline,
                    points=eq.points,
                    prompt_text=q.prompt_text,
                    options=q.options_json,
                    correct_answer=q.correct_answer,
                    explanation_vi=q.explanation_vi,
                )
            )
        en_points = round(en_points, 2)
        vi_points = round(vi_points, 2)
        return ExamDetailOut(
            id=exam.id,
            grade=exam.grade,
            title=exam.title,
            classroom_id=exam.classroom_id,
            target_en_ratio=exam.target_en_ratio,
            achieved_en_ratio=exam.achieved_en_ratio,
            total_points=exam.total_points,
            duration_minutes=exam.duration_minutes,
            question_count=len(ordered),
            created_at=exam.created_at,
            en_points=en_points,
            vi_points=vi_points,
            meets_tt94_10=exam.achieved_en_ratio >= 0.10,
            meets_tt94_50=exam.achieved_en_ratio >= 0.50,
            questions=q_outs,
        )

    def generate_exam(self, teacher: User, payload: ExamGenerateRequest) -> ExamDetailOut:
        if payload.classroom_id:
            classroom = self.repo.get_classroom(payload.classroom_id)
            if classroom is None or classroom.tenant_id != teacher.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Không tìm thấy lớp học trong trường của bạn.",
                )

        lessons = [
            self.curriculum.get_lesson_detail(no, grade=payload.grade)
            for no in sorted(set(payload.lesson_nos))
        ]
        all_terms = (
            self.curriculum.search_terms(grade=payload.grade, limit=200).items if lessons else []
        )
        study_pack_units = [
            self.curriculum.get_english_science_unit(u_no)
            for u_no in sorted(set(payload.study_pack_unit_nos))
        ]
        all_pack_items = (
            self.curriculum.search_english_science_items(limit=1000).items
            if study_pack_units
            else []
        )
        plan = compute_exam_allocation(
            question_count=payload.question_count,
            total_points=payload.total_points,
            target_en_ratio=payload.target_en_ratio,
        )

        vi_questions = self._ensure_questions_for_language(
            teacher=teacher,
            grade=payload.grade,
            lessons=lessons,
            all_terms=all_terms,
            study_pack_units=study_pack_units,
            all_pack_items=all_pack_items,
            language="vi",
            needed=plan.vi_count,
        )
        en_questions = self._ensure_questions_for_language(
            teacher=teacher,
            grade=payload.grade,
            lessons=lessons,
            all_terms=all_terms,
            study_pack_units=study_pack_units,
            all_pack_items=all_pack_items,
            language="en",
            needed=plan.en_count,
        )

        ordered_items = [*vi_questions, *en_questions]
        links = [
            ExamQuestion(
                question_id=item.id,
                order_no=idx + 1,
                points=plan.points_per_question[idx],
            )
            for idx, item in enumerate(ordered_items)
        ]

        exam = Exam(
            tenant_id=teacher.tenant_id,
            teacher_id=teacher.id,
            classroom_id=payload.classroom_id,
            grade=payload.grade,
            title=payload.title.strip(),
            target_en_ratio=payload.target_en_ratio,
            achieved_en_ratio=plan.achieved_en_ratio,
            total_points=payload.total_points,
            duration_minutes=payload.duration_minutes,
            matrix_json={
                "grade": payload.grade,
                "lesson_nos": [lesson.lesson_no for lesson in lessons],
                "study_pack_unit_nos": [u.unit.unit_no for u in study_pack_units],
                "vi_count": plan.vi_count,
                "en_count": plan.en_count,
                "vi_points": plan.vi_points,
                "en_points": plan.en_points,
            },
        )
        self.repo.create_exam(exam, links)
        self.db.commit()
        loaded = self.repo.get_exam(exam.id)
        assert loaded is not None
        return self._to_exam_detail(loaded)

    def list_exams(self, teacher: User) -> list[ExamSummaryOut]:
        exams = self.repo.list_exams_for_tenant(teacher.tenant_id)
        return [
            ExamSummaryOut(
                id=e.id,
                grade=e.grade,
                title=e.title,
                classroom_id=e.classroom_id,
                target_en_ratio=e.target_en_ratio,
                achieved_en_ratio=e.achieved_en_ratio,
                total_points=e.total_points,
                duration_minutes=e.duration_minutes,
                question_count=len(e.exam_questions),
                created_at=e.created_at,
            )
            for e in exams
        ]

    def get_exam_detail(self, teacher: User, exam_id: str) -> ExamDetailOut:
        exam = self.repo.get_exam(exam_id)
        if exam is None or exam.tenant_id != teacher.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy đề kiểm tra.",
            )
        return self._to_exam_detail(exam)

    def export_exam(self, teacher: User, exam_id: str, fmt: str) -> tuple[bytes, str, str]:
        exam = self.repo.get_exam(exam_id)
        if exam is None or exam.tenant_id != teacher.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy đề kiểm tra.",
            )
        detail = self._to_exam_detail(exam)
        school_name = self.identity.get_tenant_name(teacher.tenant_id)
        teacher_name = self.identity.get_user_names_map([exam.teacher_id]).get(
            exam.teacher_id, teacher.full_name
        )
        if fmt == "docx":
            content = export_exam_docx(detail, school_name, teacher_name=teacher_name)
            media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            filename = f"exam-{exam_id[:8]}.docx"
            return content, media, filename
        if fmt == "pdf":
            content = export_exam_pdf(detail, school_name, teacher_name=teacher_name)
            return content, "application/pdf", f"exam-{exam_id[:8]}.pdf"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Định dạng xuất không hợp lệ (chỉ hỗ trợ docx hoặc pdf).",
        )

    # --- Assignments & Classroom Analytics ---
    def assign_exam_to_classroom(
        self, teacher: User, classroom_id: str, payload: AssignmentCreateRequest
    ) -> AssignmentOut:
        classroom = self.repo.get_classroom(classroom_id)
        if classroom is None or classroom.tenant_id != teacher.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy lớp học trong trường của bạn.",
            )
        exam = self.repo.get_exam(payload.exam_id)
        if exam is None or exam.tenant_id != teacher.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy đề kiểm tra trong trường của bạn.",
            )
        assignment = Assignment(
            classroom_id=classroom.id,
            exam_id=exam.id,
            title=(payload.title or exam.title).strip(),
            due_at=payload.due_at,
        )
        self.repo.create_assignment(assignment)
        self.db.commit()
        return AssignmentOut(
            id=assignment.id,
            classroom_id=classroom.id,
            classroom_name=classroom.name,
            exam_id=exam.id,
            title=assignment.title,
            total_points=exam.total_points,
            achieved_en_ratio=exam.achieved_en_ratio,
            duration_minutes=exam.duration_minutes,
            due_at=assignment.due_at,
            created_at=assignment.created_at,
        )

    def list_student_assignments(self, student: User) -> list[AssignmentOut]:
        classroom_ids = self.repo.list_student_classroom_ids(student.id)
        assignments = self.repo.list_assignments_for_classrooms(classroom_ids)
        submissions = self.repo.list_submissions_for_student(student.id)
        results: list[AssignmentOut] = []
        for a in assignments:
            sub = submissions.get(a.id)
            results.append(
                AssignmentOut(
                    id=a.id,
                    classroom_id=a.classroom_id,
                    classroom_name=a.classroom.name,
                    exam_id=a.exam_id,
                    title=a.title,
                    total_points=a.exam.total_points,
                    achieved_en_ratio=a.exam.achieved_en_ratio,
                    duration_minutes=a.exam.duration_minutes,
                    due_at=a.due_at,
                    created_at=a.created_at,
                    submitted=sub is not None,
                    student_score=sub.score if sub else None,
                )
            )
        return results

    def take_assignment(self, student: User, assignment_id: str) -> AssignmentTakeOut:
        assignment = self.repo.get_assignment(assignment_id)
        if assignment is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy bài tập được giao.")
        if self.repo.get_membership(assignment.classroom_id, student.id) is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn chưa tham gia lớp học chứa bài kiểm tra này.",
            )
        ordered = sorted(assignment.exam.exam_questions, key=lambda eq: eq.order_no)
        questions = [
            AssignmentQuestionPublicOut(
                order_no=eq.order_no,
                question_id=eq.question_id,
                language=eq.question.language,
                points=eq.points,
                prompt_text=eq.question.prompt_text,
                options=eq.question.options_json,
            )
            for eq in ordered
        ]
        return AssignmentTakeOut(
            assignment_id=assignment.id,
            title=assignment.title,
            classroom_name=assignment.classroom.name,
            total_points=assignment.exam.total_points,
            achieved_en_ratio=assignment.exam.achieved_en_ratio,
            duration_minutes=assignment.exam.duration_minutes,
            questions=questions,
        )

    def submit_assignment(
        self, student: User, assignment_id: str, payload: AssignmentSubmitRequest
    ) -> SubmissionResultOut:
        assignment = self.repo.get_assignment(assignment_id)
        if assignment is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy bài tập.")
        if self.repo.get_membership(assignment.classroom_id, student.id) is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn chưa tham gia lớp học này.",
            )
        if self.repo.get_submission(assignment_id, student.id) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bạn đã nộp bài kiểm tra này trước đó.",
            )

        answer_map = {item.question_id: item.selected_index for item in payload.answers}
        vi_score = 0.0
        en_score = 0.0
        max_score = 0.0
        graded_answers: list[dict] = []

        for eq in assignment.exam.exam_questions:
            q = eq.question
            max_score += eq.points
            sel_idx = answer_map.get(q.id)
            chosen_text = (
                q.options_json[sel_idx]
                if sel_idx is not None and 0 <= sel_idx < len(q.options_json)
                else None
            )
            is_correct = chosen_text is not None and chosen_text == q.correct_answer
            if is_correct:
                if q.language == "en":
                    en_score += eq.points
                else:
                    vi_score += eq.points
            graded_answers.append(
                {
                    "question_id": q.id,
                    "selected_index": sel_idx,
                    "is_correct": is_correct,
                }
            )

        total_score = round(vi_score + en_score, 2)
        submission = StudentSubmission(
            assignment_id=assignment.id,
            student_id=student.id,
            score=total_score,
            max_score=round(max_score, 2),
            vi_score=round(vi_score, 2),
            en_score=round(en_score, 2),
            answers_json=graded_answers,
            submitted_at=datetime.now(UTC),
        )
        self.repo.create_submission(submission)
        self.db.commit()
        return SubmissionResultOut(
            submission_id=submission.id,
            assignment_id=submission.assignment_id,
            score=submission.score,
            max_score=submission.max_score,
            vi_score=submission.vi_score,
            en_score=submission.en_score,
            submitted_at=submission.submitted_at,
        )

    def get_classroom_analytics(self, teacher: User, classroom_id: str) -> ClassroomAnalyticsOut:
        classroom = self.repo.get_classroom(classroom_id)
        if classroom is None or classroom.tenant_id != teacher.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy lớp học trong trường của bạn.",
            )
        rows = self.repo.list_submissions_for_classroom(classroom.id)
        student_ids = [sub.student_id for sub, _ in rows]
        names_map = self.identity.get_user_names_map(student_ids)

        submissions_out: list[StudentSubmissionSummaryOut] = []
        miss_stats: dict[str, dict] = {}
        question_ids_to_lookup: set[str] = set()

        for sub, assign_title in rows:
            submissions_out.append(
                StudentSubmissionSummaryOut(
                    student_id=sub.student_id,
                    student_name=names_map.get(sub.student_id, "Học sinh"),
                    assignment_title=assign_title,
                    score=sub.score,
                    max_score=sub.max_score,
                    vi_score=sub.vi_score,
                    en_score=sub.en_score,
                    submitted_at=sub.submitted_at,
                )
            )
            for ans in sub.answers_json or []:
                qid = str(ans.get("question_id", ""))
                if not qid:
                    continue
                question_ids_to_lookup.add(qid)
                entry = miss_stats.setdefault(qid, {"miss": 0, "total": 0})
                entry["total"] += 1
                if not ans.get("is_correct"):
                    entry["miss"] += 1

        q_map = {
            q.id: q
            for q in self.repo.list_questions(tenant_id=teacher.tenant_id)
            if q.id in question_ids_to_lookup
        }
        weak_questions: list[WeakQuestionOut] = []
        for qid, stats in sorted(
            miss_stats.items(), key=lambda pair: pair[1]["miss"], reverse=True
        )[:5]:
            if stats["miss"] <= 0:
                continue
            q_obj = q_map.get(qid)
            if q_obj is not None:
                weak_questions.append(
                    WeakQuestionOut(
                        question_id=qid,
                        prompt_text=q_obj.prompt_text,
                        language=q_obj.language,
                        miss_count=stats["miss"],
                        total_attempts=stats["total"],
                    )
                )

        count = len(submissions_out)
        avg_score = round(sum(s.score for s in submissions_out) / count, 2) if count else 0.0
        avg_en = round(sum(s.en_score for s in submissions_out) / count, 2) if count else 0.0

        return ClassroomAnalyticsOut(
            classroom_id=classroom.id,
            classroom_name=classroom.name,
            student_count=len(classroom.members),
            submissions_count=count,
            average_score=avg_score,
            average_en_score=avg_en,
            submissions=submissions_out,
            weak_questions=weak_questions,
        )

    # --- Teaching Session Logs & TT94 Compliance Dashboard ---
    def log_teaching_session(
        self, teacher: User, payload: TeachingSessionCreateRequest
    ) -> TeachingSessionOut:
        classroom = self.repo.get_classroom(payload.classroom_id)
        if classroom is None or classroom.tenant_id != teacher.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy lớp học trong trường của bạn.",
            )
        target_grade = payload.grade or classroom.grade
        self.curriculum.get_lesson_detail(payload.lesson_no, grade=target_grade)

        log = TeachingSessionLog(
            tenant_id=teacher.tenant_id,
            classroom_id=classroom.id,
            teacher_id=teacher.id,
            grade=target_grade,
            lesson_no=payload.lesson_no,
            taught_date=payload.taught_date,
            periods_count=payload.periods_count,
            clil_mode=payload.clil_mode,
            english_minutes=payload.english_minutes,
            notes=payload.notes,
        )
        self.repo.create_session_log(log)
        self.db.commit()
        self.db.refresh(log)
        return TeachingSessionOut.model_validate(log)

    def list_teaching_sessions(
        self, teacher: User, classroom_id: str | None = None
    ) -> list[TeachingSessionOut]:
        logs = self.repo.list_session_logs(teacher.tenant_id, classroom_id=classroom_id)
        return [TeachingSessionOut.model_validate(item) for item in logs]

    def get_tt94_compliance_report(
        self, caller: User, academic_year: str = "2026-2027"
    ) -> TT94ComplianceReportOut:
        tenant_name = self.identity.get_tenant_name(caller.tenant_id)
        classrooms = [
            c
            for c in self.repo.list_classrooms_for_tenant(caller.tenant_id)
            if c.academic_year == academic_year
        ]
        periods_map = self.repo.sum_periods_by_classroom(caller.tenant_id)
        exams = self.repo.list_exams_for_tenant(caller.tenant_id)

        classroom_metrics: list[ClassroomTT94MetricsOut] = []
        total_periods = 0
        meet_35 = 0
        meet_105 = 0

        for c in classrooms:
            periods, minutes = periods_map.get(c.id, (0, 0))
            total_periods += periods
            is_35 = periods >= 35
            is_105 = periods >= 105
            if is_35:
                meet_35 += 1
            if is_105:
                meet_105 += 1
            classroom_metrics.append(
                ClassroomTT94MetricsOut(
                    classroom_id=c.id,
                    classroom_name=c.name,
                    is_tt94_pilot_class=c.is_tt94_pilot_class,
                    student_count=len(c.members),
                    total_periods_logged=periods,
                    total_english_minutes=minutes,
                    meets_35_periods=is_35,
                    meets_105_periods=is_105,
                )
            )

        exams_10 = sum(1 for e in exams if e.achieved_en_ratio >= 0.10)
        exams_50 = sum(1 for e in exams if e.achieved_en_ratio >= 0.50)
        total_cls = len(classrooms)
        ratio_35 = (meet_35 / total_cls) if total_cls > 0 else 0.0

        gaps: list[str] = []
        if meet_35 >= 4 and ratio_35 >= 0.80 and total_periods >= 105 and exams_50 >= 1:
            level = 3
            label = "Mức độ 3 (Nâng cao toàn diện theo Thông tư 94/2026)"
        elif meet_35 >= 1 and ratio_35 >= 0.50 and total_periods >= 105 and exams_10 >= 1:
            level = 2
            label = "Mức độ 2 (Mở rộng theo Thông tư 94/2026)"
            if ratio_35 < 0.80:
                gaps.append(
                    "Cần đạt ít nhất 80% số lớp triển khai (≥ 35 tiết/năm) để lên Mức độ 3."
                )
            if exams_50 < 1:
                gaps.append(
                    "Cần có đề kiểm tra định kỳ đạt tối thiểu 50% (5/10 điểm) bằng tiếng Anh."
                )
        elif meet_35 >= 4 and exams_10 >= 1:
            level = 1
            label = "Mức độ 1 (Đạt yêu cầu cơ bản Thông tư 94/2026)"
            if ratio_35 < 0.50:
                gaps.append(
                    "Cần mở rộng tối thiểu 50% tổng số lớp THCS đạt chuẩn triển khai "
                    "để lên Mức độ 2."
                )
            if total_periods < 105:
                gaps.append(
                    f"Tổng số tiết hiện tại ({total_periods}/105 tiết) cần đạt 105 tiết/năm "
                    "cho Mức độ 2."
                )
        else:
            level = 0
            label = "Chưa đạt Mức độ 1 (Đang trong giai đoạn khởi động)"
            if meet_35 < 4:
                gaps.append(
                    "Cấp THCS cần tối thiểu 04 lớp đạt ≥ 35 tiết/năm có dạy nội dung bằng "
                    f"tiếng Anh (hiện có {meet_35} lớp)."
                )
            if exams_10 < 1:
                gaps.append(
                    "Cần tạo ít nhất 01 đề kiểm tra định kỳ có tỷ trọng ≥ 10% (1/10 điểm) "
                    "bằng tiếng Anh."
                )

        grade_breakdown: list[GradeTT94MetricsOut] = []
        for g in (6, 7, 8, 9):
            g_classes = [c for c in classrooms if c.grade == g]
            g_periods = sum(periods_map.get(c.id, (0, 0))[0] for c in g_classes)
            g_minutes = sum(periods_map.get(c.id, (0, 0))[1] for c in g_classes)
            g_exams = [e for e in exams if e.grade == g]
            grade_breakdown.append(
                GradeTT94MetricsOut(
                    grade=g,
                    classrooms_count=len(g_classes),
                    students_count=sum(len(c.members) for c in g_classes),
                    periods_logged=g_periods,
                    english_minutes=g_minutes,
                    exams_count=len(g_exams),
                    exams_meeting_10_pct=sum(1 for e in g_exams if e.achieved_en_ratio >= 0.10),
                    exams_meeting_50_pct=sum(1 for e in g_exams if e.achieved_en_ratio >= 0.50),
                )
            )

        return TT94ComplianceReportOut(
            tenant_id=caller.tenant_id,
            tenant_name=tenant_name,
            academic_year=academic_year,
            total_classrooms=total_cls,
            classrooms_meeting_35_periods=meet_35,
            classrooms_meeting_105_periods=meet_105,
            total_periods_logged=total_periods,
            total_exams_generated=len(exams),
            exams_meeting_10_pct=exams_10,
            exams_meeting_50_pct=exams_50,
            estimated_tt94_level=level,
            level_label=label,
            next_level_gaps=gaps,
            classrooms=classroom_metrics,
            grade_breakdown=grade_breakdown,
        )

    def export_tt94_compliance_csv(
        self, caller: User, academic_year: str = "2026-2027"
    ) -> bytes:
        report = self.get_tt94_compliance_report(caller, academic_year=academic_year)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["school_name", report.tenant_name])
        writer.writerow(["academic_year", report.academic_year])
        writer.writerow(["estimated_tt94_level", report.estimated_tt94_level])
        writer.writerow(["level_label", report.level_label])
        writer.writerow(["total_classrooms", report.total_classrooms])
        writer.writerow(["classrooms_meeting_35_periods", report.classrooms_meeting_35_periods])
        writer.writerow(["classrooms_meeting_105_periods", report.classrooms_meeting_105_periods])
        writer.writerow(["total_periods_logged", report.total_periods_logged])
        writer.writerow(["total_exams_generated", report.total_exams_generated])
        writer.writerow(["exams_meeting_10_pct", report.exams_meeting_10_pct])
        writer.writerow(["exams_meeting_50_pct", report.exams_meeting_50_pct])
        writer.writerow([])
        writer.writerow(
            [
                "grade",
                "classrooms_count",
                "students_count",
                "periods_logged",
                "english_minutes",
                "exams_count",
                "exams_meeting_10_pct",
                "exams_meeting_50_pct",
            ]
        )
        for gb in report.grade_breakdown:
            writer.writerow(
                [
                    gb.grade,
                    gb.classrooms_count,
                    gb.students_count,
                    gb.periods_logged,
                    gb.english_minutes,
                    gb.exams_count,
                    gb.exams_meeting_10_pct,
                    gb.exams_meeting_50_pct,
                ]
            )
        writer.writerow([])
        writer.writerow(
            [
                "classroom_name",
                "is_tt94_pilot_class",
                "student_count",
                "total_periods_logged",
                "total_english_minutes",
                "meets_35_periods",
                "meets_105_periods",
            ]
        )
        for cls in report.classrooms:
            writer.writerow(
                [
                    cls.classroom_name,
                    "true" if cls.is_tt94_pilot_class else "false",
                    cls.student_count,
                    cls.total_periods_logged,
                    cls.total_english_minutes,
                    "true" if cls.meets_35_periods else "false",
                    "true" if cls.meets_105_periods else "false",
                ]
            )
        return output.getvalue().encode("utf-8-sig")

    # --- CMS Question Bank & CLIL Resources Management ---
    def _ensure_question_write_access(self, caller: User, item: QuestionBankItem) -> None:
        if caller.role == "platform_admin":
            return
        if item.tenant_id is None or item.tenant_id != caller.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Bạn không có quyền chỉnh sửa câu hỏi chuẩn hệ thống "
                    "hoặc thuộc trường khác."
                ),
            )
        if caller.role == "teacher" and item.author_id not in (None, caller.id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Giáo viên chỉ được chỉnh sửa câu hỏi do chính mình biên soạn.",
            )

    def _to_cms_question(
        self, item: QuestionBankItem, *, lint_report: LintCheckOut | None = None
    ) -> CmsQuestionOut:
        return CmsQuestionOut(
            id=item.id,
            grade=item.grade,
            lesson_no=item.lesson_no,
            language=item.language,
            cognitive_level=item.cognitive_level,
            discipline=item.discipline,
            prompt_text=item.prompt_text,
            options=list(item.options_json),
            correct_answer=item.correct_answer,
            explanation_vi=item.explanation_vi,
            linter_verified=item.linter_verified,
            tenant_id=item.tenant_id,
            is_official=item.tenant_id is None,
            author_id=item.author_id,
            created_at=item.created_at,
            lint_report=lint_report,
        )

    def list_questions_cms(
        self,
        caller: User,
        *,
        grade: int | None = None,
        lesson_no: int | None = None,
        language: str | None = None,
        cognitive_level: str | None = None,
        discipline: str | None = None,
        linter_verified: bool | None = None,
        scope: str = "all",
        q: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> CmsQuestionListOut:
        tenant_scope = None if caller.role == "platform_admin" else caller.tenant_id
        total, items = self.repo.list_questions_cms(
            tenant_id=tenant_scope,
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
        return CmsQuestionListOut(
            total=total, items=[self._to_cms_question(item) for item in items]
        )

    def create_question_cms(
        self, caller: User, payload: CmsQuestionCreateRequest
    ) -> CmsQuestionOut:
        self.curriculum.get_lesson_detail(payload.lesson_no, grade=payload.grade)
        options = [opt.strip() for opt in payload.options]
        if any(not opt for opt in options):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cả 4 đáp án A/B/C/D không được để trống.",
            )
        combined_text = "\n".join([payload.prompt_text, *options, payload.explanation_vi])
        lint_report = self.curriculum.lint_content(combined_text, discipline=payload.discipline)
        is_official = payload.is_official and caller.role == "platform_admin"
        target_tenant = None if is_official else caller.tenant_id

        item = QuestionBankItem(
            grade=payload.grade,
            lesson_no=payload.lesson_no,
            author_id=caller.id,
            tenant_id=target_tenant,
            question_type="mcq",
            language=payload.language,
            cognitive_level=payload.cognitive_level,
            discipline=payload.discipline,
            prompt_text=payload.prompt_text.strip(),
            options_json=options,
            correct_answer=options[payload.correct_index],
            explanation_vi=payload.explanation_vi.strip(),
            linked_term_ids_json=[],
            linter_verified=lint_report.passed,
        )
        self.repo.create_question(item)
        self.identity.record_audit_log(
            caller,
            module="lms",
            action="create",
            entity_type="question",
            entity_id=item.id,
            summary=f"Thêm câu hỏi KHTN {item.grade} Bài {item.lesson_no} ({item.language})",
            diff={"linter_verified": item.linter_verified, "is_official": is_official},
            tenant_id=target_tenant,
        )
        self.db.commit()
        self.db.refresh(item)
        return self._to_cms_question(item, lint_report=lint_report)

    def update_question_cms(
        self, caller: User, question_id: str, payload: CmsQuestionUpdateRequest
    ) -> CmsQuestionOut:
        item = self.repo.get_question_by_id(question_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy câu hỏi cần chỉnh sửa.",
            )
        self._ensure_question_write_access(caller, item)

        next_grade = payload.grade if payload.grade is not None else item.grade
        next_lesson = payload.lesson_no if payload.lesson_no is not None else item.lesson_no
        if payload.grade is not None or payload.lesson_no is not None:
            self.curriculum.get_lesson_detail(next_lesson, grade=next_grade)

        options = (
            [opt.strip() for opt in payload.options]
            if payload.options is not None
            else list(item.options_json)
        )
        if len(options) != 4 or any(not opt for opt in options):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Câu hỏi trắc nghiệm cần đủ 4 đáp án hợp lệ.",
            )

        if payload.correct_index is not None:
            correct_answer = options[payload.correct_index]
        elif item.correct_answer in options:
            correct_answer = item.correct_answer
        else:
            correct_answer = options[0]

        next_prompt = (
            payload.prompt_text.strip() if payload.prompt_text is not None else item.prompt_text
        )
        next_expl = (
            payload.explanation_vi.strip()
            if payload.explanation_vi is not None
            else item.explanation_vi
        )
        next_disc = payload.discipline if payload.discipline is not None else item.discipline
        lint_report = self.curriculum.lint_content(
            "\n".join([next_prompt, *options, next_expl]), discipline=next_disc
        )

        item.grade = next_grade
        item.lesson_no = next_lesson
        if payload.language is not None:
            item.language = payload.language
        if payload.cognitive_level is not None:
            item.cognitive_level = payload.cognitive_level
        item.discipline = next_disc
        item.prompt_text = next_prompt
        item.options_json = options
        item.correct_answer = correct_answer
        item.explanation_vi = next_expl
        item.linter_verified = lint_report.passed
        if payload.is_official is not None and caller.role == "platform_admin":
            item.tenant_id = None if payload.is_official else caller.tenant_id

        self.identity.record_audit_log(
            caller,
            module="lms",
            action="update",
            entity_type="question",
            entity_id=item.id,
            summary=f"Cập nhật câu hỏi KHTN {item.grade} Bài {item.lesson_no}",
            diff={"linter_verified": item.linter_verified, "is_official": item.tenant_id is None},
            tenant_id=item.tenant_id,
        )
        self.db.commit()
        self.db.refresh(item)
        return self._to_cms_question(item, lint_report=lint_report)

    def delete_question_cms(self, caller: User, question_id: str) -> dict[str, str]:
        item = self.repo.get_question_by_id(question_id)
        if item is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy câu hỏi cần xóa.",
            )
        self._ensure_question_write_access(caller, item)
        self.identity.record_audit_log(
            caller,
            module="lms",
            action="delete",
            entity_type="question",
            entity_id=item.id,
            summary=f"Xóa câu hỏi KHTN {item.grade} Bài {item.lesson_no}",
            diff={"prompt": item.prompt_text[:120]},
            tenant_id=item.tenant_id,
        )
        self.repo.delete_question(item)
        self.db.commit()
        return {"deleted_id": question_id}

    def import_questions_csv_cms(
        self, caller: User, payload: CmsQuestionCsvImportRequest
    ) -> CmsQuestionCsvImportOut:
        cleaned = payload.csv_content.lstrip("\ufeff").strip()
        reader = csv.DictReader(io.StringIO(cleaned))
        is_official = payload.is_official and caller.role == "platform_admin"
        target_tenant = None if is_official else caller.tenant_id

        imported_count = 0
        verified_count = 0
        flagged_count = 0
        errors: list[str] = []

        for line_no, raw_row in enumerate(reader, start=2):
            row = {str(k or "").strip().lower(): str(v or "").strip() for k, v in raw_row.items()}
            try:
                grade = int(row.get("grade") or 8)
                lesson_no = int(row.get("lesson_no") or 0)
            except ValueError:
                errors.append(f"Dòng {line_no}: grade/lesson_no phải là số nguyên.")
                continue

            if grade not in (6, 7, 8, 9) or lesson_no < 1:
                errors.append(
                    f"Dòng {line_no}: Khối ({grade}) hoặc bài ({lesson_no}) không hợp lệ."
                )
                continue

            try:
                self.curriculum.get_lesson_detail(lesson_no, grade=grade)
            except HTTPException:
                errors.append(f"Dòng {line_no}: Không tồn tại KHTN {grade} Bài {lesson_no}.")
                continue

            language = (row.get("language") or "en").lower()
            cognitive = (row.get("cognitive_level") or "know").lower()
            discipline = (row.get("discipline") or "chemistry").lower()
            prompt_text = row.get("prompt_text", "")
            options = [
                row.get("option_a", ""),
                row.get("option_b", ""),
                row.get("option_c", ""),
                row.get("option_d", ""),
            ]
            if len(prompt_text) < 5 or any(not opt for opt in options):
                errors.append(f"Dòng {line_no}: Thiếu nội dung câu hỏi hoặc 4 đáp án A/B/C/D.")
                continue
            if language not in ("vi", "en"):
                language = "en"
            if cognitive not in ("know", "understand", "apply"):
                cognitive = "know"

            correct_raw = (row.get("correct_index") or "0").strip().upper()
            letter_map = {"A": 0, "B": 1, "C": 2, "D": 3}
            if correct_raw in letter_map:
                correct_idx = letter_map[correct_raw]
            else:
                try:
                    correct_idx = int(correct_raw)
                except ValueError:
                    correct_idx = 0
            if not (0 <= correct_idx <= 3):
                errors.append(f"Dòng {line_no}: correct_index phải thuộc 0..3 hoặc A..D.")
                continue

            explanation_vi = row.get("explanation_vi", "")
            lint_report = self.curriculum.lint_content(
                "\n".join([prompt_text, *options, explanation_vi]),
                discipline=discipline,
            )

            self.repo.create_question(
                QuestionBankItem(
                    grade=grade,
                    lesson_no=lesson_no,
                    author_id=caller.id,
                    tenant_id=target_tenant,
                    question_type="mcq",
                    language=language,
                    cognitive_level=cognitive,
                    discipline=discipline,
                    prompt_text=prompt_text,
                    options_json=options,
                    correct_answer=options[correct_idx],
                    explanation_vi=explanation_vi,
                    linked_term_ids_json=[],
                    linter_verified=lint_report.passed,
                )
            )
            imported_count += 1
            if lint_report.passed:
                verified_count += 1
            else:
                flagged_count += 1

        if imported_count > 0:
            self.identity.record_audit_log(
                caller,
                module="lms",
                action="import",
                entity_type="question_batch",
                entity_id=target_tenant or "official",
                summary=(
                    f"Import CSV câu hỏi: {imported_count} câu "
                    f"({verified_count} đạt chuẩn, {flagged_count} cảnh báo IUPAC)."
                ),
                diff={
                    "imported": imported_count,
                    "verified": verified_count,
                    "flagged": flagged_count,
                },
                tenant_id=target_tenant,
            )
        self.db.commit()
        return CmsQuestionCsvImportOut(
            imported_count=imported_count,
            verified_count=verified_count,
            flagged_count=flagged_count,
            errors=errors[:20],
        )

    def _ensure_resource_write_access(self, caller: User, res: TeacherResource) -> None:
        if caller.role == "platform_admin":
            return
        if res.tenant_id is None or res.tenant_id != caller.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    "Bạn không có quyền chỉnh sửa học liệu chuẩn quốc gia "
                    "hoặc thuộc trường khác."
                ),
            )

    def _to_cms_resource(
        self, res: TeacherResource, *, lint_report: LintCheckOut | None = None
    ) -> CmsResourceOut:
        return CmsResourceOut(
            id=res.id,
            grade=res.grade,
            lesson_no=res.lesson_no,
            title=res.title,
            resource_type=res.resource_type,  # type: ignore[arg-type]
            clil_mode=res.clil_mode,  # type: ignore[arg-type]
            content_markdown=res.content_markdown,
            is_official=res.is_official,
            tenant_id=res.tenant_id,
            created_at=res.created_at,
            lint_report=lint_report,
        )

    def list_resources_cms(
        self,
        caller: User,
        *,
        grade: int | None = None,
        lesson_no: int | None = None,
        resource_type: str | None = None,
        clil_mode: str | None = None,
        scope: str = "all",
        q: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> CmsResourceListOut:
        tenant_scope = None if caller.role == "platform_admin" else caller.tenant_id
        total, items = self.repo.list_resources_cms(
            tenant_id=tenant_scope,
            grade=grade,
            lesson_no=lesson_no,
            resource_type=resource_type,
            clil_mode=clil_mode,
            scope=scope,
            q=q,
            limit=limit,
            offset=offset,
        )
        return CmsResourceListOut(total=total, items=[self._to_cms_resource(r) for r in items])

    def create_resource_cms(
        self, caller: User, payload: CmsResourceCreateRequest
    ) -> CmsResourceOut:
        self.curriculum.get_lesson_detail(payload.lesson_no, grade=payload.grade)
        lint_report = self.curriculum.lint_content(f"{payload.title}\n{payload.content_markdown}")
        is_official = payload.is_official and caller.role == "platform_admin"
        target_tenant = None if is_official else caller.tenant_id

        res = TeacherResource(
            grade=payload.grade,
            lesson_no=payload.lesson_no,
            tenant_id=target_tenant,
            title=payload.title.strip(),
            resource_type=payload.resource_type,
            clil_mode=payload.clil_mode,
            content_markdown=payload.content_markdown,
            metadata_json={"author_id": caller.id, "lint_passed": lint_report.passed},
            is_official=is_official,
        )
        self.repo.create_teacher_resource(res)
        self.identity.record_audit_log(
            caller,
            module="lms",
            action="create",
            entity_type="resource",
            entity_id=res.id,
            summary=f"Tạo học liệu CLIL '{res.title}' (KHTN {res.grade} Bài {res.lesson_no})",
            diff={"resource_type": res.resource_type, "is_official": res.is_official},
            tenant_id=target_tenant,
        )
        self.db.commit()
        self.db.refresh(res)
        return self._to_cms_resource(res, lint_report=lint_report)

    def update_resource_cms(
        self, caller: User, resource_id: str, payload: CmsResourceUpdateRequest
    ) -> CmsResourceOut:
        res = self.repo.get_resource_by_id(resource_id)
        if res is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy học liệu CLIL cần chỉnh sửa.",
            )
        self._ensure_resource_write_access(caller, res)

        next_grade = payload.grade if payload.grade is not None else res.grade
        next_lesson = payload.lesson_no if payload.lesson_no is not None else res.lesson_no
        if payload.grade is not None or payload.lesson_no is not None:
            self.curriculum.get_lesson_detail(next_lesson, grade=next_grade)

        next_title = payload.title.strip() if payload.title is not None else res.title
        next_md = (
            payload.content_markdown
            if payload.content_markdown is not None
            else res.content_markdown
        )
        lint_report = self.curriculum.lint_content(f"{next_title}\n{next_md}")

        res.grade = next_grade
        res.lesson_no = next_lesson
        res.title = next_title
        res.content_markdown = next_md
        if payload.resource_type is not None:
            res.resource_type = payload.resource_type
        if payload.clil_mode is not None:
            res.clil_mode = payload.clil_mode
        if payload.is_official is not None and caller.role == "platform_admin":
            res.is_official = payload.is_official
            res.tenant_id = None if payload.is_official else caller.tenant_id

        self.identity.record_audit_log(
            caller,
            module="lms",
            action="update",
            entity_type="resource",
            entity_id=res.id,
            summary=f"Cập nhật học liệu CLIL '{res.title}'",
            diff={"lint_passed": lint_report.passed, "is_official": res.is_official},
            tenant_id=res.tenant_id,
        )
        self.db.commit()
        self.db.refresh(res)
        return self._to_cms_resource(res, lint_report=lint_report)

    def delete_resource_cms(self, caller: User, resource_id: str) -> dict[str, str]:
        res = self.repo.get_resource_by_id(resource_id)
        if res is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy học liệu CLIL cần xóa.",
            )
        self._ensure_resource_write_access(caller, res)
        self.identity.record_audit_log(
            caller,
            module="lms",
            action="delete",
            entity_type="resource",
            entity_id=res.id,
            summary=f"Xóa học liệu CLIL '{res.title}'",
            diff={"grade": res.grade, "lesson_no": res.lesson_no},
            tenant_id=res.tenant_id,
        )
        self.repo.delete_resource(res)
        self.db.commit()
        return {"deleted_id": resource_id}

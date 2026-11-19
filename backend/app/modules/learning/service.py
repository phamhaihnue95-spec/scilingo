"""Business logic for Unit 2: SRS Flashcards, Mindmap, Adaptive Quiz, and Gamification."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.curriculum.service import CurriculumService
from app.modules.identity_billing.models import User
from app.modules.learning.models import SRSCard, StudentPracticeAttempt
from app.modules.learning.quiz_builder import build_lesson_quiz
from app.modules.learning.repository import LearningRepository
from app.modules.learning.schemas import (
    GameRewardOut,
    GameRewardRequest,
    GamificationSummaryOut,
    LessonMindmapOut,
    MindmapEdgeOut,
    MindmapNodeOut,
    PracticeHistoryItemOut,
    PracticeResultOut,
    PracticeSessionOut,
    PracticeStartRequest,
    PracticeSubmitRequest,
    QuestionFeedbackOut,
    QuizQuestionPublicOut,
    SRSDueCardOut,
    SRSDueResponse,
    SRSReviewRequest,
    SRSReviewResultOut,
)
from app.modules.learning.srs import compute_sm2, evaluate_badges, update_streak


def _as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt


class LearningService:
    """Coordinates student SRS reviews, concept mindmaps, quizzes, and XP rewards."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = LearningRepository(db)
        self.curriculum = CurriculumService(db)

    def _apply_gamification(
        self,
        *,
        student_id: str,
        xp_earned: int,
        discipline_increments: dict[str, int],
        passed_tt94_50: bool = False,
        extra_unlocked: list[str] | None = None,
    ) -> tuple[int, int, list[str]]:
        profile = self.repo.get_or_create_gamification(student_id)
        new_streak, longest_streak, study_date = update_streak(
            last_study_date=profile.last_study_date,
            current_streak=profile.current_streak,
            longest_streak=profile.longest_streak,
        )

        discipline_xp = dict(profile.discipline_xp_json or {})
        for disc, amount in discipline_increments.items():
            discipline_xp[disc] = int(discipline_xp.get(disc, 0)) + amount

        total_xp = profile.total_xp + xp_earned
        existing_badges = list(profile.badges_json or [])
        unlocked = evaluate_badges(
            existing_badges=existing_badges,
            current_streak=new_streak,
            total_xp=total_xp,
            discipline_xp=discipline_xp,
            passed_tt94_50=passed_tt94_50,
            extra_unlocked=extra_unlocked,
        )

        profile.current_streak = new_streak
        profile.longest_streak = longest_streak
        profile.total_xp = total_xp
        profile.last_study_date = study_date
        profile.discipline_xp_json = discipline_xp
        profile.badges_json = [*existing_badges, *unlocked]
        return total_xp, new_streak, unlocked

    def get_due_flashcards(
        self,
        *,
        student: User,
        lesson_no: int | None = None,
        discipline: str | None = None,
        limit: int = 15,
    ) -> SRSDueResponse:
        if lesson_no is not None:
            lesson = self.curriculum.get_lesson_detail(lesson_no)
            candidate_terms = lesson.terms
        else:
            candidate_terms = self.curriculum.search_terms(
                discipline=discipline, limit=200
            ).items

        term_ids = [t.id for t in candidate_terms]
        existing_cards = {
            c.term_id: c
            for c in self.repo.get_srs_cards_for_student(student.id, term_ids)
        }
        now = datetime.now(UTC)

        due_cards: list[SRSDueCardOut] = []
        new_cards: list[SRSDueCardOut] = []

        for term in candidate_terms:
            card = existing_cards.get(term.id)
            if card is None:
                new_cards.append(
                    SRSDueCardOut(
                        term_id=term.id,
                        slug=term.slug,
                        term_en=term.term_en,
                        term_vi=term.term_vi,
                        ipa=term.ipa,
                        discipline=term.discipline,
                        formula_or_symbol=term.formula_or_symbol,
                        iupac_note=term.iupac_note,
                        is_13_exception_element=term.is_13_exception_element,
                        is_new=True,
                        repetitions=0,
                        interval_days=0,
                        ease_factor=2.5,
                        next_review_at=None,
                    )
                )
            elif _as_utc(card.next_review_at) <= now:
                due_cards.append(
                    SRSDueCardOut(
                        term_id=term.id,
                        slug=term.slug,
                        term_en=term.term_en,
                        term_vi=term.term_vi,
                        ipa=term.ipa,
                        discipline=term.discipline,
                        formula_or_symbol=term.formula_or_symbol,
                        iupac_note=term.iupac_note,
                        is_13_exception_element=term.is_13_exception_element,
                        is_new=False,
                        repetitions=card.repetitions,
                        interval_days=card.interval_days,
                        ease_factor=card.ease_factor,
                        next_review_at=_as_utc(card.next_review_at),
                    )
                )

        due_cards.sort(key=lambda item: item.next_review_at or now)
        combined = (due_cards + new_cards)[:limit]
        return SRSDueResponse(
            total_due=len(due_cards),
            total_new=len(new_cards),
            cards=combined,
        )

    def review_flashcard(self, student: User, payload: SRSReviewRequest) -> SRSReviewResultOut:
        term = self.curriculum.get_term_by_id(payload.term_id)
        if term is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy thuật ngữ cần ôn tập.",
            )

        card = self.repo.get_srs_card(student.id, term.id)
        if card is None:
            card = SRSCard(
                student_id=student.id,
                term_id=term.id,
                ease_factor=2.5,
                interval_days=0,
                repetitions=0,
            )

        result = compute_sm2(
            quality=payload.quality,
            ease_factor=card.ease_factor,
            interval_days=card.interval_days,
            repetitions=card.repetitions,
        )
        card.ease_factor = result.ease_factor
        card.interval_days = result.interval_days
        card.repetitions = result.repetitions
        card.next_review_at = result.next_review_at
        card.last_quality = payload.quality
        self.repo.save_srs_card(card)

        xp_earned = 10 if payload.quality >= 3 else 5
        total_xp, streak, unlocked = self._apply_gamification(
            student_id=student.id,
            xp_earned=xp_earned,
            discipline_increments={term.discipline: xp_earned},
        )
        self.db.commit()

        return SRSReviewResultOut(
            term_id=term.id,
            repetitions=card.repetitions,
            interval_days=card.interval_days,
            ease_factor=card.ease_factor,
            next_review_at=_as_utc(card.next_review_at),
            xp_earned=xp_earned,
            total_xp=total_xp,
            current_streak=streak,
            newly_unlocked_badges=unlocked,
        )

    def get_lesson_mindmap(self, lesson_no: int) -> LessonMindmapOut:
        lesson = self.curriculum.get_lesson_detail(lesson_no)
        root_id = f"lesson-{lesson.lesson_no}"

        nodes: list[MindmapNodeOut] = [
            MindmapNodeOut(
                id=root_id,
                node_type="lesson",
                label_vi=f"Bài {lesson.lesson_no}: {lesson.title_vi}",
                label_en=f"Lesson {lesson.lesson_no}: {lesson.title_en}",
                discipline=lesson.discipline,
                note=lesson.chapter_title_vi,
            )
        ]
        edges: list[MindmapEdgeOut] = []

        for term in lesson.terms:
            node_id = f"term-{term.slug}"
            nodes.append(
                MindmapNodeOut(
                    id=node_id,
                    node_type="term",
                    label_vi=term.term_vi,
                    label_en=term.term_en,
                    discipline=term.discipline,
                    ipa=term.ipa,
                    formula_or_symbol=term.formula_or_symbol,
                    note=term.iupac_note,
                    is_13_exception_element=term.is_13_exception_element,
                )
            )
            edges.append(
                MindmapEdgeOut(
                    source=root_id,
                    target=node_id,
                    relation="contains_term",
                )
            )

        for link in lesson.integration_links:
            link_id = f"integration-{link.target_lesson_no}"
            nodes.append(
                MindmapNodeOut(
                    id=link_id,
                    node_type="integration",
                    label_vi=f"Bài {link.target_lesson_no}: {link.target_title_vi}",
                    label_en=f"Lesson {link.target_lesson_no}: {link.target_title_en}",
                    discipline=link.target_discipline,
                    note=link.note_vi,
                    target_lesson_no=link.target_lesson_no,
                )
            )
            edges.append(
                MindmapEdgeOut(
                    source=root_id,
                    target=link_id,
                    relation="cross_discipline",
                    label_vi="Liên kết tích hợp",
                )
            )

        return LessonMindmapOut(
            lesson_no=lesson.lesson_no,
            title_vi=lesson.title_vi,
            title_en=lesson.title_en,
            discipline=lesson.discipline,
            nodes=nodes,
            edges=edges,
        )

    def start_practice(self, student: User, payload: PracticeStartRequest) -> PracticeSessionOut:
        lesson = self.curriculum.get_lesson_detail(payload.lesson_no)
        discipline_pool = self.curriculum.search_terms(
            discipline=lesson.discipline, limit=200
        ).items
        fallback_pool = self.curriculum.search_terms(limit=200).items

        built = build_lesson_quiz(
            lesson_terms=lesson.terms,
            discipline_pool=discipline_pool,
            fallback_pool=fallback_pool,
            mode=payload.mode,
            total_questions=payload.total_questions,
        )

        attempt = StudentPracticeAttempt(
            student_id=student.id,
            lesson_no=lesson.lesson_no,
            mode=payload.mode,
            total_questions=built.total_questions,
            english_questions_count=built.english_questions_count,
            english_ratio=built.english_ratio,
            questions_json=built.questions,
        )
        saved = self.repo.create_practice_attempt(attempt)

        public_questions = [
            QuizQuestionPublicOut(
                index=q["index"],
                term_id=q["term_id"],
                language=q["language"],
                points=q["points"],
                prompt=q["prompt"],
                options=q["options"],
                discipline=q["discipline"],
            )
            for q in built.questions
        ]
        return PracticeSessionOut(
            attempt_id=saved.id,
            lesson_no=lesson.lesson_no,
            lesson_title_vi=lesson.title_vi,
            lesson_title_en=lesson.title_en,
            mode=payload.mode,
            total_questions=saved.total_questions,
            english_questions_count=saved.english_questions_count,
            english_ratio=saved.english_ratio,
            questions=public_questions,
        )

    def submit_practice(
        self,
        *,
        student: User,
        attempt_id: str,
        payload: PracticeSubmitRequest,
    ) -> PracticeResultOut:
        attempt = self.repo.get_practice_attempt(attempt_id)
        if attempt is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy lượt làm bài.",
            )
        if attempt.student_id != student.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Bạn không có quyền nộp bài làm của học sinh khác.",
            )
        if attempt.completed_at is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Bài kiểm tra này đã được nộp trước đó.",
            )

        answer_map = {item.index: item.selected_index for item in payload.answers}
        feedback: list[QuestionFeedbackOut] = []
        vi_score = 0.0
        en_score = 0.0
        max_score = 0.0
        discipline_increments: dict[str, int] = {}

        for q in attempt.questions_json:
            idx = int(q["index"])
            selected = answer_map.get(idx)
            is_correct = selected is not None and selected == int(q["correct_index"])
            q_max = float(q["points"])
            q_earned = q_max if is_correct else 0.0
            max_score += q_max

            if q["language"] == "en":
                en_score += q_earned
            else:
                vi_score += q_earned

            if is_correct:
                disc = str(q["discipline"])
                discipline_increments[disc] = discipline_increments.get(disc, 0) + 5

            feedback.append(
                QuestionFeedbackOut(
                    index=idx,
                    language=q["language"],
                    prompt=q["prompt"],
                    options=q["options"],
                    selected_index=selected,
                    correct_index=int(q["correct_index"]),
                    is_correct=is_correct,
                    points_earned=round(q_earned, 2),
                    max_points=round(q_max, 2),
                    term_en=q["term_en"],
                    term_vi=q["term_vi"],
                    explanation_vi=q["explanation_vi"],
                )
            )

        total_score = round(vi_score + en_score, 2)
        attempt.score = total_score
        attempt.vi_score = round(vi_score, 2)
        attempt.en_score = round(en_score, 2)
        attempt.answers_json = [item.model_dump() for item in payload.answers]
        attempt.completed_at = datetime.now(UTC)

        correct_count = sum(1 for item in feedback if item.is_correct)
        xp_earned = 20 + correct_count * 5
        passed_tt94_50 = (
            attempt.mode in {"quiz_50", "quiz_100"}
            and max_score > 0
            and (total_score / max_score) >= 0.7
        )
        total_xp, streak, unlocked = self._apply_gamification(
            student_id=student.id,
            xp_earned=xp_earned,
            discipline_increments=discipline_increments,
            passed_tt94_50=passed_tt94_50,
        )
        self.db.commit()

        return PracticeResultOut(
            attempt_id=attempt.id,
            lesson_no=attempt.lesson_no,
            mode=attempt.mode,  # type: ignore[arg-type]
            score=total_score,
            max_score=round(max_score, 2),
            vi_score=round(vi_score, 2),
            en_score=round(en_score, 2),
            english_ratio=attempt.english_ratio,
            xp_earned=xp_earned,
            total_xp=total_xp,
            current_streak=streak,
            newly_unlocked_badges=unlocked,
            feedback=feedback,
        )

    def get_gamification_summary(self, student: User) -> GamificationSummaryOut:
        profile = self.repo.get_or_create_gamification(student.id)
        self.db.commit()
        mastered, due = self.repo.count_srs_stats(student.id)
        recent = self.repo.list_recent_attempts(student.id, limit=8)

        level = (profile.total_xp // 100) + 1
        next_level_xp = level * 100

        return GamificationSummaryOut(
            student_id=student.id,
            current_streak=profile.current_streak,
            longest_streak=profile.longest_streak,
            total_xp=profile.total_xp,
            level=level,
            next_level_xp=next_level_xp,
            cards_mastered=mastered,
            cards_in_review=due,
            badges=list(profile.badges_json or []),
            discipline_xp=dict(profile.discipline_xp_json or {}),
            last_study_date=profile.last_study_date,
            recent_attempts=[
                PracticeHistoryItemOut(
                    attempt_id=item.id,
                    lesson_no=item.lesson_no,
                    mode=item.mode,
                    score=float(item.score or 0.0),
                    english_ratio=item.english_ratio,
                    completed_at=_as_utc(item.completed_at or item.created_at),
                )
                for item in recent
            ],
        )

    def record_game_reward(self, student: User, payload: GameRewardRequest) -> GameRewardOut:
        """Compute bounded mini-game XP, unlock milestone badges, and persist gamification."""
        if payload.correct_count == 0:
            xp_earned = 0
        else:
            xp_earned = min(
                80, 15 + payload.correct_count * 3 + min(payload.max_combo, 10) * 2
            )

        accuracy = min(1.0, payload.correct_count / payload.total_attempts)
        game_badges: list[str] = []
        if payload.game_type == "lightning_match" and (
            payload.correct_count >= 10 or payload.max_combo >= 5
        ):
            game_badges.append("Tia Chớp Nối Cặp")
        if payload.game_type == "iupac_lab" and payload.correct_count >= 8 and accuracy >= 0.75:
            game_badges.append("Hiệp Sĩ IUPAC")

        total_xp, streak, unlocked = self._apply_gamification(
            student_id=student.id,
            xp_earned=xp_earned,
            discipline_increments={payload.discipline: xp_earned} if xp_earned > 0 else {},
            extra_unlocked=game_badges,
        )
        self.db.commit()

        return GameRewardOut(
            game_type=payload.game_type,
            xp_earned=xp_earned,
            total_xp=total_xp,
            level=(total_xp // 100) + 1,
            current_streak=streak,
            newly_unlocked_badges=unlocked,
        )

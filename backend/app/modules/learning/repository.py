"""Database repository for Unit 2 (learning)."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.learning.models import (
    SRSCard,
    StudentGamification,
    StudentPet,
    StudentPracticeAttempt,
)


class LearningRepository:
    """Encapsulates persistence for SRS cards, practice quizzes, and gamification."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_srs_cards_for_student(
        self, student_id: str, term_ids: list[str] | None = None
    ) -> list[SRSCard]:
        stmt = select(SRSCard).where(SRSCard.student_id == student_id)
        if term_ids is not None:
            if not term_ids:
                return []
            stmt = stmt.where(SRSCard.term_id.in_(term_ids))
        return list(self.db.scalars(stmt).all())

    def get_srs_card(self, student_id: str, term_id: str) -> SRSCard | None:
        stmt = select(SRSCard).where(
            SRSCard.student_id == student_id,
            SRSCard.term_id == term_id,
        )
        return self.db.scalar(stmt)

    def save_srs_card(self, card: SRSCard) -> SRSCard:
        self.db.add(card)
        self.db.flush()
        return card

    def create_practice_attempt(self, attempt: StudentPracticeAttempt) -> StudentPracticeAttempt:
        self.db.add(attempt)
        self.db.commit()
        self.db.refresh(attempt)
        return attempt

    def get_practice_attempt(self, attempt_id: str) -> StudentPracticeAttempt | None:
        stmt = select(StudentPracticeAttempt).where(StudentPracticeAttempt.id == attempt_id)
        return self.db.scalar(stmt)

    def list_recent_attempts(
        self, student_id: str, limit: int = 10
    ) -> list[StudentPracticeAttempt]:
        stmt = (
            select(StudentPracticeAttempt)
            .where(
                StudentPracticeAttempt.student_id == student_id,
                StudentPracticeAttempt.completed_at.is_not(None),
            )
            .order_by(StudentPracticeAttempt.completed_at.desc())
            .limit(limit)
        )
        return list(self.db.scalars(stmt).all())

    def get_or_create_gamification(self, student_id: str) -> StudentGamification:
        profile = self.db.scalar(
            select(StudentGamification).where(StudentGamification.student_id == student_id)
        )
        if profile is None:
            profile = StudentGamification(
                student_id=student_id,
                current_streak=0,
                longest_streak=0,
                total_xp=0,
                badges_json=[],
                discipline_xp_json={
                    "general_lab": 0,
                    "chemistry": 0,
                    "physics": 0,
                    "biology": 0,
                },
            )
            self.db.add(profile)
            self.db.flush()
        return profile

    def list_gamification_for_students(self, student_ids: list[str]) -> list[StudentGamification]:
        if not student_ids:
            return []
        stmt = select(StudentGamification).where(StudentGamification.student_id.in_(student_ids))
        return list(self.db.scalars(stmt).all())

    def count_srs_stats(self, student_id: str) -> tuple[int, int]:
        cards = self.get_srs_cards_for_student(student_id)
        now = datetime.now(UTC)
        mastered = sum(1 for c in cards if c.repetitions >= 2 and c.interval_days >= 6)
        due = 0
        for c in cards:
            review_at = (
                c.next_review_at.replace(tzinfo=UTC)
                if c.next_review_at.tzinfo is None
                else c.next_review_at
            )
            if review_at <= now:
                due += 1
        return mastered, due

    def get_or_create_pet(self, student_id: str) -> StudentPet:
        pet = self.db.scalar(
            select(StudentPet).where(StudentPet.student_id == student_id)
        )
        if pet is None:
            pet = StudentPet(
                student_id=student_id,
                species="owl",
                nickname="Lumo",
                equipped_accessory=None,
                equipped_habitat="lab",
                fed_count=0,
                petted_count=0,
            )
            self.db.add(pet)
            self.db.flush()
        return pet

    def list_pets_for_students(self, student_ids: list[str]) -> list[StudentPet]:
        if not student_ids:
            return []
        stmt = select(StudentPet).where(StudentPet.student_id.in_(student_ids))
        return list(self.db.scalars(stmt).all())

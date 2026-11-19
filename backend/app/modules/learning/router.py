"""FastAPI routes for Unit 2 (learning)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.identity_billing.dependencies import get_current_user
from app.modules.identity_billing.models import User
from app.modules.learning.schemas import (
    GameRewardOut,
    GameRewardRequest,
    GamificationSummaryOut,
    LessonMindmapOut,
    PracticeResultOut,
    PracticeSessionOut,
    PracticeStartRequest,
    PracticeSubmitRequest,
    SRSDueResponse,
    SRSReviewRequest,
    SRSReviewResultOut,
)
from app.modules.learning.service import LearningService

router = APIRouter(tags=["Student Learning Engine (Unit 2)"])


@router.get("/learning/mindmap/{lesson_no}", response_model=LessonMindmapOut)
def get_lesson_mindmap(lesson_no: int, db: Session = Depends(get_db)) -> LessonMindmapOut:
    """Return bilingual concept mindmap nodes and cross-discipline edges for a lesson."""
    return LearningService(db).get_lesson_mindmap(lesson_no)


@router.get("/learning/srs/due", response_model=SRSDueResponse)
def get_due_flashcards(
    lesson_no: int | None = Query(default=None, ge=1, le=47),
    discipline: str | None = Query(default=None),
    limit: int = Query(default=15, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SRSDueResponse:
    """Fetch due and unseen flashcards for the authenticated student."""
    return LearningService(db).get_due_flashcards(
        student=current_user,
        lesson_no=lesson_no,
        discipline=discipline,
        limit=limit,
    )


@router.post("/learning/srs/review", response_model=SRSReviewResultOut)
def review_flashcard(
    payload: SRSReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SRSReviewResultOut:
    """Record a flashcard recall quality rating (0..5) and update SM-2 scheduling."""
    return LearningService(db).review_flashcard(current_user, payload)


@router.post("/learning/practice/start", response_model=PracticeSessionOut)
def start_practice(
    payload: PracticeStartRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PracticeSessionOut:
    """Start an adaptive lesson quiz (10%, 50%, or 100% English questions)."""
    return LearningService(db).start_practice(current_user, payload)


@router.post("/learning/practice/{attempt_id}/submit", response_model=PracticeResultOut)
def submit_practice(
    attempt_id: str,
    payload: PracticeSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PracticeResultOut:
    """Grade a submitted practice attempt and award XP/badges."""
    return LearningService(db).submit_practice(
        student=current_user,
        attempt_id=attempt_id,
        payload=payload,
    )


@router.get("/learning/gamification/me", response_model=GamificationSummaryOut)
def get_gamification_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GamificationSummaryOut:
    """Return current streak, XP, level, badges, and recent practice history."""
    return LearningService(db).get_gamification_summary(current_user)


@router.post("/learning/games/reward", response_model=GameRewardOut)
def record_game_reward(
    payload: GameRewardRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> GameRewardOut:
    """Award bounded XP and milestone badges upon completing a mini-game round."""
    return LearningService(db).record_game_reward(current_user, payload)

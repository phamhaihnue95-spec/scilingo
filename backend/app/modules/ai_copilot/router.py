"""FastAPI routes for Unit 4 (ai_copilot)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rate_limit import rate_limit
from app.modules.ai_copilot.schemas import (
    ClilGenerateOut,
    ClilGenerateRequest,
    CopilotLintOut,
    CopilotLintRequest,
    CopilotStatusOut,
    PronunciationEvalOut,
    PronunciationEvalRequest,
    TutorAskOut,
    TutorAskRequest,
)
from app.modules.ai_copilot.service import CopilotService
from app.modules.identity_billing.dependencies import get_current_user, require_roles
from app.modules.identity_billing.models import User

router = APIRouter(tags=["AI Copilot & Linter (Unit 4)"])


@router.get("/copilot/status", response_model=CopilotStatusOut)
def get_copilot_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CopilotStatusOut:
    """Return active AI provider mode and tenant monthly AI quota."""
    return CopilotService(db).get_status(current_user)


@router.post("/copilot/lint-terminology", response_model=CopilotLintOut)
def lint_terminology(
    payload: CopilotLintRequest,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CopilotLintOut:
    """Validate text against 20 IUPAC/SI rules, 13 exceptions, and Vietnamese compounds."""
    return CopilotService(db).lint_terminology(payload)


@router.post(
    "/copilot/tutor/ask",
    response_model=TutorAskOut,
    dependencies=[Depends(rate_limit("copilot_tutor", max_requests=20, window_seconds=60))],
)
def ask_copilot_tutor(
    payload: TutorAskRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TutorAskOut:
    """Grounded bilingual tutor strictly locked to KHTN 6-9 KNTT and IUPAC/SI rules."""
    return CopilotService(db).ask_tutor(current_user, payload)


@router.post(
    "/copilot/generate-clil-questions",
    response_model=ClilGenerateOut,
    dependencies=[Depends(rate_limit("copilot_clil_gen", max_requests=15, window_seconds=60))],
)
def generate_clil_questions(
    payload: ClilGenerateRequest,
    current_user: User = Depends(require_roles("teacher", "school_admin", "platform_admin")),
    db: Session = Depends(get_db),
) -> ClilGenerateOut:
    """Generate grounded CLIL MCQ questions passed through the Unit 1 IUPAC/SI Linter."""
    return CopilotService(db).generate_clil_questions(current_user, payload)


@router.post(
    "/copilot/pronunciation/evaluate",
    response_model=PronunciationEvalOut,
    dependencies=[Depends(rate_limit("copilot_pronunciation", max_requests=30, window_seconds=60))],
)
def evaluate_pronunciation(
    payload: PronunciationEvalRequest,
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PronunciationEvalOut:
    """Evaluate pronunciation transcript against a science term with IPA feedback."""
    return CopilotService(db).evaluate_pronunciation(payload)

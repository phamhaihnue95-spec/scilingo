"""FastAPI routes for Unit 1 (curriculum)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.curriculum.schemas import (
    CurriculumTreeResponse,
    GradeOverviewOut,
    LessonDetailOut,
    StudyPackOverviewOut,
    StudyPackQuizOut,
    StudyPackQuizStartRequest,
    StudyPackSearchResponse,
    StudyPackUnitDetailOut,
    TermDetailOut,
    TerminologyRulebookOut,
    TermSearchResponse,
)
from app.modules.curriculum.service import CurriculumService

router = APIRouter(tags=["Curriculum & Terminology (Unit 1)"])


@router.get("/curriculum/grades", response_model=list[GradeOverviewOut])
def list_available_grades(db: Session = Depends(get_db)) -> list[GradeOverviewOut]:
    """List all supported KNTT Natural Sciences grades (6, 7, 8, 9) and counts."""
    return CurriculumService(db).list_grades()


@router.get("/curriculum/kntt/{grade}/chapters", response_model=CurriculumTreeResponse)
def list_kntt_chapters_by_grade(
    grade: int,
    discipline: str | None = Query(
        default=None,
        description="Filter by discipline: general_lab, chemistry, physics, biology",
    ),
    db: Session = Depends(get_db),
) -> CurriculumTreeResponse:
    """Return the complete KHTN KNTT chapter and lesson tree for Grade 6, 7, 8, or 9."""
    return CurriculumService(db).get_curriculum_tree(discipline=discipline, grade=grade)


@router.get("/curriculum/kntt-8/chapters", response_model=CurriculumTreeResponse)
def list_kntt8_chapters(
    discipline: str | None = Query(
        default=None,
        description="Filter by discipline: general_lab, chemistry, physics, biology",
    ),
    db: Session = Depends(get_db),
) -> CurriculumTreeResponse:
    """Return the complete KHTN Grade 8 (KNTT) chapter and lesson tree."""
    return CurriculumService(db).get_curriculum_tree(discipline=discipline, grade=8)


@router.get("/curriculum/kntt/{grade}/lessons/{lesson_no}", response_model=LessonDetailOut)
def get_lesson_detail_by_grade(
    grade: int, lesson_no: int, db: Session = Depends(get_db)
) -> LessonDetailOut:
    """Return a lesson for Grade 6..9 with its standardized terms and integration links."""
    return CurriculumService(db).get_lesson_detail(lesson_no, grade=grade)


@router.get("/curriculum/lessons/{lesson_no}", response_model=LessonDetailOut)
def get_lesson_detail(
    lesson_no: int,
    grade: int = Query(default=8, ge=6, le=9),
    db: Session = Depends(get_db),
) -> LessonDetailOut:
    """Return a lesson with its standardized terms and cross-disciplinary links."""
    return CurriculumService(db).get_lesson_detail(lesson_no, grade=grade)


@router.get("/curriculum/rules/iupac", response_model=TerminologyRulebookOut)
def get_iupac_rules(db: Session = Depends(get_db)) -> TerminologyRulebookOut:
    """Return the official 13-element exception and IUPAC/SI terminology rulebook."""
    return CurriculumService(db).get_iupac_rulebook()


@router.get("/terms", response_model=TermSearchResponse)
def search_terms(
    q: str | None = Query(default=None, max_length=120),
    discipline: str | None = Query(default=None),
    grade: int | None = Query(default=None, ge=6, le=9),
    lesson_no: int | None = Query(default=None, ge=1, le=60),
    limit: int = Query(default=60, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> TermSearchResponse:
    """Search verified bilingual terminology cards."""
    return CurriculumService(db).search_terms(
        q=q,
        discipline=discipline,
        grade=grade,
        lesson_no=lesson_no,
        limit=limit,
        offset=offset,
    )


@router.get("/terms/{slug}", response_model=TermDetailOut)
def get_term_detail(slug: str, db: Session = Depends(get_db)) -> TermDetailOut:
    """Retrieve a single standardized term card by slug."""
    return CurriculumService(db).get_term_detail(slug)


@router.get("/study-packs/english-science", response_model=StudyPackOverviewOut)
def get_study_pack_overview(db: Session = Depends(get_db)) -> StudyPackOverviewOut:
    """Return all 16 Units metadata for The English Dictionary for SCIENCE."""
    return CurriculumService(db).get_english_science_pack_overview()


@router.get(
    "/study-packs/english-science/units/{unit_no}",
    response_model=StudyPackUnitDetailOut,
)
def get_study_pack_unit(unit_no: int, db: Session = Depends(get_db)) -> StudyPackUnitDetailOut:
    """Return every extracted bilingual item with IPA and IUPAC notes for Unit 1..16."""
    return CurriculumService(db).get_english_science_unit(unit_no)


@router.get("/study-packs/english-science/search", response_model=StudyPackSearchResponse)
def search_study_pack_items(
    q: str | None = Query(default=None, max_length=120),
    unit_no: int | None = Query(default=None, ge=1, le=16),
    limit: int = Query(default=100, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
) -> StudyPackSearchResponse:
    """Search across all 920 science items in the 16-Unit study pack."""
    return CurriculumService(db).search_english_science_items(
        q=q,
        unit_no=unit_no,
        limit=limit,
        offset=offset,
    )


@router.post("/study-packs/english-science/quiz", response_model=StudyPackQuizOut)
def generate_study_pack_quiz(
    payload: StudyPackQuizStartRequest,
    db: Session = Depends(get_db),
) -> StudyPackQuizOut:
    """Generate a bilingual 10-point practice quiz from selected Study Pack Unit(s)."""
    return CurriculumService(db).generate_study_pack_quiz(payload)

"""Idempotent database seeding for KHTN 8 KNTT curriculum and demo school tenants."""

from __future__ import annotations

import json
import re
import unicodedata
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import Base, get_engine, get_session_factory
from app.core.security import hash_password
from app.modules.curriculum.models import Chapter, Lesson, LessonTerm, Term
from app.modules.identity_billing.models import Subscription, Tenant, User
from app.modules.lms.models import Classroom, ClassroomMember, TeachingSessionLog


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", normalized.lower()).strip("-")
    return cleaned or "term"


def _detect_exception_element(term_en: str, exception_names: set[str]) -> bool:
    tokens = {tok.lower() for tok in re.split(r"[^a-zA-Z]+", term_en) if tok}
    return bool(tokens & exception_names)


def seed_curriculum(db: Session, data_dir: Path) -> tuple[int, int, int]:
    """Load all 47 KNTT Grade 8 lessons and glossary seed terms idempotently."""
    curriculum_json = json.loads(
        (data_dir / "khtn8_kntt_curriculum.json").read_text(encoding="utf-8")
    )
    rules_json = json.loads(
        (data_dir / "terminology_rules.json").read_text(encoding="utf-8")
    )
    exception_names = {
        item["iupac_en"].lower() for item in rules_json["exception_13_elements"]
    }

    existing_terms = {t.slug: t for t in db.scalars(select(Term)).all()}
    chapters_created = 0
    lessons_created = 0
    terms_created = 0

    for ch_data in curriculum_json["chapters"]:
        chapter = db.scalar(
            select(Chapter).where(
                Chapter.grade == 8,
                Chapter.textbook_series == "kntt",
                Chapter.chapter_no == ch_data["chapter_no"],
            )
        )
        if chapter is None:
            chapter = Chapter(
                grade=8,
                textbook_series="kntt",
                chapter_no=ch_data["chapter_no"],
                code=ch_data["code"],
                title_vi=ch_data["title_vi"],
                title_en=ch_data["title_en"],
                discipline=ch_data["discipline"],
            )
            db.add(chapter)
            db.flush()
            chapters_created += 1

        for l_data in ch_data["lessons"]:
            lesson = db.scalar(
                select(Lesson).where(
                    Lesson.chapter_id == chapter.id,
                    Lesson.lesson_no == l_data["lesson_no"],
                )
            )
            if lesson is None:
                lesson = Lesson(
                    chapter_id=chapter.id,
                    lesson_no=l_data["lesson_no"],
                    title_vi=l_data["title_vi"],
                    title_en=l_data["title_en"],
                    discipline=l_data["discipline"],
                    is_practical=bool(l_data.get("is_practical", False)),
                    integration_links_json=l_data.get("integration_links", []),
                    summary_vi=(
                        f"Bài {l_data['lesson_no']}: {l_data['title_vi']} "
                        "(SGK KHTN 8 Kết nối tri thức)."
                    ),
                    summary_en=f"Lesson {l_data['lesson_no']}: {l_data['title_en']}.",
                )
                db.add(lesson)
                db.flush()
                lessons_created += 1

            for idx, term_data in enumerate(l_data.get("glossary_seed", [])):
                slug = _slugify(term_data["en"])
                term = existing_terms.get(slug)
                if term is None:
                    term = Term(
                        slug=slug,
                        term_en=term_data["en"],
                        term_vi=term_data["vi"],
                        ipa=term_data.get("ipa") or None,
                        discipline=l_data["discipline"],
                        formula_or_symbol=term_data.get("symbol_or_formula") or None,
                        iupac_note=term_data.get("note") or None,
                        is_13_exception_element=_detect_exception_element(
                            term_data["en"], exception_names
                        ),
                        definition_vi=f"{term_data['vi']} ({l_data['title_vi']})",
                        definition_en=(
                            f"Key Grade 8 Natural Sciences term in '{l_data['title_en']}'."
                        ),
                        status="verified",
                    )
                    db.add(term)
                    db.flush()
                    existing_terms[slug] = term
                    terms_created += 1

                existing_link = db.scalar(
                    select(LessonTerm).where(
                        LessonTerm.lesson_id == lesson.id,
                        LessonTerm.term_id == term.id,
                    )
                )
                if existing_link is None:
                    db.add(
                        LessonTerm(
                            lesson_id=lesson.id,
                            term_id=term.id,
                            is_core=True,
                            display_order=idx,
                        )
                    )

    db.commit()
    return chapters_created, lessons_created, terms_created


def seed_demo_tenants(db: Session) -> None:
    """Create demo B2B school tenants and RBAC accounts for development/pilot testing."""
    cgb_name = "Trường THCS Cầu Giấy B"
    legacy_cva_name = "Trường THCS Chu Văn An (Demo TT94)"
    cgb = db.scalar(select(Tenant).where(Tenant.name == cgb_name))
    if cgb is None:
        cgb = db.scalar(select(Tenant).where(Tenant.name == legacy_cva_name))
        if cgb is not None:
            cgb.name = cgb_name
            cgb.province = "Hà Nội"
            cgb.district = "Cầu Giấy"
            db.flush()
        else:
            cgb = Tenant(
                name=cgb_name,
                tenant_type="school",
                province="Hà Nội",
                district="Cầu Giấy",
                target_tt94_level=2,
            )
            db.add(cgb)
            db.flush()
            db.add(
                Subscription(
                    tenant_id=cgb.id,
                    plan_code="school_l2",
                    ai_monthly_quota=5000,
                    ai_used_this_month=0,
                    status="active",
                )
            )

    nt_name = "Trường THCS Nguyễn Trãi (Demo TT94)"
    nt = db.scalar(select(Tenant).where(Tenant.name == nt_name))
    if nt is None:
        nt = Tenant(
            name=nt_name,
            tenant_type="school",
            province="TP. Hồ Chí Minh",
            district="Quận 5",
            target_tt94_level=1,
        )
        db.add(nt)
        db.flush()
        db.add(
            Subscription(
                tenant_id=nt.id,
                plan_code="school_l1",
                ai_monthly_quota=1500,
                ai_used_this_month=0,
                status="active",
            )
        )

    # Migrate legacy teacher account email/name in-place on existing databases so FK links remain
    hai_teacher = db.scalar(select(User).where(User.email == "hai.gv@demo.scilingo.vn"))
    if hai_teacher is None:
        legacy_teacher = db.scalar(select(User).where(User.email == "minh.gv@demo.scilingo.vn"))
        if legacy_teacher is not None:
            legacy_teacher.email = "hai.gv@demo.scilingo.vn"
            legacy_teacher.full_name = "Phạm Thị Hải"
            legacy_teacher.tenant_id = cgb.id
            db.flush()
    elif hai_teacher.full_name != "Phạm Thị Hải":
        hai_teacher.full_name = "Phạm Thị Hải"
        db.flush()

    demo_accounts = [
        (cgb.id, "an.hs8@demo.scilingo.vn", "Student123!", "Nguyễn Minh An", "student", 8),
        (cgb.id, "hai.gv@demo.scilingo.vn", "Teacher123!", "Phạm Thị Hải", "teacher", None),
        (
            cgb.id,
            "hung.bgh@demo.scilingo.vn",
            "Admin123!",
            "Thầy Trần Quốc Hùng",
            "school_admin",
            None,
        ),
        (nt.id, "lan.bgh@demo.scilingo.vn", "Admin123!", "Cô Phạm Ngọc Lan", "school_admin", None),
    ]

    for tenant_id, email, raw_pw, full_name, role, grade_level in demo_accounts:
        if db.scalar(select(User).where(User.email == email)) is None:
            db.add(
                User(
                    tenant_id=tenant_id,
                    email=email,
                    password_hash=hash_password(raw_pw),
                    full_name=full_name,
                    role=role,
                    grade_level=grade_level,
                    is_active=True,
                )
            )

    db.commit()


def seed_demo_lms(db: Session) -> None:
    """Create a demo KHTN 8 CLIL classroom and starter session logs idempotently."""
    teacher = db.scalar(select(User).where(User.email == "hai.gv@demo.scilingo.vn"))
    student = db.scalar(select(User).where(User.email == "an.hs8@demo.scilingo.vn"))
    if teacher is None:
        return

    demo_code = "KHTN8-CGB8"
    classroom = db.scalar(select(Classroom).where(Classroom.join_code == demo_code))
    if classroom is None:
        legacy_cls = db.scalar(select(Classroom).where(Classroom.join_code == "KHTN8-CVA8"))
        if legacy_cls is not None:
            legacy_cls.join_code = demo_code
            db.commit()
            return
        classroom = Classroom(
            tenant_id=teacher.tenant_id,
            teacher_id=teacher.id,
            name="8A1 - KHTN Song ngữ (Thí điểm TT94)",
            grade=8,
            academic_year="2026-2027",
            join_code=demo_code,
            is_tt94_pilot_class=True,
        )
        db.add(classroom)
        db.flush()

        if student is not None:
            db.add(ClassroomMember(classroom_id=classroom.id, student_id=student.id))

        db.add_all(
            [
                TeachingSessionLog(
                    tenant_id=teacher.tenant_id,
                    classroom_id=classroom.id,
                    teacher_id=teacher.id,
                    lesson_no=8,
                    taught_date=date(2026, 10, 12),
                    periods_count=2,
                    clil_mode="bilingual_10",
                    english_minutes=30,
                    notes="Giới thiệu danh pháp Acid (HCl, H₂SO₄) chuẩn IUPAC và liên hệ Bài 32.",
                ),
                TeachingSessionLog(
                    tenant_id=teacher.tenant_id,
                    classroom_id=classroom.id,
                    teacher_id=teacher.id,
                    lesson_no=15,
                    taught_date=date(2026, 10, 26),
                    periods_count=2,
                    clil_mode="bilingual_50",
                    english_minutes=45,
                    notes="Thực hành tính Pressure (Pa = N/m²) bằng tiếng Anh 50%.",
                ),
            ]
        )
        db.commit()


def seed_all(db: Session, data_dir: Path | None = None) -> tuple[int, int, int]:
    """Run all Bolt 1-3 idempotent seeders."""
    resolved_dir = data_dir or get_settings().data_dir
    counts = seed_curriculum(db, resolved_dir)
    seed_demo_tenants(db)
    seed_demo_lms(db)
    return counts


if __name__ == "__main__":
    engine = get_engine()
    if engine.dialect.name == "sqlite":
        Base.metadata.create_all(bind=engine)
    session = get_session_factory()()
    try:
        ch_count, l_count, t_count = seed_all(session)
        print(
            f"Seed complete: +{ch_count} chapters, +{l_count} lessons, +{t_count} terms, "
            "plus demo B2B tenants & RBAC accounts."
        )
    finally:
        session.close()

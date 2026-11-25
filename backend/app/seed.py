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
from app.modules.learning.models import StudentGamification, StudentPet
from app.modules.lms.models import (
    Classroom,
    ClassroomMember,
    TeacherResource,
    TeachingSessionLog,
)


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    cleaned = re.sub(r"[^a-zA-Z0-9]+", "-", normalized.lower()).strip("-")
    return cleaned or "term"


def _detect_exception_element(term_en: str, exception_names: set[str]) -> bool:
    tokens = {tok.lower() for tok in re.split(r"[^a-zA-Z]+", term_en) if tok}
    return bool(tokens & exception_names)


CURRICULUM_FILES: tuple[tuple[int, str], ...] = (
    (6, "khtn6_kntt_curriculum.json"),
    (7, "khtn7_kntt_curriculum.json"),
    (8, "khtn8_kntt_curriculum.json"),
    (9, "khtn9_kntt_curriculum.json"),
)


def seed_curriculum(db: Session, data_dir: Path) -> tuple[int, int, int]:
    """Load all KNTT Grade 6, 7, 8, and 9 lessons and glossary terms idempotently."""
    rules_json = json.loads(
        (data_dir / "terminology_rules.json").read_text(encoding="utf-8")
    )
    exception_names = {
        item["iupac_en"].lower() for item in rules_json["exception_13_elements"]
    }

    existing_chapters = {
        (c.grade, c.textbook_series, c.chapter_no): c for c in db.scalars(select(Chapter)).all()
    }
    existing_lessons = {
        (les.chapter_id, les.lesson_no): les for les in db.scalars(select(Lesson)).all()
    }
    existing_terms = {t.slug: t for t in db.scalars(select(Term)).all()}
    existing_links = {
        (lt.lesson_id, lt.term_id) for lt in db.scalars(select(LessonTerm)).all()
    }

    chapters_created = 0
    lessons_created = 0
    terms_created = 0

    for grade, filename in CURRICULUM_FILES:
        file_path = data_dir / filename
        if not file_path.is_file():
            continue
        curriculum_json = json.loads(file_path.read_text(encoding="utf-8"))

        for ch_data in curriculum_json["chapters"]:
            ch_key = (grade, "kntt", ch_data["chapter_no"])
            chapter = existing_chapters.get(ch_key)
            if chapter is None:
                chapter = Chapter(
                    grade=grade,
                    textbook_series="kntt",
                    chapter_no=ch_data["chapter_no"],
                    code=ch_data["code"],
                    title_vi=ch_data["title_vi"],
                    title_en=ch_data["title_en"],
                    discipline=ch_data["discipline"],
                )
                db.add(chapter)
                db.flush()
                existing_chapters[ch_key] = chapter
                chapters_created += 1

            for l_data in ch_data["lessons"]:
                l_key = (chapter.id, l_data["lesson_no"])
                lesson = existing_lessons.get(l_key)
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
                            f"(SGK KHTN {grade} Kết nối tri thức)."
                        ),
                        summary_en=(
                            f"Grade {grade} Lesson {l_data['lesson_no']}: "
                            f"{l_data['title_en']}."
                        ),
                    )
                    db.add(lesson)
                    db.flush()
                    existing_lessons[l_key] = lesson
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
                            definition_vi=(
                                f"{term_data['vi']} (KHTN {grade} · {l_data['title_vi']})"
                            ),
                            definition_en=(
                                f"Key Grade {grade} Natural Sciences term in "
                                f"'{l_data['title_en']}'."
                            ),
                            status="verified",
                        )
                        db.add(term)
                        db.flush()
                        existing_terms[slug] = term
                        terms_created += 1

                    link_key = (lesson.id, term.id)
                    if link_key not in existing_links:
                        db.add(
                            LessonTerm(
                                lesson_id=lesson.id,
                                term_id=term.id,
                                is_core=True,
                                display_order=idx,
                            )
                        )
                        existing_links.add(link_key)

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
        (cgb.id, "linh.hs8@demo.scilingo.vn", "Student123!", "Trần Khánh Linh", "student", 8),
        (cgb.id, "khoi.hs8@demo.scilingo.vn", "Student123!", "Lê Minh Khôi", "student", 8),
        (cgb.id, "hai.gv@demo.scilingo.vn", "Teacher123!", "Phạm Thị Hải", "teacher", None),
        (
            cgb.id,
            "hung.bgh@demo.scilingo.vn",
            "Admin123!",
            "Thầy Trần Quốc Hùng",
            "school_admin",
            None,
        ),
        (
            cgb.id,
            "admin@demo.scilingo.vn",
            "Admin123!",
            "Quản trị SciLingo (Platform Admin)",
            "platform_admin",
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
    if teacher is None:
        return

    demo_code = "KHTN8-CGB8"
    classroom = db.scalar(select(Classroom).where(Classroom.join_code == demo_code))
    if classroom is None:
        legacy_cls = db.scalar(select(Classroom).where(Classroom.join_code == "KHTN8-CVA8"))
        if legacy_cls is not None:
            legacy_cls.join_code = demo_code
            db.flush()
            classroom = legacy_cls
        else:
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
                        notes=(
                            "Giới thiệu danh pháp Acid (HCl, H₂SO₄) chuẩn IUPAC "
                            "và liên hệ Bài 32."
                        ),
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

    # Ensure demo students are enrolled in 8A1 idempotently
    for email in (
        "an.hs8@demo.scilingo.vn",
        "linh.hs8@demo.scilingo.vn",
        "khoi.hs8@demo.scilingo.vn",
    ):
        stu = db.scalar(select(User).where(User.email == email))
        if stu is None:
            continue
        existing_member = db.scalar(
            select(ClassroomMember).where(
                ClassroomMember.classroom_id == classroom.id,
                ClassroomMember.student_id == stu.id,
            )
        )
        if existing_member is None:
            db.add(ClassroomMember(classroom_id=classroom.id, student_id=stu.id))

    # Starter leaderboard profiles ONLY for classmates Linh & Khoi
    # (Keep an.hs8 clean for SRS/quiz baseline tests)
    classmate_profiles = [
        (
            "linh.hs8@demo.scilingo.vn",
            260,
            4,
            5,
            ["First Spark", "Tia Chớp Nối Cặp", "SciDex: Unit 1", "SciDex: Unit 7"],
        ),
        (
            "khoi.hs8@demo.scilingo.vn",
            190,
            3,
            4,
            ["First Spark", "Hiệp Sĩ IUPAC", "SciDex: Unit 2"],
        ),
    ]
    for email, xp, cur_streak, max_streak, badges in classmate_profiles:
        stu = db.scalar(select(User).where(User.email == email))
        if stu is None:
            continue
        existing_gamif = db.scalar(
            select(StudentGamification).where(StudentGamification.student_id == stu.id)
        )
        if existing_gamif is None:
            db.add(
                StudentGamification(
                    student_id=stu.id,
                    total_xp=xp,
                    current_streak=cur_streak,
                    longest_streak=max_streak,
                    badges_json=badges,
                    discipline_xp_json={
                        "general_lab": 40,
                        "chemistry": 80,
                        "physics": 70,
                        "biology": xp - 190,
                    },
                )
            )

    # Seed starter SciPet companions ONLY for classmates Linh & Khoi
    # (Keep an.hs8 clean for SciPet onboarding baseline tests)
    classmate_pets = [
        ("linh.hs8@demo.scilingo.vn", "fox", "Atom", "test_tube", "atom", 2, 4),
        ("khoi.hs8@demo.scilingo.vn", "cat", "Neko", "magnet", "forest", 1, 3),
    ]
    for email, sp, nick, acc, hab, fed_c, pet_c in classmate_pets:
        stu = db.scalar(select(User).where(User.email == email))
        if stu is None:
            continue
        existing_pet = db.scalar(
            select(StudentPet).where(StudentPet.student_id == stu.id)
        )
        if existing_pet is None:
            db.add(
                StudentPet(
                    student_id=stu.id,
                    species=sp,
                    nickname=nick,
                    equipped_accessory=acc,
                    equipped_habitat=hab,
                    fed_count=fed_c,
                    petted_count=pet_c,
                )
            )

    # Ensure 1 starter 5-minute mini-game challenge exists for 8A1
    existing_challenge = db.scalar(
        select(TeacherResource).where(
            TeacherResource.tenant_id == teacher.tenant_id,
            TeacherResource.resource_type == "game_challenge",
        )
    )
    if existing_challenge is None:
        db.add(
            TeacherResource(
                grade=8,
                lesson_no=1,
                tenant_id=teacher.tenant_id,
                title="Thử thách 5 phút: Nối nhanh 920 từ vựng Unit 1 (Astronomy)",
                resource_type="game_challenge",
                clil_mode="bilingual_50",
                content_markdown=(
                    "Các em hoàn thành tối thiểu 120 điểm ở Chế độ Nối Cặp 60s (Unit 1) "
                    "để mở khóa huy hiệu 3D SciDex Unit 1 nhé! — Cô Phạm Thị Hải"
                ),
                metadata_json={
                    "classroom_id": classroom.id,
                    "game_type": "lightning_match",
                    "unit_no": 1,
                    "target_score": 120,
                    "duration_minutes": 5,
                    "created_by_name": teacher.full_name,
                },
                is_official=False,
            )
        )

    # Seed representative classrooms for Grades 6, 7, 9 at Truong THCS Cau Giay B
    extra_grade_classes = [
        (
            6,
            "6A1 - KHTN 6 Song ngữ",
            "KHTN6-CGB6",
            18,
            "Giới thiệu tế bào nhân thực và kính hiển vi bằng tiếng Anh (bilingual_10).",
        ),
        (
            7,
            "7A1 - KHTN 7 Song ngữ",
            "KHTN7-CGB7",
            4,
            "Đọc tên nguyên tố IUPAC & Bảng tuần hoàn.",
        ),
        (
            9,
            "9A1 - KHTN 9 Ôn thi Song ngữ",
            "KHTN9-CGB9",
            25,
            "Phân biệt Ethylic alcohol (Ethanol) & Acetic acid chuẩn IUPAC.",
        ),
    ]
    for g_val, g_name, g_code, g_lesson, g_note in extra_grade_classes:
        g_cls = db.scalar(select(Classroom).where(Classroom.join_code == g_code))
        if g_cls is None:
            g_cls = Classroom(
                tenant_id=teacher.tenant_id,
                teacher_id=teacher.id,
                name=g_name,
                grade=g_val,
                academic_year="2026-2027",
                join_code=g_code,
                is_tt94_pilot_class=True,
            )
            db.add(g_cls)
            db.flush()
            db.add(
                TeachingSessionLog(
                    tenant_id=teacher.tenant_id,
                    classroom_id=g_cls.id,
                    teacher_id=teacher.id,
                    grade=g_val,
                    lesson_no=g_lesson,
                    taught_date=date(2026, 11, 2),
                    periods_count=2,
                    clil_mode="bilingual_10",
                    english_minutes=30,
                    notes=g_note,
                )
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

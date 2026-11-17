"""CLIL lesson plan & bilingual slide deck generator for KHTN 8 KNTT."""

from __future__ import annotations

from app.modules.curriculum.schemas import LessonDetailOut
from app.modules.lms.schemas import TeacherResourceOut


def build_lesson_clil_pack(lesson: LessonDetailOut) -> list[TeacherResourceOut]:
    """Generate ready-to-teach CLIL lesson plan, bilingual slides, and glossary worksheet."""
    term_rows = "\n".join(
        f"| **{t.term_en}** | {t.ipa or '-'} | {t.term_vi} | `{t.formula_or_symbol or '-'}` |"
        for t in lesson.terms
    )
    integration_notes = (
        "\n".join(
            f"- Kết nối **Bài {lk.target_lesson_no} ({lk.target_title_vi})**: {lk.note_vi}"
            for lk in lesson.integration_links
        )
        or "- Củng cố mạch kiến thức liên môn theo định hướng KHTN tích hợp (Công văn 5208)."
    )

    lead_term = lesson.terms[0].term_en if lesson.terms else lesson.title_en
    plan_md = f"""# Giáo án CLIL — Bài {lesson.lesson_no}: {lesson.title_vi}
**English Title:** *{lesson.title_en}*  
**Chương:** {lesson.chapter_title_vi} | **Mạch kiến thức:** `{lesson.discipline}`

## 1. Mục tiêu kép (CLIL Objectives)
- **Kiến thức KHTN (Content):** Nắm vững nội dung *{lesson.title_vi}* theo SGK Kết nối tri thức.
- **Ngôn ngữ khoa học (Language):** Phát âm và dùng đúng {len(lesson.terms)} thuật ngữ IUPAC/SI.

## 2. Bảng Thuật ngữ Trọng tâm (5–10 phút khởi động song ngữ)
| English Term | IPA | Nghĩa SGK | Ký hiệu / Công thức |
| :--- | :--- | :--- | :--- |
{term_rows}

## 3. Liên kết Tích hợp Liên phân môn (Công văn 5208/BGDĐT-GDPT)
{integration_notes}

## 4. Câu hỏi Kiểm tra Nhanh (Exit Ticket — Chuẩn 10%/50% Thông tư 94/2026)
- *Teacher prompt:* "Look at **{lead_term}** and match it with its Vietnamese meaning."
"""

    slides_md = "\n\n---\n\n".join(
        [
            (
                f"### Slide 1: {lesson.title_en}\n"
                f"**{lesson.title_vi}**\n- Chapter: {lesson.chapter_title_en}"
            ),
            *[
                (
                    f"### Slide {idx + 2}: {t.term_en}\n"
                    f"- **IPA:** `{t.ipa or 'N/A'}`\n"
                    f"- **Vietnamese:** {t.term_vi}\n"
                    f"- **Symbol / Formula:** `{t.formula_or_symbol or '-'}`\n"
                    f"- **Note:** {t.iupac_note or 'Chuẩn SGK KNTT 8'}"
                )
                for idx, t in enumerate(lesson.terms)
            ],
        ]
    )

    worksheet_items = "\n".join(
        f"{idx + 1}. Match `{t.term_en}` "
        f"{f'({t.formula_or_symbol})' if t.formula_or_symbol else ''} -> __________________"
        for idx, t in enumerate(lesson.terms)
    )
    worksheet_md = (
        f"# Phiếu học tập Song ngữ — Bài {lesson.lesson_no}: {lesson.title_en}\n\n"
        f"{worksheet_items}\n"
    )

    return [
        TeacherResourceOut(
            id=f"official-plan-{lesson.lesson_no}",
            lesson_no=lesson.lesson_no,
            title=f"Giáo án CLIL 45 phút — Bài {lesson.lesson_no}: {lesson.title_vi}",
            resource_type="lesson_plan",
            clil_mode="bilingual_10",
            content_markdown=plan_md,
            is_official=True,
        ),
        TeacherResourceOut(
            id=f"official-slide-{lesson.lesson_no}",
            lesson_no=lesson.lesson_no,
            title=f"Slide Thẻ thuật ngữ Song ngữ — Bài {lesson.lesson_no}: {lesson.title_en}",
            resource_type="bilingual_slide",
            clil_mode="bilingual_50",
            content_markdown=slides_md,
            is_official=True,
        ),
        TeacherResourceOut(
            id=f"official-ws-{lesson.lesson_no}",
            lesson_no=lesson.lesson_no,
            title=f"Phiếu học tập (Worksheet) — Bài {lesson.lesson_no}",
            resource_type="worksheet",
            clil_mode="term_only",
            content_markdown=worksheet_md,
            is_official=True,
        ),
    ]

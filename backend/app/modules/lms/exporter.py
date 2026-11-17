"""Word (.docx) and PDF (.pdf) exam exporters preserving Vietnamese & IUPAC/SI Unicode."""

from __future__ import annotations

from io import BytesIO
from pathlib import Path

from docx import Document
from docx.shared import Pt
from fpdf import FPDF

from app.modules.lms.schemas import ExamDetailOut

OPTION_LABELS = ["A", "B", "C", "D"]

FONT_CANDIDATES: list[tuple[str, str | None]] = [
    (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ),
    (
        r"C:\Windows\Fonts\segoeui.ttf",
        r"C:\Windows\Fonts\segoeuib.ttf",
    ),
    (
        r"C:\Windows\Fonts\arial-unicode-ms.ttf",
        None,
    ),
]


def _resolve_unicode_font() -> tuple[Path | None, Path | None]:
    for regular_str, bold_str in FONT_CANDIDATES:
        reg_path = Path(regular_str)
        if reg_path.is_file():
            bold_path = Path(bold_str) if bold_str and Path(bold_str).is_file() else None
            return reg_path, bold_path
    return None, None


def export_exam_docx(
    exam: ExamDetailOut,
    school_name: str,
    teacher_name: str | None = None,
) -> bytes:
    """Render an ExamDetailOut payload as a formatted Microsoft Word (.docx) document."""
    doc = Document()

    normal_style = doc.styles["Normal"]
    normal_style.font.name = "Arial"
    normal_style.font.size = Pt(11)

    header_p = doc.add_paragraph()
    header_run = header_p.add_run(f"{school_name.upper()}\n")
    header_run.bold = True
    header_run.font.size = Pt(11)
    header_p.add_run("ĐỀ KIỂM TRA ĐỊNH KỲ MÔN KHOA HỌC TỰ NHIÊN 8 (KNTT)\n").bold = True
    if teacher_name:
        header_p.add_run(f"Giáo viên phụ trách: {teacher_name}\n").italic = True

    title_p = doc.add_paragraph()
    title_run = title_p.add_run(exam.title)
    title_run.bold = True
    title_run.font.size = Pt(14)

    pct = round(exam.achieved_en_ratio * 100, 1)
    meta_p = doc.add_paragraph(
        f"Thời gian làm bài: {exam.duration_minutes} phút | "
        f"Tổng điểm: {exam.total_points} | "
        f"Tỷ trọng Tiếng Anh (Thông tư 94/2026): {exam.en_points}/{exam.total_points} điểm ({pct}%)"
    )
    meta_p.runs[0].italic = True

    doc.add_paragraph(
        "Họ và tên học sinh: ............................................. Lớp: ........."
    )

    for q in exam.questions:
        lang_tag = "EN" if q.language == "en" else "VI"
        q_para = doc.add_paragraph()
        q_lead = q_para.add_run(f"Câu {q.order_no} [{lang_tag} - {q.points} điểm]: ")
        q_lead.bold = True
        q_para.add_run(q.prompt_text)

        for opt_idx, opt_text in enumerate(q.options):
            label = OPTION_LABELS[opt_idx] if opt_idx < len(OPTION_LABELS) else str(opt_idx + 1)
            doc.add_paragraph(f"    {label}. {opt_text}")

    doc.add_page_break()
    ans_title = doc.add_paragraph()
    ans_run = ans_title.add_run("ĐÁP ÁN & HƯỚNG DẪN CHẤM (CHUẨN IUPAC / SI)")
    ans_run.bold = True
    ans_run.font.size = Pt(13)

    for q in exam.questions:
        correct_idx = q.options.index(q.correct_answer) if q.correct_answer in q.options else -1
        correct_letter = OPTION_LABELS[correct_idx] if 0 <= correct_idx < 4 else "-"
        ans_p = doc.add_paragraph()
        ans_p.add_run(f"Câu {q.order_no} ({correct_letter}): ").bold = True
        ans_p.add_run(f"{q.correct_answer}. {q.explanation_vi}")

    buf = BytesIO()
    doc.save(buf)
    return buf.getvalue()


def export_exam_pdf(
    exam: ExamDetailOut,
    school_name: str,
    teacher_name: str | None = None,
) -> bytes:
    """Render an ExamDetailOut payload as a Unicode PDF preserving Vietnamese & H₂SO₄/kg/m³."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    reg_font, bold_font = _resolve_unicode_font()
    font_family = "SciUnicode"
    if reg_font is not None:
        pdf.add_font(font_family, style="", fname=str(reg_font))
        pdf.add_font(
            font_family,
            style="B",
            fname=str(bold_font if bold_font is not None else reg_font),
        )
    else:
        font_family = "Helvetica"

    def _safe_text(text: str) -> str:
        if font_family == "Helvetica":
            return text.encode("latin-1", "replace").decode("latin-1")
        return text

    def _write_block(h: float, text: str) -> None:
        pdf.set_x(pdf.l_margin)
        pdf.multi_cell(
            w=pdf.epw,
            h=h,
            text=_safe_text(text),
            new_x="LMARGIN",
            new_y="NEXT",
        )

    pct = round(exam.achieved_en_ratio * 100, 1)

    pdf.set_font(font_family, style="B", size=11)
    _write_block(6, school_name.upper())
    if teacher_name:
        pdf.set_font(font_family, style="", size=10)
        _write_block(5.5, f"Giáo viên phụ trách: {teacher_name}")
    pdf.set_font(font_family, style="B", size=14)
    _write_block(8, exam.title)

    pdf.set_font(font_family, style="", size=10)
    _write_block(
        6,
        f"Thời gian: {exam.duration_minutes} phút | Tổng điểm: {exam.total_points} | "
        f"Tiếng Anh (TT 94/2026): {exam.en_points}/{exam.total_points} điểm ({pct}%)",
    )
    pdf.ln(3)

    for q in exam.questions:
        lang_tag = "EN" if q.language == "en" else "VI"
        pdf.set_font(font_family, style="B", size=10.5)
        _write_block(6, f"Câu {q.order_no} [{lang_tag} - {q.points}đ]: {q.prompt_text}")
        pdf.set_font(font_family, style="", size=10)
        for opt_idx, opt_text in enumerate(q.options):
            label = OPTION_LABELS[opt_idx] if opt_idx < len(OPTION_LABELS) else str(opt_idx + 1)
            _write_block(5.5, f"   {label}. {opt_text}")
        pdf.ln(1.5)

    pdf.add_page()
    pdf.set_font(font_family, style="B", size=13)
    _write_block(8, "ĐÁP ÁN & HƯỚNG DẪN CHẤM (CHUẨN IUPAC / SI)")
    pdf.ln(2)

    for q in exam.questions:
        correct_idx = q.options.index(q.correct_answer) if q.correct_answer in q.options else -1
        correct_letter = OPTION_LABELS[correct_idx] if 0 <= correct_idx < 4 else "-"
        pdf.set_font(font_family, style="B", size=10)
        _write_block(5.5, f"Câu {q.order_no} [{correct_letter}]: {q.correct_answer}")
        if q.explanation_vi:
            pdf.set_font(font_family, style="", size=9.5)
            _write_block(5, f"   Giải thích: {q.explanation_vi}")
        pdf.ln(1)

    return bytes(pdf.output())

"""Service layer for Unit 4 (ai_copilot): Grounded KHTN RAG, CLIL Gen & Speech Eval."""

from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.ai_copilot.guardrails import (
    build_corrected_preview,
    call_gemini_text,
    detect_prompt_injection,
    evaluate_pronunciation,
    find_compound_exception_issues,
    is_khtn_science_query,
)
from app.modules.ai_copilot.schemas import (
    ClilGenerateOut,
    ClilGenerateRequest,
    CopilotLintOut,
    CopilotLintRequest,
    CopilotStatusOut,
    GeneratedClilQuestionOut,
    PronunciationEvalOut,
    PronunciationEvalRequest,
    RagCitationOut,
    TutorAskOut,
    TutorAskRequest,
)
from app.modules.curriculum.schemas import LintCheckOut
from app.modules.curriculum.service import CurriculumService
from app.modules.identity_billing.models import User
from app.modules.identity_billing.service import IdentityService
from app.modules.lms.exam_engine import synthesize_questions_from_curriculum


class CopilotService:
    """Coordinates Unit 4 AI Copilot features while respecting Bounded Contexts."""

    def __init__(self, db: Session) -> None:
        self.db = db
        self.curriculum = CurriculumService(db)
        self.identity = IdentityService(db)

    def get_status(self, user: User) -> CopilotStatusOut:
        ent = self.identity.get_entitlements(user)
        mode = "gemini" if get_settings().gemini_api_key.strip() else "grounded_rag"
        return CopilotStatusOut(
            provider_mode=mode,
            plan_code=ent.plan_code,
            ai_monthly_quota=ent.ai_monthly_quota,
            ai_used_this_month=ent.ai_used_this_month,
            ai_remaining=ent.ai_remaining,
        )

    def lint_terminology(self, payload: CopilotLintRequest) -> CopilotLintOut:
        base_report = self.curriculum.lint_content(payload.text, discipline=payload.discipline)
        extra_issues = find_compound_exception_issues(payload.text, base_report.issues)
        all_issues = [*base_report.issues, *extra_issues]
        error_count = sum(1 for iss in all_issues if iss.severity == "error")
        warning_count = sum(1 for iss in all_issues if iss.severity != "error")
        corrected = build_corrected_preview(payload.text, all_issues)
        return CopilotLintOut(
            passed=error_count == 0,
            error_count=error_count,
            warning_count=warning_count,
            issues=all_issues,
            exception_notes=base_report.exception_notes,
            corrected_preview=corrected,
        )

    def _run_output_lint(self, text: str, discipline: str | None = None) -> LintCheckOut:
        base_report = self.curriculum.lint_content(text, discipline=discipline)
        extra_issues = find_compound_exception_issues(text, base_report.issues)
        all_issues = [*base_report.issues, *extra_issues]
        error_count = sum(1 for iss in all_issues if iss.severity == "error")
        warning_count = sum(1 for iss in all_issues if iss.severity != "error")
        return LintCheckOut(
            passed=error_count == 0,
            error_count=error_count,
            warning_count=warning_count,
            issues=all_issues,
            exception_notes=base_report.exception_notes,
        )

    def ask_tutor(self, user: User, payload: TutorAskRequest) -> TutorAskOut:
        ent = self.identity.get_entitlements(user)
        injection_msg = detect_prompt_injection(payload.question)
        if injection_msg is not None:
            empty_lint = LintCheckOut(passed=True, error_count=0, warning_count=0)
            return TutorAskOut(
                on_topic=False,
                provider="grounded_rag",
                answer_vi=injection_msg,
                answer_en=(
                    "Security guardrail triggered. This assistant only supports "
                    "Natural Sciences (Grades 6–9)."
                ),
                citations=[],
                lint_report=empty_lint,
                quota_remaining=ent.ai_remaining,
                refusal_reason=injection_msg,
            )

        # Grounded RAG retrieval strictly from Unit 1 (curriculum & study pack)
        citations: list[RagCitationOut] = []
        lesson_detail = None
        if payload.lesson_no is not None:
            try:
                lesson_detail = self.curriculum.get_lesson_detail(
                    payload.lesson_no, grade=payload.grade
                )
                citations.append(
                    RagCitationOut(
                        source_type="lesson",
                        title=f"KHTN {lesson_detail.grade} Bài {lesson_detail.lesson_no}: "
                        f"{lesson_detail.title_vi}",
                        detail=lesson_detail.title_en,
                        grade=lesson_detail.grade,
                        lesson_no=lesson_detail.lesson_no,
                    )
                )
            except Exception:
                lesson_detail = None

        tokens = [
            tok
            for tok in re.split(r"[^a-zA-ZÀ-ỹ0-9]+", payload.question)
            if len(tok) >= 3
        ]
        search_candidates = [payload.question] + tokens[:4]
        matched_terms = []
        seen_term_ids: set[str] = set()
        for q_str in search_candidates:
            res = self.curriculum.search_terms(
                q=q_str,
                grade=payload.grade if lesson_detail is None else None,
                limit=4,
            )
            for t in res.items:
                if t.id not in seen_term_ids:
                    seen_term_ids.add(t.id)
                    matched_terms.append(t)
                    if len(matched_terms) >= 5:
                        break
            if len(matched_terms) >= 5:
                break

        if lesson_detail is not None and not matched_terms:
            matched_terms = lesson_detail.terms[:4]

        for t in matched_terms[:4]:
            citations.append(
                RagCitationOut(
                    source_type="term",
                    title=f"{t.term_en} ({t.ipa or 'IUPAC/SI'})",
                    detail=f"{t.term_vi}" + (f" · {t.iupac_note}" if t.iupac_note else ""),
                    grade=payload.grade,
                    lesson_no=payload.lesson_no,
                )
            )

        pack_hits = self.curriculum.search_english_science_items(
            q=tokens[0] if tokens else payload.question, limit=3
        ).items
        for sp in pack_hits[:2]:
            citations.append(
                RagCitationOut(
                    source_type="study_pack",
                    title=f"Unit {sp.unit_no}: {sp.term_en} {sp.ipa}",
                    detail=sp.meaning_vi,
                )
            )

        has_hits = bool(matched_terms or pack_hits)
        if not is_khtn_science_query(
            payload.question,
            has_curriculum_hits=has_hits,
            has_lesson_context=lesson_detail is not None,
        ):
            refusal = (
                "Câu hỏi nằm ngoài phạm vi môn Khoa học tự nhiên 6–9 (KNTT). "
                "Vui lòng hỏi về Hóa học, Vật lí, Sinh học, Khoa học Trái Đất hoặc IUPAC/SI."
            )
            return TutorAskOut(
                on_topic=False,
                provider="grounded_rag",
                answer_vi=refusal,
                answer_en=(
                    "This question is outside the Grades 6–9 Natural Sciences curriculum. "
                    "Please ask about Chemistry, Physics, Biology, Earth Science, or IUPAC/SI."
                ),
                citations=[],
                lint_report=LintCheckOut(passed=True, error_count=0, warning_count=0),
                quota_remaining=ent.ai_remaining,
                refusal_reason=refusal,
            )

        # Consume 1 AI quota unit before synthesis
        _, remaining = self.identity.consume_ai_quota(user, units=1)

        context_lines = [f"- [{c.source_type}] {c.title}: {c.detail}" for c in citations]
        provider: str = "grounded_rag"
        answer_vi = ""
        answer_en = ""

        if get_settings().gemini_api_key.strip():
            system_prompt = (
                "You are SciLingo AI Tutor for Vietnamese middle-school Natural Sciences "
                "(Grades 6-9, KNTT). Follow Circular 32/2018 IUPAC English nomenclature for "
                "elements and all chemical compounds, SI units, and DNA/RNA. Use ONLY the "
                "verified curriculum context. Reply strictly as JSON: 'answer_vi', 'answer_en'."
            )
            user_prompt = (
                f"Grade: {payload.grade}\n"
                f"Question: {payload.question}\n"
                f"Verified Curriculum Context:\n" + "\n".join(context_lines)
            )
            raw_ai = call_gemini_text(system_prompt, user_prompt)
            if raw_ai:
                try:
                    cleaned_json = (
                        raw_ai.strip().removeprefix("```json").removesuffix("```").strip()
                    )
                    parsed = json.loads(cleaned_json)
                    answer_vi = str(parsed.get("answer_vi", "")).strip()
                    answer_en = str(parsed.get("answer_en", "")).strip()
                    if answer_vi and answer_en:
                        provider = "gemini"
                except (ValueError, TypeError):
                    answer_vi = ""
                    answer_en = ""

        if provider != "gemini":
            answer_vi, answer_en = self._build_grounded_tutor_answer(
                grade=payload.grade,
                lesson_detail=lesson_detail,
                matched_terms=matched_terms,
                pack_hits=pack_hits,
            )

        # Mandatory Unit 1 IUPAC/SI linter pass on generated output
        lint_report = self._run_output_lint(f"{answer_vi}\n{answer_en}")
        if not lint_report.passed:
            answer_vi = build_corrected_preview(answer_vi, lint_report.issues)
            answer_en = build_corrected_preview(answer_en, lint_report.issues)
            lint_report = self._run_output_lint(f"{answer_vi}\n{answer_en}")

        return TutorAskOut(
            on_topic=True,
            provider=provider,  # type: ignore[arg-type]
            answer_vi=answer_vi,
            answer_en=answer_en,
            citations=citations,
            lint_report=lint_report,
            quota_remaining=remaining,
        )

    @staticmethod
    def _build_grounded_tutor_answer(
        *,
        grade: int,
        lesson_detail: Any,
        matched_terms: list[Any],
        pack_hits: list[Any],
    ) -> tuple[str, str]:
        vi_parts: list[str] = []
        en_parts: list[str] = []

        if lesson_detail is not None:
            vi_parts.append(
                f"Theo **KHTN {lesson_detail.grade} · Bài {lesson_detail.lesson_no}: "
                f"{lesson_detail.title_vi}** ({lesson_detail.title_en}):"
            )
            en_parts.append(
                f"According to **Natural Sciences Grade {lesson_detail.grade}, "
                f"Lesson {lesson_detail.lesson_no}: {lesson_detail.title_en}**:"
            )
        else:
            vi_parts.append(f"Tổng hợp kiến thức chuẩn **KHTN {grade} KNTT (IUPAC/SI)**:")
            en_parts.append(f"Grounded summary from **Natural Sciences Grade {grade} (IUPAC/SI)**:")

        if matched_terms:
            vi_bullets = [
                f"- **{t.term_en}** ({t.ipa or 'chuẩn IUPAC/SI'}): {t.term_vi}."
                + (f" *Lưu ý:* {t.iupac_note}" if t.iupac_note else "")
                for t in matched_terms[:3]
            ]
            en_bullets = [
                f"- **{t.term_en}** ({t.ipa or 'IUPAC/SI'}): {t.term_vi}."
                for t in matched_terms[:3]
            ]
            vi_parts.extend(vi_bullets)
            en_parts.extend(en_bullets)

        if pack_hits:
            sp = pack_hits[0]
            vi_parts.append(
                f"Thuật ngữ mở rộng (U{sp.unit_no}): **{sp.term_en}** {sp.ipa} = {sp.meaning_vi}."
            )
            en_parts.append(
                f"Reference vocabulary (Unit {sp.unit_no}): **{sp.term_en}** {sp.ipa} "
                f"({sp.meaning_vi})."
            )

        if not matched_terms and not pack_hits:
            vi_parts.append(
                "Hãy sử dụng danh pháp hóa học tiếng Anh chuẩn IUPAC (acid, base, oxide, salt), "
                "đơn vị SI (Pa, N·m, kg/m³) và ký hiệu sinh học DNA/RNA khi trình bày bài học."
            )
            en_parts.append(
                "Use standard IUPAC English terminology (acid, base, oxide, salt), SI units "
                "(Pa, N·m, kg/m³), and DNA/RNA notation for this topic."
            )

        return "\n".join(vi_parts), "\n".join(en_parts)

    def generate_clil_questions(
        self, user: User, payload: ClilGenerateRequest
    ) -> ClilGenerateOut:
        lesson = self.curriculum.get_lesson_detail(payload.lesson_no, grade=payload.grade)
        all_terms = self.curriculum.search_terms(grade=payload.grade, limit=200).items
        _, remaining = self.identity.consume_ai_quota(user, units=1)

        languages: list[str]
        if payload.language == "bilingual":
            languages = ["en" if i % 2 == 0 else "vi" for i in range(payload.count)]
        else:
            languages = [payload.language for _ in range(payload.count)]

        en_needed = sum(1 for lang in languages if lang == "en")
        vi_needed = sum(1 for lang in languages if lang == "vi")

        en_pool = synthesize_questions_from_curriculum(
            lessons=[lesson],
            all_terms=all_terms,
            language="en",
            needed=max(0, en_needed),
            seed=payload.grade * 100 + payload.lesson_no,
        )
        vi_pool = synthesize_questions_from_curriculum(
            lessons=[lesson],
            all_terms=all_terms,
            language="vi",
            needed=max(0, vi_needed),
            seed=payload.grade * 100 + payload.lesson_no + 7,
        )

        # Fallback if a practical lesson has fewer linked terms: include grade terms
        combined = [*en_pool, *vi_pool]
        if len(combined) < payload.count:
            extra_needed = payload.count - len(combined)
            fallback_qs = synthesize_questions_from_curriculum(
                lessons=[lesson],
                all_terms=all_terms,
                language="en" if payload.language != "vi" else "vi",
                needed=extra_needed,
            )
            combined.extend(fallback_qs)

        out_questions: list[GeneratedClilQuestionOut] = []
        for q_dict in combined[: payload.count]:
            prompt_text = str(q_dict["prompt_text"])
            if payload.focus_topic and payload.focus_topic.strip():
                prompt_text = f"[{payload.focus_topic.strip()}] {prompt_text}"
            options = [str(opt) for opt in q_dict["options"]]
            correct_answer = str(q_dict["correct_answer"])
            correct_idx = options.index(correct_answer) if correct_answer in options else 0
            explanation_vi = str(q_dict["explanation_vi"])
            tip = (
                f"Classroom English (TT94): 'Look at Lesson {lesson.lesson_no}: "
                f"{lesson.title_en} and focus on key IUPAC/SI keywords.'"
            )

            full_text = "\n".join([prompt_text, *options, explanation_vi, tip])
            lint_report = self._run_output_lint(full_text, discipline=lesson.discipline)
            if not lint_report.passed:
                prompt_text = build_corrected_preview(prompt_text, lint_report.issues)
                options = [build_corrected_preview(o, lint_report.issues) for o in options]
                explanation_vi = build_corrected_preview(explanation_vi, lint_report.issues)
                lint_report = self._run_output_lint(
                    "\n".join([prompt_text, *options, explanation_vi, tip]),
                    discipline=lesson.discipline,
                )

            out_questions.append(
                GeneratedClilQuestionOut(
                    grade=payload.grade,
                    lesson_no=payload.lesson_no,
                    language=q_dict["language"],
                    cognitive_level=payload.cognitive_level,
                    discipline=q_dict["discipline"],
                    prompt_text=prompt_text,
                    options=options,
                    correct_index=correct_idx,
                    explanation_vi=explanation_vi,
                    classroom_english_tip=tip,
                    linter_verified=lint_report.passed,
                    lint_report=lint_report,
                )
            )

        return ClilGenerateOut(
            grade=payload.grade,
            lesson_no=payload.lesson_no,
            lesson_title_vi=lesson.title_vi,
            lesson_title_en=lesson.title_en,
            provider="grounded_rag",
            questions=out_questions,
            quota_remaining=remaining,
        )

    def evaluate_pronunciation(self, payload: PronunciationEvalRequest) -> PronunciationEvalOut:
        resolved_ipa = payload.ipa
        if not resolved_ipa:
            matches = self.curriculum.search_terms(q=payload.target_term, limit=3).items
            for m in matches:
                if m.term_en.lower() == payload.target_term.strip().lower() and m.ipa:
                    resolved_ipa = m.ipa
                    break
            if not resolved_ipa:
                pack_matches = self.curriculum.search_english_science_items(
                    q=payload.target_term, limit=3
                ).items
                for sp in pack_matches:
                    if sp.term_en.lower() == payload.target_term.strip().lower() and sp.ipa:
                        resolved_ipa = sp.ipa
                        break

        result = evaluate_pronunciation(
            target_term=payload.target_term.strip(),
            spoken_transcript=payload.spoken_transcript.strip(),
            ipa=resolved_ipa,
        )
        return PronunciationEvalOut(**result)

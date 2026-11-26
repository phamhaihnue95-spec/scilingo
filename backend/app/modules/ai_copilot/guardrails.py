"""Deterministic guardrails, compound IUPAC rules, Gemini wrapper & speech scorer."""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from difflib import SequenceMatcher
from typing import Any

from app.core.config import get_settings
from app.modules.curriculum.schemas import LintIssueOut

INJECTION_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"ignore\s+(all\s+)?(previous|prior)\s+instructions?", re.IGNORECASE),
    re.compile(r"system\s+prompt", re.IGNORECASE),
    re.compile(r"\bjailbreak\b", re.IGNORECASE),
    re.compile(r"pretend\s+you\s+are", re.IGNORECASE),
    re.compile(r"reveal\s+(your\s+)?(secret|password|prompt|api\s*key)", re.IGNORECASE),
    re.compile(r"bỏ\s+qua\s+(mọi\s+|tất\s+cả\s+)?hướng\s+dẫn", re.IGNORECASE),
    re.compile(r"tiết\s+lộ\s+(mật\s+khẩu|system|prompt)", re.IGNORECASE),
    re.compile(r"\bbypass\b", re.IGNORECASE),
)

OFF_TOPIC_PATTERNS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bworld\s+cup\b", re.IGNORECASE),
    re.compile(r"\bbóng\s+đá\b", re.IGNORECASE),
    re.compile(r"\bchứng\s+khoán\b", re.IGNORECASE),
    re.compile(r"\bbitcoin\b|\bcrypto\b", re.IGNORECASE),
    re.compile(r"\bxổ\s+số\b|\blô\s+đề\b", re.IGNORECASE),
    re.compile(r"\bbầu\s+cử\b|\bchính\s+trị\b", re.IGNORECASE),
    re.compile(r"\btán\s+gái\b|\bngười\s+yêu\b", re.IGNORECASE),
)

SCIENCE_KEYWORDS: tuple[str, ...] = (
    "acid",
    "base",
    "oxide",
    "salt",
    "iupac",
    "dna",
    "rna",
    "cell",
    "atom",
    "molecule",
    "element",
    "compound",
    "reaction",
    "chemistry",
    "physics",
    "biology",
    "astronomy",
    "science",
    "force",
    "pressure",
    "energy",
    "density",
    "mass",
    "volume",
    "current",
    "voltage",
    "circuit",
    "resistance",
    "ohm",
    "pascal",
    "newton",
    "joule",
    "watt",
    "lens",
    "light",
    "sound",
    "enzyme",
    "gene",
    "khtn",
    "clil",
    "ipa",
    "nguyên tử",
    "phân tử",
    "nguyên tố",
    "hợp chất",
    "đơn chất",
    "hóa học",
    "vật lí",
    "vật lý",
    "sinh học",
    "khoa học",
    "phản ứng",
    "phương trình",
    "dung dịch",
    "nồng độ",
    "khối lượng",
    "thể tích",
    "áp suất",
    "lực",
    "công",
    "năng lượng",
    "dòng điện",
    "hiệu điện thế",
    "điện trở",
    "mạch điện",
    "tế bào",
    "sinh thái",
    "thấu kính",
    "âm thanh",
    "ánh sáng",
    "danh pháp",
    "đơn vị si",
    "axit",
    "bazơ",
    "oxit",
    "muối",
    "mol",
)

STUDY_CONTEXT_HINTS: tuple[str, ...] = (
    "tóm tắt",
    "giải thích",
    "ví dụ",
    "bài này",
    "bài học",
    "thuật ngữ",
    "khái niệm",
    "summary",
    "explain",
    "example",
    "definition",
)

COMPOUND_EXCEPTION_PATTERNS: tuple[tuple[str, str, str], ...] = (
    (
        r"\bsắt\s*\(\s*ii\s*\)",
        "iron(II)",
        "Ở dạng hợp chất hóa học, không viết 'sắt(II)' — dùng danh pháp IUPAC 'iron(II)'.",
    ),
    (
        r"\bsắt\s*\(\s*iii\s*\)",
        "iron(III)",
        (
            "Ở dạng hợp chất hóa học, không viết 'sắt(III)' — dùng 'iron(III)' "
            "(vd: iron(III) sulfate)."
        ),
    ),
    (
        r"\bsunfat\b",
        "sulfate",
        "Dùng danh pháp gốc sulfate chuẩn IUPAC thay cho phiên âm cũ 'sunfat'.",
    ),
    (
        r"\bđồng\s*\(\s*ii\s*\)",
        "copper(II)",
        "Ở dạng hợp chất hóa học, dùng 'copper(II)' thay cho 'đồng(II)'.",
    ),
    (
        r"\bnhôm\s+oxit\b",
        "aluminium oxide",
        "Dùng 'aluminium oxide' (Al₂O₃) chuẩn IUPAC thay cho 'nhôm oxit'.",
    ),
    (
        r"\bkẽm\s+clorua\b",
        "zinc chloride",
        "Dùng 'zinc chloride' (ZnCl₂) chuẩn IUPAC thay cho 'kẽm clorua'.",
    ),
    (
        r"\bnatri\s+hi[đd]roxit\b",
        "sodium hydroxide",
        "Dùng 'sodium hydroxide' (NaOH) chuẩn IUPAC thay cho 'natri hiđroxit'.",
    ),
    (
        r"\bcanxi\s+cacbonat\b",
        "calcium carbonate",
        "Dùng 'calcium carbonate' (CaCO₃) chuẩn IUPAC thay cho 'canxi cacbonat'.",
    ),
    (
        r"\blưu\s+huỳnh\s+[đd]ioxit\b",
        "sulfur dioxide",
        "Dùng 'sulfur dioxide' (SO₂) chuẩn IUPAC thay cho 'lưu huỳnh đioxit'.",
    ),
)


def detect_prompt_injection(text: str) -> str | None:
    """Return matched reason if text attempts prompt injection or policy bypass."""
    for pat in INJECTION_PATTERNS:
        if pat.search(text):
            return (
                "Phát hiện yêu cầu vượt phạm vi bảo mật/hệ thống. "
                "Trợ lý chỉ hỗ trợ kiến thức KHTN 6–9 Kết nối tri thức."
            )
    return None


def is_khtn_science_query(
    text: str,
    *,
    has_curriculum_hits: bool,
    has_lesson_context: bool,
) -> bool:
    """Ensure student/teacher queries stay strictly within Natural Sciences 6-9."""
    lowered = text.lower()
    has_science_kw = any(kw in lowered for kw in SCIENCE_KEYWORDS)

    if any(pat.search(lowered) for pat in OFF_TOPIC_PATTERNS) and not has_science_kw:
        return False

    if has_science_kw or has_curriculum_hits:
        return True

    if has_lesson_context and any(hint in lowered for hint in STUDY_CONTEXT_HINTS):
        return True

    return False


def find_compound_exception_issues(
    text: str, existing_issues: list[LintIssueOut]
) -> list[LintIssueOut]:
    """Catch Vietnamese compounds of 13 exception elements without flagging elemental nouns."""
    seen = {iss.matched_text.lower() for iss in existing_issues}
    extra: list[LintIssueOut] = []
    for pattern, recommended, reason in COMPOUND_EXCEPTION_PATTERNS:
        for match in re.finditer(pattern, text, re.IGNORECASE):
            matched = match.group(0)
            if matched.lower() in seen:
                continue
            seen.add(matched.lower())
            extra.append(
                LintIssueOut(
                    matched_text=matched,
                    recommended=recommended,
                    discipline="chemistry",
                    severity="error",
                    reason=reason,
                )
            )
    return extra


def build_corrected_preview(text: str, issues: list[LintIssueOut]) -> str:
    """Produce a quick preview replacing flagged non-IUPAC terms with recommended equivalents."""
    updated = text
    for issue in sorted(issues, key=lambda item: len(item.matched_text), reverse=True):
        pattern = re.compile(re.escape(issue.matched_text), re.IGNORECASE)
        updated = pattern.sub(issue.recommended, updated)
    return updated


def call_gemini_text(system_prompt: str, user_prompt: str) -> str | None:
    """Call Google Gemini REST API when GEMINI_API_KEY is configured; fallback cleanly to None."""
    settings = get_settings()
    api_key = settings.gemini_api_key.strip()
    if not api_key:
        return None

    model = settings.gemini_model.strip() or "gemini-2.5-flash"
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}"
        f":generateContent?key={api_key}"
    )
    body = {
        "system_instruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 900},
    }
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            payload: dict[str, Any] = json.loads(resp.read().decode("utf-8"))
        candidates = payload.get("candidates") or []
        if not candidates:
            return None
        parts = candidates[0].get("content", {}).get("parts") or []
        text = "".join(str(p.get("text", "")) for p in parts).strip()
        return text or None
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
        return None


def _normalize_speech(text: str) -> str:
    cleaned = re.sub(r"[^a-zA-Z0-9\s]", " ", text.lower())
    return re.sub(r"\s+", " ", cleaned).strip()


def evaluate_pronunciation(
    *,
    target_term: str,
    spoken_transcript: str,
    ipa: str | None = None,
) -> dict[str, Any]:
    """Deterministically score spoken transcript against target science term with IPA coaching."""
    norm_target = _normalize_speech(target_term)
    norm_spoken = _normalize_speech(spoken_transcript)

    if not norm_target or not norm_spoken:
        return {
            "target_term": target_term,
            "spoken_transcript": spoken_transcript,
            "score": 0,
            "grade_band": "needs_practice",
            "ipa": ipa,
            "feedback_vi": "Chưa nhận diện được âm thanh rõ ràng. Em hãy đọc lại gần micro hơn.",
            "feedback_en": "No clear speech detected. Please speak closer to the microphone.",
            "tips": ["Đọc chậm từng âm tiết và giữ micro ổn định."],
        }

    char_ratio = SequenceMatcher(None, norm_target, norm_spoken).ratio()
    target_words = norm_target.split()
    spoken_words = norm_spoken.split()
    word_matches = sum(1 for w in target_words if w in spoken_words)
    word_ratio = word_matches / len(target_words) if target_words else 0.0

    score = int(round((0.65 * char_ratio + 0.35 * word_ratio) * 100))
    if norm_target == norm_spoken:
        score = 100
    score = max(0, min(100, score))

    tips: list[str] = []
    lowered_target = target_term.lower()
    if "acid" in lowered_target:
        tips.append("Từ 'acid' nhấn trọng âm âm tiết đầu: /ˈæs.ɪd/ (không đọc là 'a-xít').")
    if "oxide" in lowered_target or "chloride" in lowered_target or "hydroxide" in lowered_target:
        tips.append("Đuôi '-ide' đọc là /aɪd/ (ví dụ: chloride /ˈklɔː.raɪd/).")
    if "sulfate" in lowered_target or "nitrate" in lowered_target or "carbonate" in lowered_target:
        tips.append("Đuôi '-ate' đọc là /eɪt/ (ví dụ: sulfate /ˈsʌl.feɪt/).")
    if "ch" in lowered_target:
        tips.append("Âm 'ch' trong hóa chất/chloride thường đọc /k/ thay vì /tʃ/.")
    if ipa:
        tips.append(f"Đối chiếu phiên âm chuẩn: {ipa}.")

    missing_words = [w for w in target_words if w not in spoken_words]
    if missing_words:
        tips.insert(0, f"Cần phát âm rõ thêm từ: {', '.join(missing_words)}.")

    if score >= 85:
        band = "excellent"
        fb_vi = "Phát âm rất chuẩn xác, rõ âm tiết khoa học!"
        fb_en = "Excellent pronunciation! Clear articulation of scientific terminology."
    elif score >= 60:
        band = "good"
        fb_vi = "Khá tốt! Chú ý trọng âm và âm cuối để đạt chuẩn quốc tế."
        fb_en = "Good attempt! Refine word stress and final consonants."
    else:
        band = "needs_practice"
        fb_vi = "Cần luyện thêm. Hãy nghe mẫu IPA rồi đọc chậm từng từ."
        fb_en = "Needs more practice. Listen to the IPA model and repeat slowly."

    if not tips:
        tips.append("Nghe lại audio mẫu 2 lần và nhấn đúng trọng âm chính.")

    return {
        "target_term": target_term,
        "spoken_transcript": spoken_transcript,
        "score": score,
        "grade_band": band,
        "ipa": ipa,
        "feedback_vi": fb_vi,
        "feedback_en": fb_en,
        "tips": tips[:4],
    }

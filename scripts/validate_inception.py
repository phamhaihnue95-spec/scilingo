"""Gate 1 automated verification for Bolt 0 (Inception) artifacts and seed datasets."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

REQUIRED_DOCS = [
    "README.md",
    "AGENTS.md",
    "docker-compose.yml",
    ".env.example",
    "docs/inception/01-intent-and-requirements.md",
    "docs/inception/02-domain-model.md",
    "docs/inception/03-pedagogical-guardrails.md",
    "docs/inception/04-architecture-and-api.md",
    "docs/inception/05-units-and-bolt-plan.md",
    "data/khtn8_kntt_curriculum.json",
    "data/terminology_rules.json",
]

VALID_DISCIPLINES = {"general_lab", "chemistry", "physics", "biology"}


def validate_required_files() -> None:
    missing = [rel for rel in REQUIRED_DOCS if not (ROOT / rel).is_file()]
    if missing:
        raise AssertionError(f"Missing required Bolt 0 files: {missing}")


def validate_curriculum() -> tuple[int, int]:
    curriculum_path = ROOT / "data" / "khtn8_kntt_curriculum.json"
    data = json.loads(curriculum_path.read_text(encoding="utf-8"))

    meta = data["metadata"]
    assert meta["grade"] == 8, "Grade must be 8"
    assert meta["total_lessons"] == 47, "Total lessons must be 47"

    chapters = data["chapters"]
    assert len(chapters) == 9, f"Expected 9 chapter blocks (0..8), got {len(chapters)}"

    lesson_nos: list[int] = []
    term_count = 0

    for ch in chapters:
        assert ch["discipline"] in VALID_DISCIPLINES, f"Invalid chapter discipline: {ch['discipline']}"
        for lesson in ch["lessons"]:
            lno = lesson["lesson_no"]
            lesson_nos.append(lno)
            assert lesson["title_vi"].strip() and lesson["title_en"].strip(), f"Empty title on lesson {lno}"
            assert lesson["discipline"] in VALID_DISCIPLINES, f"Invalid discipline on lesson {lno}"
            for link in lesson["integration_links"]:
                target = link["target_lesson_no"]
                assert 1 <= target <= 47 and target != lno, f"Invalid integration link {lno} -> {target}"
            assert len(lesson["glossary_seed"]) >= 1, f"Lesson {lno} must have at least 1 glossary seed term"
            for term in lesson["glossary_seed"]:
                assert term["en"].strip() and term["vi"].strip(), f"Invalid term on lesson {lno}"
                term_count += 1

    expected = list(range(1, 48))
    if lesson_nos != expected:
        raise AssertionError(f"Lessons must be sequential 1..47, got {lesson_nos}")

    return len(lesson_nos), term_count


def validate_terminology_rules() -> tuple[int, int]:
    rules_path = ROOT / "data" / "terminology_rules.json"
    rules = json.loads(rules_path.read_text(encoding="utf-8"))

    exceptions = rules["exception_13_elements"]
    assert len(exceptions) == 13, f"Expected exactly 13 exception elements, got {len(exceptions)}"

    symbols = {item["symbol"] for item in exceptions}
    assert len(symbols) == 13, "Duplicate element symbols in exception_13_elements"

    deprecated = rules["deprecated_terms_to_flag"]
    assert len(deprecated) >= 10, "Expected deprecated_terms_to_flag rules"
    for item in deprecated:
        re.compile(item["pattern"])

    presets = rules["exam_compliance_presets"]
    assert presets["tt94_level_initial"]["min_english_points_ratio"] == 0.10
    assert presets["tt94_level_advanced"]["min_english_points_ratio"] == 0.50

    return len(exceptions), len(deprecated)


def main() -> int:
    validate_required_files()
    lesson_count, term_count = validate_curriculum()
    exception_count, rule_count = validate_terminology_rules()
    print(
        "PASS Gate 1 (Bolt 0 Inception): "
        f"{len(REQUIRED_DOCS)} files verified | "
        f"{lesson_count} KNTT Grade 8 lessons | "
        f"{term_count} glossary seed terms | "
        f"{exception_count} IUPAC exception elements | "
        f"{rule_count} linter rules."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FAIL Gate 1: {exc}", file=sys.stderr)
        raise SystemExit(1)

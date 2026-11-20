"""Gate 1 automated verification for Bolt 0+ artifacts and Grades 6–9 KNTT seed datasets."""

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
    "data/khtn6_kntt_curriculum.json",
    "data/khtn7_kntt_curriculum.json",
    "data/khtn8_kntt_curriculum.json",
    "data/khtn9_kntt_curriculum.json",
    "data/terminology_rules.json",
]

GRADE_SPECS: list[tuple[int, str, int, int]] = [
    (6, "khtn6_kntt_curriculum.json", 10, 55),
    (7, "khtn7_kntt_curriculum.json", 11, 43),
    (8, "khtn8_kntt_curriculum.json", 9, 47),
    (9, "khtn9_kntt_curriculum.json", 13, 45),
]

VALID_DISCIPLINES = {"general_lab", "chemistry", "physics", "biology"}


def validate_required_files() -> None:
    missing = [rel for rel in REQUIRED_DOCS if not (ROOT / rel).is_file()]
    if missing:
        raise AssertionError(f"Missing required files: {missing}")


def validate_all_curricula(deprecated_patterns: list[re.Pattern[str]]) -> tuple[int, int]:
    total_lessons = 0
    total_terms = 0
    expected_counts = {g: n_lessons for g, _, _, n_lessons in GRADE_SPECS}

    for grade, filename, expected_chapters, expected_lessons in GRADE_SPECS:
        curriculum_path = ROOT / "data" / filename
        data = json.loads(curriculum_path.read_text(encoding="utf-8"))

        meta = data["metadata"]
        assert meta["grade"] == grade, f"{filename}: grade must be {grade}"
        assert meta["total_lessons"] == expected_lessons, (
            f"{filename}: total_lessons must be {expected_lessons}"
        )

        chapters = data["chapters"]
        assert len(chapters) == expected_chapters, (
            f"{filename}: expected {expected_chapters} chapter blocks, got {len(chapters)}"
        )

        lesson_nos: list[int] = []
        for ch in chapters:
            assert ch["discipline"] in VALID_DISCIPLINES, (
                f"{filename}: invalid chapter discipline {ch['discipline']}"
            )
            for lesson in ch["lessons"]:
                lno = lesson["lesson_no"]
                lesson_nos.append(lno)
                assert lesson["title_vi"].strip() and lesson["title_en"].strip(), (
                    f"{filename}: empty title on lesson {lno}"
                )
                assert lesson["discipline"] in VALID_DISCIPLINES, (
                    f"{filename}: invalid discipline on lesson {lno}"
                )
                for link in lesson["integration_links"]:
                    target = link["target_lesson_no"]
                    target_grade = int(link.get("target_grade", grade))
                    max_target = expected_counts[target_grade]
                    assert 1 <= target <= max_target and not (
                        target_grade == grade and target == lno
                    ), f"{filename}: invalid integration link {grade}:{lno} -> {target_grade}:{target}"
                assert len(lesson["glossary_seed"]) >= 1, (
                    f"{filename}: lesson {lno} must have at least 1 glossary seed term"
                )
                for term in lesson["glossary_seed"]:
                    en_val = term["en"].strip()
                    vi_val = term["vi"].strip()
                    assert en_val and vi_val, f"{filename}: invalid term on lesson {lno}"
                    for pat in deprecated_patterns:
                        assert not pat.search(en_val), (
                            f"{filename} L{lno}: deprecated pattern in term_en '{en_val}'"
                        )
                    total_terms += 1

        expected = list(range(1, expected_lessons + 1))
        if lesson_nos != expected:
            raise AssertionError(
                f"{filename}: lessons must be sequential 1..{expected_lessons}, got {lesson_nos}"
            )
        total_lessons += len(lesson_nos)

    return total_lessons, total_terms


def validate_terminology_rules() -> tuple[int, int, list[re.Pattern[str]]]:
    rules_path = ROOT / "data" / "terminology_rules.json"
    rules = json.loads(rules_path.read_text(encoding="utf-8"))

    exceptions = rules["exception_13_elements"]
    assert len(exceptions) == 13, f"Expected exactly 13 exception elements, got {len(exceptions)}"

    symbols = {item["symbol"] for item in exceptions}
    assert len(symbols) == 13, "Duplicate element symbols in exception_13_elements"

    deprecated = rules["deprecated_terms_to_flag"]
    assert len(deprecated) >= 18, "Expected >= 18 deprecated_terms_to_flag rules across THCS"
    patterns = [re.compile(item["pattern"], re.IGNORECASE) for item in deprecated]

    presets = rules["exam_compliance_presets"]
    assert presets["tt94_level_initial"]["min_english_points_ratio"] == 0.10
    assert presets["tt94_level_advanced"]["min_english_points_ratio"] == 0.50

    return len(exceptions), len(deprecated), patterns


def main() -> int:
    validate_required_files()
    exception_count, rule_count, patterns = validate_terminology_rules()
    lesson_count, term_count = validate_all_curricula(patterns)
    print(
        "PASS Gate 1 (Multi-Grade KHTN 6-9): "
        f"{len(REQUIRED_DOCS)} files verified | "
        f"4 grades · {lesson_count} KNTT lessons | "
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

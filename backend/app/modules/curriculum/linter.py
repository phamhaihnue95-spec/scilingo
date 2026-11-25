"""Deterministic IUPAC/SI/Biology terminology linter grounded in data/terminology_rules.json."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any


@lru_cache
def _load_rules_dict(rules_path: str) -> dict[str, Any]:
    return json.loads(Path(rules_path).read_text(encoding="utf-8"))


def detect_13_exception_element(term_en: str, *, rules_path: Path) -> bool:
    """Return True if term_en mentions one of the 13 TT32 exception element names."""
    rules = _load_rules_dict(str(rules_path))
    exception_names = {item["iupac_en"].lower() for item in rules["exception_13_elements"]}
    tokens = {tok.lower() for tok in re.split(r"[^a-zA-Z]+", term_en) if tok}
    return bool(tokens & exception_names)


def lint_text(
    text: str,
    *,
    rules_path: Path,
    discipline: str | None = None,
) -> dict[str, Any]:
    """Validate text against 20 deprecated-term rules and 13 TT32 exception elements."""
    rules = _load_rules_dict(str(rules_path))
    cleaned = text.strip()
    if not cleaned:
        return {
            "passed": True,
            "error_count": 0,
            "warning_count": 0,
            "issues": [],
            "exception_notes": [],
        }

    issues: list[dict[str, Any]] = []
    seen_matches: set[tuple[str, str]] = set()

    for rule in rules["deprecated_terms_to_flag"]:
        pattern_str = str(rule["pattern"])
        # Preserve case sensitivity for uppercase abbreviations like ADN/ARN.
        flags = 0 if pattern_str in (r"\bADN\b", r"\bARN\b") else re.IGNORECASE
        regex = re.compile(pattern_str, flags)
        for match in regex.finditer(cleaned):
            matched_text = match.group(0)
            key = (pattern_str, matched_text.lower())
            if key in seen_matches:
                continue
            seen_matches.add(key)
            issues.append(
                {
                    "matched_text": matched_text,
                    "recommended": rule["recommended"],
                    "discipline": rule["discipline"],
                    "severity": rule["severity"],
                    "reason": rule["reason"],
                }
            )

    exception_notes: list[str] = []
    for item in rules["exception_13_elements"]:
        vi_name = str(item["vi_elemental"])
        if re.search(rf"\b{re.escape(vi_name)}\b", cleaned, re.IGNORECASE):
            exception_notes.append(
                f"Ngoại lệ 13 nguyên tố: '{vi_name}' ({item['symbol']}) được phép dùng tiếng Việt "
                f"ở dạng đơn chất/vật thể đời sống; trong hợp chất bắt buộc dùng IUPAC tiếng Anh "
                f"(vd: {item['compound_example_iupac']})."
            )

    error_count = sum(1 for item in issues if item["severity"] == "error")
    warning_count = sum(1 for item in issues if item["severity"] != "error")
    return {
        "passed": error_count == 0,
        "error_count": error_count,
        "warning_count": warning_count,
        "issues": issues,
        "exception_notes": exception_notes,
    }

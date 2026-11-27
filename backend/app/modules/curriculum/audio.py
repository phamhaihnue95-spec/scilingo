"""Cached English pronunciation MP3 helper for Android/mobile compatibility."""

from __future__ import annotations

import re
import urllib.error
import urllib.request
from functools import lru_cache
from urllib.parse import quote_plus


def sanitize_pronunciation_text(raw: str) -> str:
    """Strip parenthetical Vietnamese/hint annotations and normalize whitespace."""
    cleaned = re.sub(r"\s*\(.*?\)\s*", " ", raw)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:120]


@lru_cache(maxsize=1024)
def fetch_pronunciation_mp3(cleaned_text: str) -> bytes:
    """Fetch English TTS audio MP3 bytes and cache in memory across requests."""
    if not cleaned_text:
        raise ValueError("Empty pronunciation text")
    url = (
        "https://translate.google.com/translate_tts"
        f"?ie=UTF-8&client=tw-ob&tl=en&q={quote_plus(cleaned_text)}"
    )
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            )
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read()
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise RuntimeError("TTS upstream unreachable") from exc

    if not data or len(data) < 64:
        raise RuntimeError("TTS upstream returned invalid audio payload")
    return data

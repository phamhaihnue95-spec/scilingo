"""Modified SM-2 spaced-repetition scheduler and streak/badge helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta


@dataclass(frozen=True)
class SM2Result:
    """Updated scheduling parameters after one flashcard review."""

    ease_factor: float
    interval_days: int
    repetitions: int
    next_review_at: datetime


def compute_sm2(
    *,
    quality: int,
    ease_factor: float,
    interval_days: int,
    repetitions: int,
    now: datetime | None = None,
) -> SM2Result:
    """Calculate next SM-2 interval and ease factor for quality in [0..5]."""
    ref_now = now or datetime.now(UTC)

    if quality < 3:
        return SM2Result(
            ease_factor=max(1.3, ease_factor - 0.2),
            interval_days=0,
            repetitions=0,
            next_review_at=ref_now + timedelta(minutes=10),
        )

    if repetitions == 0:
        next_interval = 1
    elif repetitions == 1:
        next_interval = 6
    else:
        next_interval = max(1, round(interval_days * ease_factor))

    next_ease = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    next_ease = round(max(1.3, next_ease), 4)

    return SM2Result(
        ease_factor=next_ease,
        interval_days=next_interval,
        repetitions=repetitions + 1,
        next_review_at=ref_now + timedelta(days=next_interval),
    )


def update_streak(
    *,
    last_study_date: date | None,
    current_streak: int,
    longest_streak: int,
    today: date | None = None,
) -> tuple[int, int, date]:
    """Advance or reset daily study streak based on calendar dates."""
    ref_today = today or datetime.now(UTC).date()
    if last_study_date == ref_today:
        new_streak = max(1, current_streak)
    elif last_study_date == ref_today - timedelta(days=1):
        new_streak = current_streak + 1
    else:
        new_streak = 1
    return new_streak, max(longest_streak, new_streak), ref_today


def evaluate_badges(
    *,
    existing_badges: list[str],
    current_streak: int,
    total_xp: int,
    discipline_xp: dict[str, int],
    passed_tt94_50: bool = False,
    extra_unlocked: list[str] | None = None,
) -> list[str]:
    """Return newly unlocked badge IDs based on current achievements."""
    candidates: list[str] = []
    if total_xp >= 10:
        candidates.append("First Spark")
    if current_streak >= 3:
        candidates.append("Streak 3 Ngày")
    if current_streak >= 7:
        candidates.append("Streak 7 Ngày")
    if discipline_xp.get("chemistry", 0) >= 50:
        candidates.append("Junior Chemist (IUPAC)")
    if discipline_xp.get("physics", 0) >= 50:
        candidates.append("Young Physicist (SI)")
    if discipline_xp.get("biology", 0) >= 50:
        candidates.append("Bio Explorer")
    if discipline_xp.get("general_lab", 0) >= 30:
        candidates.append("Lab Safety Pioneer")
    if passed_tt94_50:
        candidates.append("Sẵn sàng 50% Thông tư 94")
    if extra_unlocked:
        candidates.extend(extra_unlocked)

    existing_set = set(existing_badges)
    return list(dict.fromkeys(badge for badge in candidates if badge not in existing_set))


def compute_level(total_xp: int) -> int:
    """Compute student level (1-based, 100 XP per level)."""
    return max(1, (max(0, total_xp) // 100) + 1)


def evaluate_game_badges(
    *,
    game_type: str,
    correct_count: int,
    total_attempts: int,
    max_combo: int,
    study_pack_unit_no: int | None = None,
) -> list[str]:
    """Evaluate mini-game milestone badges and SciDex 16-Unit collectibles."""
    accuracy = min(1.0, correct_count / max(1, total_attempts))
    badges: list[str] = []

    if game_type == "lightning_match" and (correct_count >= 10 or max_combo >= 5):
        badges.append("Tia Chớp Nối Cặp")
    if game_type == "iupac_lab" and correct_count >= 8 and accuracy >= 0.75:
        badges.append("Hiệp Sĩ IUPAC")
    if game_type == "sequence_lab" and correct_count >= 5 and accuracy >= 0.75:
        badges.append("Bậc Thầy Hệ Thống")
    if max_combo >= 5:
        badges.append("Siêu Combo Khoa Học")
    if (
        study_pack_unit_no is not None
        and 1 <= study_pack_unit_no <= 16
        and (correct_count >= 6 or (total_attempts > 0 and accuracy >= 0.70))
    ):
        badges.append(f"SciDex: Unit {study_pack_unit_no}")

    return list(dict.fromkeys(badges))

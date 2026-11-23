"""Pure deterministic logic for SciPet (3 evolving KHTN companion species)."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, date, datetime

PET_SPECIES_META: dict[str, dict[str, str]] = {
    "owl": {
        "name_vi": "Cú Quang Học",
        "default_nickname": "Lumo",
        "affinity": "physics",
        "tagline_vi": "Thích Ánh sáng, Điện học & Vũ trụ SI",
    },
    "fox": {
        "name_vi": "Cáo Nguyên Tử",
        "default_nickname": "Atom",
        "affinity": "chemistry",
        "tagline_vi": "Đam mê phản ứng & danh pháp IUPAC",
    },
    "cat": {
        "name_vi": "Mèo Sinh Quyển",
        "default_nickname": "Neko",
        "affinity": "biology",
        "tagline_vi": "Khám phá Tế bào, DNA & Hệ sinh thái",
    },
}

EVOLUTION_STAGES: list[tuple[int, int, str, str, int | None]] = [
    # (stage_no, min_level, label_vi, label_en, next_evolution_level)
    (1, 1, "Trứng Năng Lượng", "Energy Egg", 2),
    (2, 2, "Bé Sơ Sinh", "Hatchling", 4),
    (3, 4, "Thực Tập Sinh Lab", "Lab Apprentice", 7),
    (4, 7, "Nhà Thám Hiểm KHTN", "Science Explorer", 10),
    (5, 10, "Giáo Sư Huyền Thoại", "Legendary Professor", None),
]


@dataclass(frozen=True)
class UnlockRule:
    item_id: str
    name_vi: str
    icon: str
    unlock_hint_vi: str
    predicate: Callable[[dict[str, int]], bool]


ACCESSORY_RULES: list[UnlockRule] = [
    UnlockRule(
        item_id="goggles",
        name_vi="Kính bảo hộ Lab",
        icon="goggles",
        unlock_hint_vi="Đạt Level 2 hoặc tích lũy ≥ 50 XP",
        predicate=lambda s: s["level"] >= 2 or s["total_xp"] >= 50,
    ),
    UnlockRule(
        item_id="test_tube",
        name_vi="Ống nghiệm IUPAC",
        icon="test_tube",
        unlock_hint_vi="Đạt ≥ 40 XP phân môn Hóa học",
        predicate=lambda s: s["chemistry_xp"] >= 40,
    ),
    UnlockRule(
        item_id="magnet",
        name_vi="Nam châm Vật lí",
        icon="magnet",
        unlock_hint_vi="Đạt ≥ 40 XP phân môn Vật lí",
        predicate=lambda s: s["physics_xp"] >= 40,
    ),
    UnlockRule(
        item_id="seedling",
        name_vi="Mầm cây Sinh học",
        icon="seedling",
        unlock_hint_vi="Đạt ≥ 40 XP phân môn Sinh học",
        predicate=lambda s: s["biology_xp"] >= 40,
    ),
    UnlockRule(
        item_id="fire",
        name_vi="Ngọn lửa Streak",
        icon="fire",
        unlock_hint_vi="Duy trì chuỗi học ≥ 3 ngày liên tiếp",
        predicate=lambda s: s["longest_streak"] >= 3,
    ),
    UnlockRule(
        item_id="graduation_cap",
        name_vi="Mũ Học giả CLIL",
        icon="graduation_cap",
        unlock_hint_vi="Đạt Level 4 (Thực Tập Sinh Lab)",
        predicate=lambda s: s["level"] >= 4,
    ),
    UnlockRule(
        item_id="dna",
        name_vi="Vòng xoắn DNA",
        icon="dna",
        unlock_hint_vi="Thuộc vững ≥ 3 thẻ SRS hoặc mở ≥ 1 huy hiệu SciDex",
        predicate=lambda s: s["cards_mastered"] >= 3 or s["scidex_count"] >= 1,
    ),
    UnlockRule(
        item_id="crown",
        name_vi="Vương miện Quán quân",
        icon="crown",
        unlock_hint_vi="Đạt Level 7 hoặc mở ≥ 3 huy hiệu SciDex",
        predicate=lambda s: s["level"] >= 7 or s["scidex_count"] >= 3,
    ),
]

HABITAT_RULES: list[UnlockRule] = [
    UnlockRule(
        item_id="lab",
        name_vi="Bàn Thí Nghiệm",
        icon="alembic",
        unlock_hint_vi="Mở khóa mặc định ngay từ đầu",
        predicate=lambda _s: True,
    ),
    UnlockRule(
        item_id="forest",
        name_vi="Rừng Sinh Quyển",
        icon="herb",
        unlock_hint_vi="Đạt Level 2 hoặc ≥ 20 XP Sinh học",
        predicate=lambda s: s["level"] >= 2 or s["biology_xp"] >= 20,
    ),
    UnlockRule(
        item_id="cosmos",
        name_vi="Quỹ Đạo Vũ Trụ",
        icon="ringed_planet",
        unlock_hint_vi="Đạt Level 3 hoặc ≥ 30 XP Vật lí",
        predicate=lambda s: s["level"] >= 3 or s["physics_xp"] >= 30,
    ),
    UnlockRule(
        item_id="atom",
        name_vi="Lõi Nguyên Tử",
        icon="atom",
        unlock_hint_vi="Đạt Level 5 hoặc mở ≥ 2 huy hiệu SciDex",
        predicate=lambda s: s["level"] >= 5 or s["scidex_count"] >= 2,
    ),
]


def compute_evolution_stage(level: int) -> tuple[int, str, str, int | None]:
    """Return (stage_no, label_vi, label_en, next_evolution_level)."""
    lvl = max(1, int(level))
    if lvl >= 10:
        return 5, "Giáo Sư Huyền Thoại", "Legendary Professor", None
    if lvl >= 7:
        return 4, "Nhà Thám Hiểm KHTN", "Science Explorer", 10
    if lvl >= 4:
        return 3, "Thực Tập Sinh Lab", "Lab Apprentice", 7
    if lvl >= 2:
        return 2, "Bé Sơ Sinh", "Hatchling", 4
    return 1, "Trứng Năng Lượng", "Energy Egg", 2


def build_unlock_stats(
    *,
    level: int,
    total_xp: int,
    longest_streak: int,
    cards_mastered: int,
    badges: list[str],
    discipline_xp: dict[str, int],
) -> dict[str, int]:
    """Build normalized integer metrics dictionary used by accessory & habitat rules."""
    scidex_count = sum(1 for b in badges if str(b).startswith("SciDex: Unit "))
    return {
        "level": max(1, int(level)),
        "total_xp": max(0, int(total_xp)),
        "longest_streak": max(0, int(longest_streak)),
        "cards_mastered": max(0, int(cards_mastered)),
        "scidex_count": scidex_count,
        "chemistry_xp": int(discipline_xp.get("chemistry", 0)),
        "physics_xp": int(discipline_xp.get("physics", 0)),
        "biology_xp": int(discipline_xp.get("biology", 0)),
    }


def evaluate_accessories(stats: dict[str, int]) -> tuple[list[str], list[dict[str, object]]]:
    """Return (unlocked_ids, catalog_dicts) for science accessories."""
    unlocked: list[str] = []
    catalog: list[dict[str, object]] = []
    for rule in ACCESSORY_RULES:
        is_open = bool(rule.predicate(stats))
        if is_open:
            unlocked.append(rule.item_id)
        catalog.append(
            {
                "id": rule.item_id,
                "name_vi": rule.name_vi,
                "icon": rule.icon,
                "unlock_hint_vi": rule.unlock_hint_vi,
                "unlocked": is_open,
            }
        )
    return unlocked, catalog


def evaluate_habitats(stats: dict[str, int]) -> tuple[list[str], list[dict[str, object]]]:
    """Return (unlocked_ids, catalog_dicts) for pet habitats."""
    unlocked: list[str] = []
    catalog: list[dict[str, object]] = []
    for rule in HABITAT_RULES:
        is_open = bool(rule.predicate(stats))
        if is_open:
            unlocked.append(rule.item_id)
        catalog.append(
            {
                "id": rule.item_id,
                "name_vi": rule.name_vi,
                "icon": rule.icon,
                "unlock_hint_vi": rule.unlock_hint_vi,
                "unlocked": is_open,
            }
        )
    return unlocked, catalog


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)


def compute_pet_energy_and_mood(
    *,
    last_fed_at: datetime | None,
    last_petted_at: datetime | None,
    last_study_date: date | None,
    current_streak: int,
    now: datetime | None = None,
) -> tuple[int, str]:
    """Compute gentle, non-punitive pet energy [30..100] and mood."""
    current = _as_utc(now) or datetime.now(UTC)
    today = current.date()
    energy = 60

    fed_utc = _as_utc(last_fed_at)
    if fed_utc is not None:
        hours_since_fed = max(0.0, (current - fed_utc).total_seconds() / 3600.0)
        if hours_since_fed <= 12.0:
            energy += 25
        elif hours_since_fed <= 36.0:
            energy += 10
        else:
            decay_steps = min(6, int((hours_since_fed - 36.0) // 24.0) + 1)
            energy -= decay_steps * 5

    if last_study_date == today:
        energy += 15

    petted_utc = _as_utc(last_petted_at)
    if petted_utc is not None:
        hours_since_pet = max(0.0, (current - petted_utc).total_seconds() / 3600.0)
        if hours_since_pet <= 6.0:
            energy += 8

    energy = max(30, min(100, energy))
    if energy >= 85 or (current_streak >= 3 and energy >= 70):
        mood = "ecstatic"
    elif energy >= 55:
        mood = "happy"
    else:
        mood = "sleepy"
    return energy, mood


def compute_treat_budget(
    *, total_xp: int, cards_mastered: int, fed_count: int
) -> tuple[int, int]:
    """Return (available_treats, total_earned_treats)."""
    total_earned = 2 + max(0, total_xp) // 25 + max(0, cards_mastered)
    available = max(0, total_earned - max(0, fed_count))
    return available, total_earned


TREAT_REACTIONS: dict[str, list[tuple[str, str]]] = {
    "h2o": [
        (
            "Ụp! {name} uống giọt H₂O mát lành — phân tử phân cực giúp tế bào khỏe re!",
            "Glug! {name} drank pure H₂O — water's polarity fuels every cell!",
        ),
        (
            "Mát quá! Ở áp suất 1 atm, pure water sôi ở 100 °C và đóng băng ở 0 °C (273,15 K) nhé!",
            "Refreshing! At 1 atm, pure water boils at 100 °C and freezes at 0 °C (273.15 K)!",
        ),
    ],
    "glucose": [
        (
            "Ngon tuyệt! {name} nạp kẹo Glucose (C₆H₁₂O₆) — nhớ viết chuẩn IUPAC 'glucose' nhé!",
            "Yum! {name} munched Glucose (C₆H₁₂O₆) — the fuel of cellular respiration!",
        ),
        (
            "Tràn năng lượng! Thực vật tạo ra glucose và oxygen nhờ quang hợp dưới ánh sáng.",
            "Energy boost! Plants synthesize glucose and oxygen via photosynthesis.",
        ),
    ],
    "photon": [
        (
            "Chớp sáng! {name} nạp Hạt Photon — ánh sáng trong chân không truyền 3×10⁸ m/s!",
            "Sparkle! {name} absorbed a Photon — light speed in vacuum is 3×10⁸ m/s!",
        ),
        (
            "Rực rỡ quá! Quang phổ ánh sáng nhìn thấy trải dài từ Red đến Violet qua lăng kính!",
            "Dazzling! Visible light stretches cleanly from Red to Violet through a prism!",
        ),
    ],
}

PETTING_REACTIONS: dict[str, list[tuple[str, str]]] = {
    "owl": [
        (
            "Hoo-hoo! {name} vỗ cánh thích thú — hôm nay cùng mở khóa thêm từ vựng Vật lí SI nhé!",
            "Hoo-hoo! {name} flutters happily — ready to explore SI Physics together!",
        ),
        (
            "Cảm ơn cậu đã xoa đầu! {name} đang sáng mắt chờ câu đố tiếp theo nè!",
            "Thanks for the head pats! {name}'s optical eyes are glowing for the next quiz!",
        ),
    ],
    "fox": [
        (
            "Yip! {name} vẫy đuôi — giữ chuẩn IUPAC: Hydrochloric acid & Sodium hydroxide nha!",
            "Yip! {name} wags its atomic tail — IUPAC first: Hydrochloric acid & NaOH!",
        ),
        (
            "Thích quá đi! {name} pha xong bình thí nghiệm và gửi cậu một trái tim Hóa học đó!",
            "So cozy! {name} mixed a sparkling beaker just for you!",
        ),
    ],
    "cat": [
        (
            "Meow~ {name} rù rù ấm áp — DNA của bọn mình cùng mang mã di truyền yêu Khoa học đấy!",
            "Purr~ {name} feels loved — your Biology DNA streak is shining bright!",
        ),
        (
            "Meoww! Xoa đầu nữa đi, {name} hứa sẽ cổ vũ cậu đạt Streak thật dài!",
            "Meoww! More pets please — {name} is cheering for your daily study streak!",
        ),
    ],
}


def get_treat_reaction(treat: str, species: str, nickname: str, fed_count: int) -> tuple[str, str]:
    """Return bilingual snack reaction + micro-KHTN tip."""
    options = TREAT_REACTIONS.get(treat, TREAT_REACTIONS["h2o"])
    idx = fed_count % len(options)
    vi_tpl, en_tpl = options[idx]
    return (
        vi_tpl.format(name=nickname, species=species),
        en_tpl.format(name=nickname, species=species),
    )


def get_petting_reaction(species: str, nickname: str, petted_count: int) -> tuple[str, str]:
    """Return cute bilingual petting response."""
    options = PETTING_REACTIONS.get(species, PETTING_REACTIONS["owl"])
    idx = petted_count % len(options)
    vi_tpl, en_tpl = options[idx]
    return vi_tpl.format(name=nickname), en_tpl.format(name=nickname)

"""Unit and API integration tests for SciPet (Unit 2 + Leaderboard sync in Unit 3)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.modules.learning.pet_engine import (
    build_unlock_stats,
    compute_evolution_stage,
    compute_pet_energy_and_mood,
    evaluate_accessories,
    evaluate_habitats,
)


def _login(client: TestClient, email: str, password: str) -> str:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["access_token"]


def test_pet_engine_evolution_stages_unlocks_and_gentle_energy() -> None:
    assert compute_evolution_stage(1)[:2] == (1, "Trứng Năng Lượng")
    assert compute_evolution_stage(2)[:2] == (2, "Bé Sơ Sinh")
    assert compute_evolution_stage(5)[:2] == (3, "Thực Tập Sinh Lab")
    assert compute_evolution_stage(8)[:2] == (4, "Nhà Thám Hiểm KHTN")
    assert compute_evolution_stage(10)[:2] == (5, "Giáo Sư Huyền Thoại")

    stats_lvl1 = build_unlock_stats(
        level=1,
        total_xp=20,
        longest_streak=1,
        cards_mastered=0,
        badges=[],
        discipline_xp={"chemistry": 10},
    )
    acc1, _ = evaluate_accessories(stats_lvl1)
    hab1, _ = evaluate_habitats(stats_lvl1)
    assert acc1 == []
    assert hab1 == ["lab"]

    stats_high = build_unlock_stats(
        level=7,
        total_xp=640,
        longest_streak=5,
        cards_mastered=4,
        badges=["SciDex: Unit 1", "SciDex: Unit 2", "SciDex: Unit 7"],
        discipline_xp={"chemistry": 120, "physics": 80, "biology": 60},
    )
    acc_hi, _ = evaluate_accessories(stats_high)
    hab_hi, _ = evaluate_habitats(stats_high)
    assert set(acc_hi) >= {
        "goggles",
        "test_tube",
        "magnet",
        "seedling",
        "fire",
        "graduation_cap",
        "dna",
        "crown",
    }
    assert set(hab_hi) == {"lab", "forest", "cosmos", "atom"}

    # Even after 14 days away, pet energy stays >= 30 (never dies / never gets sick)
    now = datetime(2026, 11, 23, 9, 0, tzinfo=UTC)
    energy_inactive, mood_inactive = compute_pet_energy_and_mood(
        last_fed_at=now - timedelta(days=14),
        last_petted_at=None,
        last_study_date=None,
        current_streak=0,
        now=now,
    )
    assert energy_inactive >= 30
    assert mood_inactive == "sleepy"

    energy_active, mood_active = compute_pet_energy_and_mood(
        last_fed_at=now - timedelta(hours=1),
        last_petted_at=now - timedelta(minutes=10),
        last_study_date=now.date(),
        current_streak=4,
        now=now,
    )
    assert energy_active == 100
    assert mood_active == "ecstatic"


def test_student_pet_crud_feed_evolve_and_leaderboard_visibility(client: TestClient) -> None:
    token = _login(client, "an.hs8@demo.scilingo.vn", "Student123!")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Default Stage 1 Egg pet created cleanly for An
    me_resp = client.get("/api/v1/learning/pet/me", headers=headers)
    assert me_resp.status_code == 200, me_resp.text
    pet = me_resp.json()
    assert pet["species"] == "owl"
    assert pet["stage"] == 1
    assert pet["treat_points_available"] == 2
    assert pet["unlocked_habitats"] == ["lab"]

    # 2. Switching species & giving custom nickname works
    upd_resp = client.patch(
        "/api/v1/learning/pet/me",
        headers=headers,
        json={"species": "fox", "nickname": "Proton"},
    )
    assert upd_resp.status_code == 200
    assert upd_resp.json()["species"] == "fox"
    assert upd_resp.json()["nickname"] == "Proton"

    # 3. Attempting to equip locked accessory/habitat is blocked cleanly (400)
    locked_acc = client.patch(
        "/api/v1/learning/pet/me",
        headers=headers,
        json={"equipped_accessory": "crown"},
    )
    assert locked_acc.status_code == 400

    locked_hab = client.patch(
        "/api/v1/learning/pet/me",
        headers=headers,
        json={"equipped_habitat": "cosmos"},
    )
    assert locked_hab.status_code == 400

    # 4. Petting & feeding 2 starter treats
    pat_resp = client.post("/api/v1/learning/pet/pet", headers=headers)
    assert pat_resp.status_code == 200
    assert pat_resp.json()["pet"]["petted_count"] == 1
    assert "Proton" in pat_resp.json()["reaction_vi"]

    feed1 = client.post("/api/v1/learning/pet/feed", headers=headers, json={"treat": "h2o"})
    assert feed1.status_code == 200
    assert feed1.json()["pet"]["fed_count"] == 1
    assert feed1.json()["pet"]["treat_points_available"] == 1

    feed2 = client.post("/api/v1/learning/pet/feed", headers=headers, json={"treat": "glucose"})
    assert feed2.status_code == 200
    assert feed2.json()["pet"]["treat_points_available"] == 0

    feed_empty = client.post("/api/v1/learning/pet/feed", headers=headers, json={"treat": "photon"})
    assert feed_empty.status_code == 400

    # 5. Earning >= 100 XP evolves Proton to Stage 2 and unlocks goggles + test_tube + treats
    for _ in range(2):
        reward = client.post(
            "/api/v1/learning/games/reward",
            headers=headers,
            json={
                "game_type": "lightning_match",
                "correct_count": 15,
                "total_attempts": 15,
                "max_combo": 8,
                "discipline": "chemistry",
                "study_pack_unit_no": 7,
            },
        )
        assert reward.status_code == 200

    evolved = client.get("/api/v1/learning/pet/me", headers=headers).json()
    assert evolved["level"] >= 2
    assert evolved["stage"] >= 2
    assert "goggles" in evolved["unlocked_accessories"]
    assert "test_tube" in evolved["unlocked_accessories"]
    assert evolved["treat_points_available"] >= 4

    equip_resp = client.patch(
        "/api/v1/learning/pet/me",
        headers=headers,
        json={"equipped_accessory": "goggles", "equipped_habitat": "forest"},
    )
    assert equip_resp.status_code == 200
    assert equip_resp.json()["equipped_accessory"] == "goggles"
    assert equip_resp.json()["equipped_habitat"] == "forest"

    # 6. Leaderboard in Unit 3 exposes members' SciPet metadata while keeping classmates isolated
    classes = client.get("/api/v1/lms/my-classrooms", headers=headers).json()
    class_8a1 = next(c for c in classes if "8A1" in c["name"])
    lb_resp = client.get(
        f"/api/v1/lms/classrooms/{class_8a1['id']}/leaderboard", headers=headers
    )
    assert lb_resp.status_code == 200
    entries = lb_resp.json()["entries"]
    by_name = {e["student_name"]: e for e in entries}
    assert by_name["Nguyễn Minh An"]["pet_species"] == "fox"
    assert by_name["Nguyễn Minh An"]["pet_nickname"] == "Proton"
    assert by_name["Nguyễn Minh An"]["pet_stage"] >= 2
    assert by_name["Nguyễn Minh An"]["pet_accessory"] == "goggles"
    # Seeded classmates Linh & Khoi also display pets
    assert any(
        e["pet_species"] == "fox" and e["pet_nickname"] == "Atom" for e in entries
    )
    assert any(
        e["pet_species"] == "cat" and e["pet_nickname"] == "Neko" for e in entries
    )

    # Non-member cannot inspect leaderboard
    outsider_token = _login(client, "lan.bgh@demo.scilingo.vn", "Admin123!")
    blocked = client.get(
        f"/api/v1/lms/classrooms/{class_8a1['id']}/leaderboard",
        headers={"Authorization": f"Bearer {outsider_token}"},
    )
    assert blocked.status_code in (403, 404)

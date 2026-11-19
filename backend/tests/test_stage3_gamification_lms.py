"""Gate 2A & 2B tests for Stage 3: Sequence Lab, SciDex 16 badges, Leaderboard & Game Challenges."""

from __future__ import annotations

from fastapi.testclient import TestClient


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_sequence_lab_and_scidex_badge_unlock(client: TestClient) -> None:
    headers = _login(client, "an.hs8@demo.scilingo.vn", "Student123!")

    reward_resp = client.post(
        "/api/v1/learning/games/reward",
        json={
            "game_type": "sequence_lab",
            "correct_count": 6,
            "total_attempts": 7,
            "max_combo": 4,
            "discipline": "biology",
            "study_pack_unit_no": 1,
        },
        headers=headers,
    )
    assert reward_resp.status_code == 200, reward_resp.text
    data = reward_resp.json()
    assert data["xp_earned"] > 0
    assert "Bậc Thầy Hệ Thống" in data["newly_unlocked_badges"]
    assert "SciDex: Unit 1" in data["newly_unlocked_badges"]

    summary_resp = client.get("/api/v1/learning/gamification/me", headers=headers)
    assert summary_resp.status_code == 200
    badges = summary_resp.json()["badges"]
    assert "Bậc Thầy Hệ Thống" in badges
    assert "SciDex: Unit 1" in badges


def test_classroom_leaderboard_ranking_and_isolation(client: TestClient) -> None:
    student_headers = _login(client, "an.hs8@demo.scilingo.vn", "Student123!")
    teacher_headers = _login(client, "hai.gv@demo.scilingo.vn", "Teacher123!")
    nt_admin_headers = _login(client, "lan.bgh@demo.scilingo.vn", "Admin123!")

    my_cls_resp = client.get("/api/v1/lms/my-classrooms", headers=student_headers)
    assert my_cls_resp.status_code == 200, my_cls_resp.text
    my_classes = my_cls_resp.json()
    assert any(c["join_code"] == "KHTN8-CGB8" for c in my_classes)
    cgb_cls = next(c for c in my_classes if c["join_code"] == "KHTN8-CGB8")
    classroom_id = cgb_cls["id"]

    # Both enrolled student and teacher can view 8A1 leaderboard
    for hdrs in (student_headers, teacher_headers):
        lb_resp = client.get(
            f"/api/v1/lms/classrooms/{classroom_id}/leaderboard", headers=hdrs
        )
        assert lb_resp.status_code == 200, lb_resp.text
        lb = lb_resp.json()
        assert lb["total_students"] >= 3
        entries = lb["entries"]
        assert entries[0]["rank"] == 1
        assert entries[0]["student_name"] == "Trần Khánh Linh"
        assert entries[0]["total_xp"] >= entries[1]["total_xp"] >= entries[2]["total_xp"]
        assert "scidex_count" in entries[0]
        assert "badges_count" in entries[0]

    # Outside B2C student not enrolled in 8A1 gets 403 Forbidden
    outsider_reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "outsider@example.com",
            "password": "Password123!",
            "full_name": "Học Sinh Ngoài Lớp",
            "role": "student",
            "grade_level": 8,
        },
    )
    assert outsider_reg.status_code == 201
    outsider_headers = {"Authorization": f"Bearer {outsider_reg.json()['access_token']}"}
    forbid_resp = client.get(
        f"/api/v1/lms/classrooms/{classroom_id}/leaderboard", headers=outsider_headers
    )
    assert forbid_resp.status_code == 403

    # Cross-tenant school admin (Nguyen Trai) gets 404 (isolated tenant)
    cross_tenant = client.get(
        f"/api/v1/lms/classrooms/{classroom_id}/leaderboard", headers=nt_admin_headers
    )
    assert cross_tenant.status_code == 404


def test_teacher_game_challenges_and_clil_resource_separation(client: TestClient) -> None:
    teacher_headers = _login(client, "hai.gv@demo.scilingo.vn", "Teacher123!")
    student_headers = _login(client, "an.hs8@demo.scilingo.vn", "Student123!")
    nt_admin_headers = _login(client, "lan.bgh@demo.scilingo.vn", "Admin123!")

    cls_resp = client.get("/api/v1/lms/classrooms", headers=teacher_headers)
    assert cls_resp.status_code == 200
    cgb_cls = next(c for c in cls_resp.json() if c["join_code"] == "KHTN8-CGB8")
    classroom_id = cgb_cls["id"]

    # Teacher creates a sequence_lab challenge
    create_resp = client.post(
        f"/api/v1/lms/classrooms/{classroom_id}/game-challenges",
        json={
            "title": "Thử thách Tháp Sắp Xếp: Hệ hô hấp & pH",
            "game_type": "sequence_lab",
            "unit_no": 9,
            "target_score": 150,
            "duration_minutes": 5,
            "instructions": "Sắp xếp chuẩn 6 chuỗi KHTN 8 trước giờ kiểm tra!",
        },
        headers=teacher_headers,
    )
    assert create_resp.status_code == 200, create_resp.text
    created = create_resp.json()
    assert created["game_type"] == "sequence_lab"
    assert created["unit_no"] == 9
    assert created["created_by_name"] == "Phạm Thị Hải"

    # Enrolled student sees both seeded starter challenge and newly created challenge
    my_ch_resp = client.get("/api/v1/lms/my-game-challenges", headers=student_headers)
    assert my_ch_resp.status_code == 200, my_ch_resp.text
    challenges = my_ch_resp.json()
    assert len(challenges) >= 2
    assert any(c["id"] == created["id"] for c in challenges)

    # Non-member student is blocked (403); cross-tenant admin is isolated (404)
    outsider_reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "outsider2@example.com",
            "password": "Password123!",
            "full_name": "Học Sinh Ngoài 2",
            "role": "student",
            "grade_level": 8,
        },
    )
    assert outsider_reg.status_code == 201
    outsider_headers = {"Authorization": f"Bearer {outsider_reg.json()['access_token']}"}
    assert (
        client.get(
            f"/api/v1/lms/classrooms/{classroom_id}/game-challenges", headers=outsider_headers
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/v1/lms/classrooms/{classroom_id}/game-challenges", headers=nt_admin_headers
        ).status_code
        == 404
    )

    # Game challenges must NOT leak into CLIL lesson resources
    res_resp = client.get("/api/v1/lms/resources", params={"lesson_no": 1}, headers=teacher_headers)
    assert res_resp.status_code == 200
    assert all(r["resource_type"] != "game_challenge" for r in res_resp.json())

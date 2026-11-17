"""Gate 2A & 2B tests for Unit 2: SM-2 SRS, Mindmap, Quiz 10%/50%/100%, and Gamification."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.modules.learning.models import StudentPracticeAttempt
from app.modules.learning.srs import compute_sm2, update_streak


def _login_student(client: TestClient) -> dict[str, str]:
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": "an.hs8@demo.scilingo.vn", "password": "Student123!"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_sm2_scheduling_and_streak_logic() -> None:
    now = datetime(2026, 11, 17, 10, 0, tzinfo=UTC)

    # First good recall -> 1 day
    step1 = compute_sm2(quality=4, ease_factor=2.5, interval_days=0, repetitions=0, now=now)
    assert step1.repetitions == 1
    assert step1.interval_days == 1
    assert step1.next_review_at == now + timedelta(days=1)

    # Second good recall -> 6 days
    step2 = compute_sm2(
        quality=4,
        ease_factor=step1.ease_factor,
        interval_days=step1.interval_days,
        repetitions=step1.repetitions,
        now=now,
    )
    assert step2.repetitions == 2
    assert step2.interval_days == 6

    # Lapse -> resets repetitions to 0 and schedules in 10 minutes
    lapse = compute_sm2(
        quality=1,
        ease_factor=step2.ease_factor,
        interval_days=step2.interval_days,
        repetitions=step2.repetitions,
        now=now,
    )
    assert lapse.repetitions == 0
    assert lapse.interval_days == 0
    assert lapse.next_review_at == now + timedelta(minutes=10)

    # Streak logic
    d1 = date(2026, 11, 16)
    d2 = date(2026, 11, 17)
    s, longest, _ = update_streak(last_study_date=d1, current_streak=2, longest_streak=2, today=d2)
    assert s == 3
    assert longest == 3

    s_reset, longest_keep, _ = update_streak(
        last_study_date=date(2026, 11, 10), current_streak=5, longest_streak=5, today=d2
    )
    assert s_reset == 1
    assert longest_keep == 5


def test_srs_due_and_review_flow(client: TestClient) -> None:
    headers = _login_student(client)

    due_resp = client.get("/api/v1/learning/srs/due", params={"lesson_no": 8}, headers=headers)
    assert due_resp.status_code == 200
    due_data = due_resp.json()
    assert due_data["total_new"] == len(due_data["cards"])
    assert len(due_data["cards"]) >= 3

    first_card = due_data["cards"][0]
    review_resp = client.post(
        "/api/v1/learning/srs/review",
        json={"term_id": first_card["term_id"], "quality": 4},
        headers=headers,
    )
    assert review_resp.status_code == 200
    review_data = review_resp.json()
    assert review_data["interval_days"] == 1
    assert review_data["xp_earned"] == 10
    assert review_data["total_xp"] == 10
    assert review_data["current_streak"] == 1
    assert "First Spark" in review_data["newly_unlocked_badges"]

    # Card scheduled for tomorrow should leave today's due queue
    after_resp = client.get("/api/v1/learning/srs/due", params={"lesson_no": 8}, headers=headers)
    assert after_resp.status_code == 200
    remaining_ids = {c["term_id"] for c in after_resp.json()["cards"]}
    assert first_card["term_id"] not in remaining_ids


def test_lesson_mindmap_has_terms_and_integration_nodes(client: TestClient) -> None:
    resp = client.get("/api/v1/learning/mindmap/8")
    assert resp.status_code == 200
    mm = resp.json()

    assert mm["lesson_no"] == 8
    node_types = {n["node_type"] for n in mm["nodes"]}
    assert {"lesson", "term", "integration"} <= node_types
    assert any(n.get("target_lesson_no") == 32 for n in mm["nodes"])
    assert any(e["relation"] == "cross_discipline" for e in mm["edges"])


def test_practice_quiz_tt94_ratios_and_grading(
    client: TestClient, test_db_session: Session
) -> None:
    headers = _login_student(client)

    # Lesson 45 only has 2 seed terms; quiz_builder must fill up to 10 from biology pool
    start_10 = client.post(
        "/api/v1/learning/practice/start",
        json={"lesson_no": 45, "mode": "quiz_10", "total_questions": 10},
        headers=headers,
    )
    assert start_10.status_code == 200
    q10 = start_10.json()
    assert q10["total_questions"] == 10
    assert q10["english_questions_count"] == 1
    assert q10["english_ratio"] == 0.1
    assert "correct_index" not in q10["questions"][0]

    # Lesson 8 in quiz_50 must have 5 English questions and 5 Vietnamese questions
    start_50 = client.post(
        "/api/v1/learning/practice/start",
        json={"lesson_no": 8, "mode": "quiz_50", "total_questions": 10},
        headers=headers,
    )
    assert start_50.status_code == 200
    q50 = start_50.json()
    assert q50["total_questions"] == 10
    assert q50["english_questions_count"] == 5
    assert q50["english_ratio"] == 0.5
    for q in q50["questions"]:
        assert len(q["options"]) == 4
        assert len(set(q["options"])) == 4

    # Look up ground-truth answers in DB to test full-score grading
    attempt = test_db_session.get(StudentPracticeAttempt, q50["attempt_id"])
    assert attempt is not None
    answers = [
        {"index": q["index"], "selected_index": q["correct_index"]}
        for q in attempt.questions_json
    ]

    submit_resp = client.post(
        f"/api/v1/learning/practice/{q50['attempt_id']}/submit",
        json={"answers": answers},
        headers=headers,
    )
    assert submit_resp.status_code == 200
    res = submit_resp.json()
    assert res["score"] == 10.0
    assert res["vi_score"] == 5.0
    assert res["en_score"] == 5.0
    assert "Sẵn sàng 50% Thông tư 94" in res["newly_unlocked_badges"]

    # Duplicate submit blocked
    dup = client.post(
        f"/api/v1/learning/practice/{q50['attempt_id']}/submit",
        json={"answers": answers},
        headers=headers,
    )
    assert dup.status_code == 409

    # Gamification summary reflects completed attempt
    g_resp = client.get("/api/v1/learning/gamification/me", headers=headers)
    assert g_resp.status_code == 200
    g_data = g_resp.json()
    assert g_data["total_xp"] >= 70
    assert len(g_data["recent_attempts"]) == 1


def test_practice_submit_blocks_other_user(client: TestClient) -> None:
    student_headers = _login_student(client)
    start_resp = client.post(
        "/api/v1/learning/practice/start",
        json={"lesson_no": 2, "mode": "quiz_10", "total_questions": 10},
        headers=student_headers,
    )
    attempt_id = start_resp.json()["attempt_id"]

    other_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "other.student@example.com",
            "password": "Password123!",
            "full_name": "Học sinh Khác",
            "role": "student",
            "grade_level": 8,
        },
    )
    other_headers = {"Authorization": f"Bearer {other_resp.json()['access_token']}"}

    forbid = client.post(
        f"/api/v1/learning/practice/{attempt_id}/submit",
        json={"answers": [{"index": 0, "selected_index": 0}]},
        headers=other_headers,
    )
    assert forbid.status_code == 403

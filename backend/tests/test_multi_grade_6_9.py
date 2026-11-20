"""Gate 2A & 2B tests for Multi-Grade THCS expansion (Grades 6, 7, 8, and 9)."""

from __future__ import annotations

from io import BytesIO

from docx import Document
from fastapi.testclient import TestClient


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_all_four_grades_seeded_and_queryable(client: TestClient) -> None:
    grades_resp = client.get("/api/v1/curriculum/grades")
    assert grades_resp.status_code == 200, grades_resp.text
    by_grade = {item["grade"]: item for item in grades_resp.json()}
    assert set(by_grade.keys()) == {6, 7, 8, 9}
    assert by_grade[6]["total_lessons"] == 55
    assert by_grade[7]["total_lessons"] == 43
    assert by_grade[8]["total_lessons"] == 47
    assert by_grade[9]["total_lessons"] == 45

    for grade, expected_total in ((6, 55), (7, 43), (8, 47), (9, 45)):
        tree_resp = client.get(f"/api/v1/curriculum/kntt/{grade}/chapters")
        assert tree_resp.status_code == 200
        tree = tree_resp.json()
        assert tree["grade"] == grade
        assert tree["total_lessons"] == expected_total

    # Grade 6 Lesson 55 & Grade 9 Lesson 26 should resolve distinctly
    g6_last = client.get("/api/v1/curriculum/kntt/6/lessons/55")
    assert g6_last.status_code == 200
    assert g6_last.json()["grade"] == 6
    assert "Ngân Hà" in g6_last.json()["title_vi"]

    g9_acetic = client.get("/api/v1/curriculum/kntt/9/lessons/26")
    assert g9_acetic.status_code == 200
    assert g9_acetic.json()["grade"] == 9
    assert g9_acetic.json()["title_vi"] == "Acetic acid"


def test_term_search_filters_by_grade_and_shares_slugs(client: TestClient) -> None:
    g9_resp = client.get("/api/v1/terms", params={"grade": 9, "q": "Ethanol"})
    assert g9_resp.status_code == 200
    assert g9_resp.json()["total"] >= 1
    assert g9_resp.json()["items"][0]["term_en"] == "Ethanol"

    # Ecosystem appears across Grades 6 and 8 via shared Term slug without duplicating rows
    eco_detail = client.get("/api/v1/terms/ecosystem")
    assert eco_detail.status_code == 200
    grades_linked = {ref["grade"] for ref in eco_detail.json()["lessons"]}
    assert 6 in grades_linked
    assert 8 in grades_linked


def test_grade_isolated_practice_quiz_and_mindmap(client: TestClient) -> None:
    g6_mm = client.get("/api/v1/learning/mindmap/1", params={"grade": 6})
    g9_mm = client.get("/api/v1/learning/mindmap/1", params={"grade": 9})
    assert g6_mm.status_code == 200 and g9_mm.status_code == 200
    assert g6_mm.json()["grade"] == 6
    assert g9_mm.json()["grade"] == 9
    assert g6_mm.json()["title_vi"] != g9_mm.json()["title_vi"]

    headers = _login(client, "an.hs8@demo.scilingo.vn", "Student123!")
    start = client.post(
        "/api/v1/learning/practice/start",
        json={"grade": 9, "lesson_no": 37, "mode": "quiz_50", "total_questions": 6},
        headers=headers,
    )
    assert start.status_code == 200, start.text
    session = start.json()
    assert session["grade"] == 9
    assert session["lesson_no"] == 37

    submit = client.post(
        f"/api/v1/learning/practice/{session['attempt_id']}/submit",
        json={
            "answers": [
                {"index": q["index"], "selected_index": 0} for q in session["questions"]
            ]
        },
        headers=headers,
    )
    assert submit.status_code == 200
    assert submit.json()["grade"] == 9

    summary = client.get("/api/v1/learning/gamification/me", headers=headers).json()
    assert any(
        att["grade"] == 9 and att["lesson_no"] == 37 for att in summary["recent_attempts"]
    )


def test_grade9_exam_generation_docx_pdf_and_tt94_grade_breakdown(client: TestClient) -> None:
    teacher_headers = _login(client, "hai.gv@demo.scilingo.vn", "Teacher123!")

    # Generate a Grade 9 50% English exam covering Chemistry IUPAC (22, 26) & Genetics (37)
    gen_resp = client.post(
        "/api/v1/lms/exams/generate",
        json={
            "title": "Đề ôn thi vào 10 KHTN 9 (50% Tiếng Anh)",
            "grade": 9,
            "lesson_nos": [22, 26, 37],
            "target_en_ratio": 0.50,
            "total_points": 10.0,
            "question_count": 10,
            "duration_minutes": 45,
        },
        headers=teacher_headers,
    )
    assert gen_resp.status_code == 200, gen_resp.text
    exam = gen_resp.json()
    assert exam["grade"] == 9
    assert exam["meets_tt94_50"] is True

    docx_resp = client.get(
        f"/api/v1/lms/exams/{exam['id']}/export",
        params={"format": "docx"},
        headers=teacher_headers,
    )
    assert docx_resp.status_code == 200
    doc = Document(BytesIO(docx_resp.content))
    full_text = "\n".join(p.text for p in doc.paragraphs)
    assert "MÔN KHOA HỌC TỰ NHIÊN 9 (KNTT)" in full_text

    pdf_resp = client.get(
        f"/api/v1/lms/exams/{exam['id']}/export",
        params={"format": "pdf"},
        headers=teacher_headers,
    )
    assert pdf_resp.status_code == 200
    assert pdf_resp.content.startswith(b"%PDF-")

    # TT94 report breaks down classrooms & periods across Grades 6, 7, 8, 9
    report_resp = client.get("/api/v1/lms/reports/tt94-compliance", headers=teacher_headers)
    assert report_resp.status_code == 200
    breakdown = {item["grade"]: item for item in report_resp.json()["grade_breakdown"]}
    assert set(breakdown.keys()) == {6, 7, 8, 9}
    assert breakdown[6]["classrooms_count"] >= 1
    assert breakdown[7]["classrooms_count"] >= 1
    assert breakdown[8]["classrooms_count"] >= 1
    assert breakdown[9]["classrooms_count"] >= 1
    assert breakdown[9]["exams_meeting_50_pct"] >= 1

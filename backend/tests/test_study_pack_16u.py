"""Tests for the 16-Unit attached study pack ('The English Dictionary for SCIENCE')."""

from __future__ import annotations

from io import BytesIO

from docx import Document
from fastapi.testclient import TestClient


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_study_pack_overview_and_unit_details(client: TestClient) -> None:
    resp = client.get("/api/v1/study-packs/english-science")
    assert resp.status_code == 200
    overview = resp.json()
    assert overview["total_units"] == 16
    assert overview["total_items"] == 920
    assert "Cầu Giấy B" in overview["school_context"]
    assert "Phạm Thị Hải" in overview["school_context"]

    # Check Unit 1 (44 items), Unit 11 pinocytosis ('ẩm bào'), and Unit 16 (53 items)
    u1_resp = client.get("/api/v1/study-packs/english-science/units/1")
    assert u1_resp.status_code == 200
    u1 = u1_resp.json()
    assert u1["unit"]["item_count"] == 44
    assert u1["items"][0]["term_en"] == "motion"

    u11_resp = client.get("/api/v1/study-packs/english-science/units/11")
    assert u11_resp.status_code == 200
    u11_items = {i["order_no"]: i for i in u11_resp.json()["items"]}
    assert "ẩm bào" in u11_items[43]["meaning_vi"]

    u16_resp = client.get("/api/v1/study-packs/english-science/units/16")
    assert u16_resp.status_code == 200
    assert u16_resp.json()["unit"]["item_count"] == 53


def test_study_pack_search_and_iupac_guardrail_notes(client: TestClient) -> None:
    resp = client.get("/api/v1/study-packs/english-science/search", params={"q": "acid"})
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["total"] >= 10
    acid_item = next(
        item for item in payload["items"] if item["unit_no"] == 7 and item["term_en"] == "acid"
    )
    assert acid_item["iupac_note"] is not None
    assert "acid" in acid_item["iupac_note"].lower()


def test_study_pack_quiz_and_teacher_exam_generation(client: TestClient) -> None:
    # Public practice quiz from Unit 1 & Unit 7 at 50% EN
    quiz_resp = client.post(
        "/api/v1/study-packs/english-science/quiz",
        json={"unit_nos": [1, 7], "mode": "quiz_50", "question_count": 10},
    )
    assert quiz_resp.status_code == 200
    quiz = quiz_resp.json()
    assert quiz["total_points"] == 10.0
    assert quiz["en_points"] == 5.0
    assert len(quiz["questions"]) == 10
    assert all(len(q["options"]) == 4 for q in quiz["questions"])

    # Teacher Phạm Thị Hải generates a formal TT94 exam from Units 1, 7, 14 and exports .docx
    teacher_headers = _login(client, "hai.gv@demo.scilingo.vn", "Teacher123!")
    gen_resp = client.post(
        "/api/v1/lms/exams/generate",
        json={
            "title": "Đề ôn chuyên đề Dictionary for Science (Units 1, 7, 14)",
            "study_pack_unit_nos": [1, 7, 14],
            "target_en_ratio": 0.50,
            "question_count": 10,
            "duration_minutes": 30,
        },
        headers=teacher_headers,
    )
    assert gen_resp.status_code == 200, gen_resp.text
    exam = gen_resp.json()
    assert exam["en_points"] == 5.0

    docx_resp = client.get(
        f"/api/v1/lms/exams/{exam['id']}/export",
        params={"format": "docx"},
        headers=teacher_headers,
    )
    assert docx_resp.status_code == 200
    doc = Document(BytesIO(docx_resp.content))
    full_text = "\n".join(p.text for p in doc.paragraphs)
    assert "TRƯỜNG THCS CẦU GIẤY B" in full_text
    assert "Phạm Thị Hải" in full_text

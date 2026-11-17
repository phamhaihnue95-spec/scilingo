"""Gate 2A tests for Unit 1: KNTT 8 47-lesson curriculum, terms, and IUPAC rules."""

from __future__ import annotations

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.seed import seed_all


def test_curriculum_tree_has_all_47_lessons(client: TestClient) -> None:
    resp = client.get("/api/v1/curriculum/kntt-8/chapters")
    assert resp.status_code == 200
    payload = resp.json()

    assert payload["grade"] == 8
    assert payload["total_chapters"] == 9
    assert payload["total_lessons"] == 47

    lesson_numbers = [
        lesson["lesson_no"]
        for chapter in payload["chapters"]
        for lesson in chapter["lessons"]
    ]
    assert lesson_numbers == list(range(1, 48))


def test_curriculum_discipline_filter(client: TestClient) -> None:
    resp = client.get("/api/v1/curriculum/kntt-8/chapters", params={"discipline": "chemistry"})
    assert resp.status_code == 200
    payload = resp.json()

    # Chapters I (6 lessons) + II (5 lessons) = 11 chemistry lessons
    assert payload["total_lessons"] == 11
    for chapter in payload["chapters"]:
        assert all(lesson["discipline"] == "chemistry" for lesson in chapter["lessons"])


def test_lesson_detail_includes_terms_and_cross_discipline_links(client: TestClient) -> None:
    # Lesson 8 (Acid) integrates with Lesson 32 (Digestion in Human Body)
    resp = client.get("/api/v1/curriculum/lessons/8")
    assert resp.status_code == 200
    lesson = resp.json()

    assert lesson["lesson_no"] == 8
    assert lesson["title_vi"] == "Acid"
    assert lesson["discipline"] == "chemistry"

    target_nos = [link["target_lesson_no"] for link in lesson["integration_links"]]
    assert 32 in target_nos

    term_names = {term["term_en"] for term in lesson["terms"]}
    assert "Acid" in term_names
    assert "Sulfuric acid" in term_names
    assert "Hydrochloric acid" in term_names


def test_term_search_and_detail_lookup(client: TestClient) -> None:
    resp = client.get("/api/v1/terms", params={"q": "Sulfuric"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] >= 1
    first = data["items"][0]
    assert first["term_en"] == "Sulfuric acid"

    detail_resp = client.get(f"/api/v1/terms/{first['slug']}")
    assert detail_resp.status_code == 200
    detail = detail_resp.json()
    assert detail["formula_or_symbol"] == "H₂SO₄"
    assert any(ref["lesson_no"] == 8 for ref in detail["lessons"])


def test_iupac_rulebook_endpoint_has_13_exception_elements(client: TestClient) -> None:
    resp = client.get("/api/v1/curriculum/rules/iupac")
    assert resp.status_code == 200
    rules = resp.json()
    assert len(rules["exception_13_elements"]) == 13
    symbols = {el["symbol"] for el in rules["exception_13_elements"]}
    assert {"Au", "Ag", "Cu", "Pb", "Fe", "Al", "Zn", "S", "Sn", "N", "Na", "K", "Hg"} == symbols
    assert len(rules["deprecated_terms_to_flag"]) >= 10


def test_seed_is_idempotent(test_db_session: Session) -> None:
    ch_added, lesson_added, term_added = seed_all(
        test_db_session,
        data_dir=get_settings().data_dir,
    )
    assert ch_added == 0
    assert lesson_added == 0
    assert term_added == 0

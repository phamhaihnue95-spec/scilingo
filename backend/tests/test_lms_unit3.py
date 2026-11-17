"""Gate 2A & 2B tests for Unit 3: CLIL Resources, Exam Builder, Word/PDF Export, LMS & TT94."""

from __future__ import annotations

from io import BytesIO

from docx import Document
from fastapi.testclient import TestClient

from app.modules.lms.exam_engine import compute_exam_allocation


def _login(client: TestClient, email: str, password: str) -> dict[str, str]:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_exam_point_allocation_math_is_exact() -> None:
    p10 = compute_exam_allocation(question_count=10, total_points=10.0, target_en_ratio=0.10)
    assert p10.en_count == 1
    assert p10.en_points == 1.0
    assert p10.vi_points == 9.0
    assert round(sum(p10.points_per_question), 2) == 10.0
    assert p10.achieved_en_ratio == 0.10

    p50 = compute_exam_allocation(question_count=10, total_points=10.0, target_en_ratio=0.50)
    assert p50.en_count == 5
    assert p50.en_points == 5.0
    assert p50.vi_points == 5.0
    assert p50.achieved_en_ratio == 0.50

    p_odd = compute_exam_allocation(question_count=7, total_points=10.0, target_en_ratio=0.50)
    assert round(sum(p_odd.points_per_question), 2) == 10.0
    assert p_odd.achieved_en_ratio >= 0.50


def test_clil_lesson_resources_and_exam_docx_pdf_export(client: TestClient) -> None:
    teacher_headers = _login(client, "minh.gv@demo.scilingo.vn", "Teacher123!")

    # Lesson 8 resources include plan, slides, and worksheet with CV 5208 integration
    res_resp = client.get("/api/v1/lms/resources", params={"lesson_no": 8}, headers=teacher_headers)
    assert res_resp.status_code == 200
    resources = res_resp.json()
    assert len(resources) >= 3
    assert any(
        r["resource_type"] == "lesson_plan" and "Bài 32" in r["content_markdown"]
        for r in resources
    )

    # Generate 50% English exam covering Lesson 8 (Chemistry H₂SO₄) & Lesson 13 (Physics kg/m³)
    gen_resp = client.post(
        "/api/v1/lms/exams/generate",
        json={
            "title": "Kiểm tra giữa kỳ KHTN 8 (50% Tiếng Anh)",
            "lesson_nos": [8, 13, 18],
            "target_en_ratio": 0.50,
            "total_points": 10.0,
            "question_count": 10,
            "duration_minutes": 45,
        },
        headers=teacher_headers,
    )
    assert gen_resp.status_code == 200, gen_resp.text
    exam = gen_resp.json()
    assert exam["total_points"] == 10.0
    assert exam["en_points"] == 5.0
    assert exam["vi_points"] == 5.0
    assert exam["meets_tt94_10"] is True
    assert exam["meets_tt94_50"] is True

    # Export Word (.docx) and verify Unicode + Vietnamese + chemical symbols
    docx_resp = client.get(
        f"/api/v1/lms/exams/{exam['id']}/export",
        params={"format": "docx"},
        headers=teacher_headers,
    )
    assert docx_resp.status_code == 200
    doc = Document(BytesIO(docx_resp.content))
    full_text = "\n".join(p.text for p in doc.paragraphs)
    assert "ĐỀ KIỂM TRA ĐỊNH KỲ" in full_text
    assert "5.0/10.0 điểm" in full_text

    # Export PDF (.pdf)
    pdf_resp = client.get(
        f"/api/v1/lms/exams/{exam['id']}/export",
        params={"format": "pdf"},
        headers=teacher_headers,
    )
    assert pdf_resp.status_code == 200
    assert pdf_resp.content.startswith(b"%PDF-")
    assert len(pdf_resp.content) > 1500


def test_classroom_assignment_submission_analytics_and_tt94_report(client: TestClient) -> None:
    teacher_headers = _login(client, "minh.gv@demo.scilingo.vn", "Teacher123!")
    student_headers = _login(client, "an.hs8@demo.scilingo.vn", "Student123!")

    # Create a new classroom
    cls_resp = client.post(
        "/api/v1/lms/classrooms",
        json={"name": "8A2 - Tích hợp", "grade": 8, "academic_year": "2026-2027"},
        headers=teacher_headers,
    )
    assert cls_resp.status_code == 200
    classroom = cls_resp.json()
    assert classroom["join_code"].startswith("KHTN8-")

    # Student joins using join_code
    join_resp = client.post(
        "/api/v1/lms/classrooms/join",
        json={"join_code": classroom["join_code"]},
        headers=student_headers,
    )
    assert join_resp.status_code == 200
    assert join_resp.json()["student_count"] == 1

    # Teacher creates custom question, generates 10% exam, and assigns to 8A2
    q_resp = client.post(
        "/api/v1/lms/questions",
        json={
            "lesson_no": 8,
            "language": "en",
            "cognitive_level": "know",
            "discipline": "chemistry",
            "prompt_text": "What is the IUPAC name of H₂SO₄?",
            "options": ["Sulfuric acid", "Axit sunfuric", "Hydrochloric acid", "Nitric acid"],
            "correct_index": 0,
            "explanation_vi": "Theo chuẩn IUPAC, H₂SO₄ đọc là Sulfuric acid.",
        },
        headers=teacher_headers,
    )
    assert q_resp.status_code == 200

    exam_resp = client.post(
        "/api/v1/lms/exams/generate",
        json={
            "title": "Kiểm tra 15 phút Bài 8 (10% EN)",
            "lesson_nos": [8],
            "classroom_id": classroom["id"],
            "target_en_ratio": 0.10,
            "total_points": 10.0,
            "question_count": 10,
            "duration_minutes": 15,
        },
        headers=teacher_headers,
    )
    assert exam_resp.status_code == 200
    exam = exam_resp.json()
    assert exam["meets_tt94_10"] is True
    assert exam["meets_tt94_50"] is False

    assign_resp = client.post(
        f"/api/v1/lms/classrooms/{classroom['id']}/assignments",
        json={"exam_id": exam["id"]},
        headers=teacher_headers,
    )
    assert assign_resp.status_code == 200
    assignment = assign_resp.json()

    # Student views and submits assignment
    my_resp = client.get("/api/v1/lms/my-assignments", headers=student_headers)
    assert my_resp.status_code == 200
    assert any(a["id"] == assignment["id"] for a in my_resp.json())

    take_resp = client.get(
        f"/api/v1/lms/assignments/{assignment['id']}/take",
        headers=student_headers,
    )
    assert take_resp.status_code == 200
    take_data = take_resp.json()
    assert "correct_answer" not in take_data["questions"][0]

    # Answer using ground truth from teacher's exam detail
    answer_by_qid = {
        q["question_id"]: q["options"].index(q["correct_answer"])
        for q in exam["questions"]
    }
    sub_resp = client.post(
        f"/api/v1/lms/assignments/{assignment['id']}/submit",
        json={
            "answers": [
                {"question_id": q["question_id"], "selected_index": answer_by_qid[q["question_id"]]}
                for q in take_data["questions"]
            ]
        },
        headers=student_headers,
    )
    assert sub_resp.status_code == 200
    assert sub_resp.json()["score"] == 10.0
    assert sub_resp.json()["en_score"] == 1.0
    assert sub_resp.json()["vi_score"] == 9.0

    # Classroom analytics reflects student's score
    ana_resp = client.get(
        f"/api/v1/lms/classrooms/{classroom['id']}/analytics",
        headers=teacher_headers,
    )
    assert ana_resp.status_code == 200
    ana = ana_resp.json()
    assert ana["submissions_count"] == 1
    assert ana["average_score"] == 10.0

    # Log 35 periods on 8A2 and check TT94 compliance report
    log_resp = client.post(
        "/api/v1/lms/sessions/log",
        json={
            "classroom_id": classroom["id"],
            "lesson_no": 8,
            "taught_date": "2026-11-17",
            "periods_count": 5,
            "clil_mode": "bilingual_10",
            "english_minutes": 90,
        },
        headers=teacher_headers,
    )
    assert log_resp.status_code == 200

    tt94_resp = client.get("/api/v1/lms/reports/tt94-compliance", headers=teacher_headers)
    assert tt94_resp.status_code == 200
    report = tt94_resp.json()
    assert report["total_exams_generated"] >= 1
    assert report["exams_meeting_10_pct"] >= 1
    assert report["total_periods_logged"] >= 9


def test_lms_rbac_and_tenant_isolation(client: TestClient) -> None:
    student_headers = _login(client, "an.hs8@demo.scilingo.vn", "Student123!")
    cva_teacher_headers = _login(client, "minh.gv@demo.scilingo.vn", "Teacher123!")
    nt_admin_headers = _login(client, "lan.bgh@demo.scilingo.vn", "Admin123!")

    # Student cannot create classroom or generate exams or read TT94 school report
    assert (
        client.post(
            "/api/v1/lms/classrooms",
            json={"name": "Fake Class", "grade": 8},
            headers=student_headers,
        ).status_code
        == 403
    )
    assert (
        client.get("/api/v1/lms/reports/tt94-compliance", headers=student_headers).status_code
        == 403
    )

    # CVA teacher generates exam in Tenant A
    exam_id = client.post(
        "/api/v1/lms/exams/generate",
        json={"title": "CVA Secret Exam", "lesson_nos": [8], "target_en_ratio": 0.10},
        headers=cva_teacher_headers,
    ).json()["id"]

    # Tenant B admin (Nguyễn Trãi) cannot access or export Tenant A's exam
    assert (
        client.get(f"/api/v1/lms/exams/{exam_id}", headers=nt_admin_headers).status_code == 404
    )
    assert (
        client.get(
            f"/api/v1/lms/exams/{exam_id}/export",
            params={"format": "docx"},
            headers=nt_admin_headers,
        ).status_code
        == 404
    )

    # Tenant B TT94 report has 0 classrooms/exams from Tenant A
    nt_report = client.get("/api/v1/lms/reports/tt94-compliance", headers=nt_admin_headers).json()
    assert nt_report["total_classrooms"] == 0
    assert nt_report["total_exams_generated"] == 0

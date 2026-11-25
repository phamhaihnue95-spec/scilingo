"""Gate 2A & Gate 2B tests for SciLingo CMS Portal (Units 1, 3, and 5)."""

from __future__ import annotations

from fastapi.testclient import TestClient


def _auth_headers(client: TestClient, email: str, password: str) -> tuple[dict[str, str], dict]:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    data = resp.json()
    return {"Authorization": f"Bearer {data['access_token']}"}, data


def test_cms_rbac_and_school_isolation(client: TestClient) -> None:
    stu_hdr, _ = _auth_headers(client, "an.hs8@demo.scilingo.vn", "Student123!")
    cgb_admin_hdr, cgb_admin_data = _auth_headers(client, "hung.bgh@demo.scilingo.vn", "Admin123!")
    nt_admin_hdr, nt_admin_data = _auth_headers(client, "lan.bgh@demo.scilingo.vn", "Admin123!")

    # Students must be blocked from all CMS endpoints
    for method, path in (
        ("GET", "/api/v1/identity/cms/overview"),
        ("GET", "/api/v1/identity/cms/users"),
        ("GET", "/api/v1/curriculum/cms/lessons"),
        ("GET", "/api/v1/curriculum/cms/terms"),
        ("GET", "/api/v1/lms/cms/questions"),
        ("GET", "/api/v1/lms/cms/resources"),
    ):
        resp = client.request(method, path, headers=stu_hdr)
        assert resp.status_code == 403, f"Expected 403 on {path}, got {resp.status_code}"

    # School admin cannot see users from another school tenant
    users_resp = client.get("/api/v1/identity/cms/users", headers=cgb_admin_hdr)
    assert users_resp.status_code == 200
    emails = {u["email"] for u in users_resp.json()}
    assert "an.hs8@demo.scilingo.vn" in emails
    assert "lan.bgh@demo.scilingo.vn" not in emails

    # School admin cannot create school_admin/platform_admin or deactivate themselves
    bad_role_resp = client.post(
        "/api/v1/identity/cms/users",
        headers=cgb_admin_hdr,
        json={
            "email": "fake.admin@demo.scilingo.vn",
            "password": "Password123!",
            "full_name": "Fake Admin",
            "role": "platform_admin",
        },
    )
    assert bad_role_resp.status_code == 403

    self_lock_resp = client.patch(
        f"/api/v1/identity/cms/users/{cgb_admin_data['user']['id']}",
        headers=cgb_admin_hdr,
        json={"is_active": False},
    )
    assert self_lock_resp.status_code == 400

    # Cross-tenant user edit blocked
    cross_edit = client.patch(
        f"/api/v1/identity/cms/users/{nt_admin_data['user']['id']}",
        headers=cgb_admin_hdr,
        json={"full_name": "Hacked"},
    )
    assert cross_edit.status_code == 403

    # School admin cannot edit KNTT national curriculum lessons
    lessons_resp = client.get("/api/v1/curriculum/cms/lessons?grade=8", headers=cgb_admin_hdr)
    assert lessons_resp.status_code == 200
    lesson_id = lessons_resp.json()["items"][0]["id"]
    lesson_patch = client.patch(
        f"/api/v1/curriculum/cms/lessons/{lesson_id}",
        headers=cgb_admin_hdr,
        json={"summary_vi": "Sửa thử không có quyền"},
    )
    assert lesson_patch.status_code == 403
    assert (
        client.get("/api/v1/identity/cms/tenants", headers=nt_admin_hdr).json()[0]["name"]
        == "Trường THCS Nguyễn Trãi (Demo TT94)"
    )


def test_iupac_linter_and_unit1_glossary_lesson_cms(client: TestClient) -> None:
    teacher_hdr, _ = _auth_headers(client, "hai.gv@demo.scilingo.vn", "Teacher123!")
    platform_hdr, _ = _auth_headers(client, "phamhaihnue95@gmail.com", "Hamberger23")

    # Legacy demo admin email must no longer authenticate
    old_admin_resp = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@demo.scilingo.vn", "password": "Admin123!"},
    )
    assert old_admin_resp.status_code == 401

    # Linter flags legacy spellings + preserves 13 elemental exceptions with guidance
    bad_lint = client.post(
        "/api/v1/curriculum/cms/lint-check",
        headers=teacher_hdr,
        json={"text": "Cho đinh sắt vào axit sunfuric và đo ADN."},
    )
    assert bad_lint.status_code == 200
    lint_data = bad_lint.json()
    assert lint_data["passed"] is False
    assert lint_data["error_count"] >= 1
    assert lint_data["warning_count"] >= 1
    assert any("sắt" in note.lower() for note in lint_data["exception_notes"])

    good_lint = client.post(
        "/api/v1/curriculum/cms/lint-check",
        headers=teacher_hdr,
        json={"text": "Hydrochloric acid (HCl) reacts with Iron (Fe) and Sodium hydroxide."},
    )
    assert good_lint.status_code == 200
    assert good_lint.json()["passed"] is True

    # Teacher proposes a term -> always stored as 'draft' and hidden from public /terms
    propose_resp = client.post(
        "/api/v1/curriculum/cms/terms",
        headers=teacher_hdr,
        json={
            "term_en": "Hydrobromic acid",
            "term_vi": "Dung dịch HBr (Hydrobromic acid)",
            "ipa": "/ˌhaɪ.drəʊˈbrəʊ.mɪk ˈæs.ɪd/",
            "discipline": "chemistry",
            "formula_or_symbol": "HBr",
            "status": "verified",
        },
    )
    assert propose_resp.status_code == 201
    proposed = propose_resp.json()["term"]
    assert proposed["status"] == "draft"

    public_search = client.get("/api/v1/terms?q=Hydrobromic").json()
    assert public_search["total"] == 0

    # Platform admin cannot verify a term that fails IUPAC linter
    bad_verify = client.post(
        "/api/v1/curriculum/cms/terms",
        headers=platform_hdr,
        json={
            "term_en": "Legacy Test Acid",
            "term_vi": "Axit thử nghiệm sai",
            "discipline": "chemistry",
            "status": "verified",
        },
    )
    assert bad_verify.status_code == 422

    # Platform admin verifies the proposed clean term -> becomes visible in public /terms
    verify_resp = client.patch(
        f"/api/v1/curriculum/cms/terms/{proposed['id']}",
        headers=platform_hdr,
        json={"status": "verified"},
    )
    assert verify_resp.status_code == 200
    assert verify_resp.json()["term"]["status"] == "verified"

    public_after = client.get("/api/v1/terms?q=Hydrobromic").json()
    assert public_after["total"] == 1

    # Platform admin deletes test term cleanly
    del_resp = client.delete(f"/api/v1/curriculum/cms/terms/{proposed['id']}", headers=platform_hdr)
    assert del_resp.status_code == 200


def test_unit3_cms_questions_csv_and_clil_resources(client: TestClient) -> None:
    teacher_hdr, _ = _auth_headers(client, "hai.gv@demo.scilingo.vn", "Teacher123!")
    cgb_admin_hdr, _ = _auth_headers(client, "hung.bgh@demo.scilingo.vn", "Admin123!")
    nt_admin_hdr, _ = _auth_headers(client, "lan.bgh@demo.scilingo.vn", "Admin123!")
    platform_hdr, _ = _auth_headers(client, "phamhaihnue95@gmail.com", "Hamberger23")

    # Platform admin creates an official question; school_admin cannot modify it
    official_q = client.post(
        "/api/v1/lms/cms/questions",
        headers=platform_hdr,
        json={
            "grade": 8,
            "lesson_no": 8,
            "language": "en",
            "cognitive_level": "know",
            "discipline": "chemistry",
            "prompt_text": "What is the IUPAC name for NaOH?",
            "options": [
                "Sodium hydroxide",
                "Natri hiđroxit",
                "Calcium hydroxide",
                "Potassium chloride",
            ],
            "correct_index": 0,
            "explanation_vi": "NaOH có danh pháp quốc tế là Sodium hydroxide.",
            "is_official": True,
        },
    )
    assert official_q.status_code == 201
    q_id = official_q.json()["id"]
    assert official_q.json()["is_official"] is True
    assert official_q.json()["linter_verified"] is False  # option B had legacy spelling

    # Fix option B and re-verify linter_verified turns True
    fixed_q = client.patch(
        f"/api/v1/lms/cms/questions/{q_id}",
        headers=platform_hdr,
        json={
            "options": [
                "Sodium hydroxide",
                "Sodium oxide",
                "Calcium hydroxide",
                "Potassium chloride",
            ],
            "correct_index": 0,
        },
    )
    assert fixed_q.status_code == 200
    assert fixed_q.json()["linter_verified"] is True

    assert (
        client.patch(
            f"/api/v1/lms/cms/questions/{q_id}",
            headers=cgb_admin_hdr,
            json={"prompt_text": "Attempt override official question?"},
        ).status_code
        == 403
    )

    # CSV import creates 1 clean + 1 flagged question in teacher's tenant
    csv_body = (
        "grade,lesson_no,language,cognitive_level,discipline,prompt_text,"
        "option_a,option_b,option_c,option_d,correct_index,explanation_vi\n"
        '8,8,en,know,chemistry,"Name of HCl solution?",Hydrochloric acid,Nitric acid,'
        "Sulfuric acid,Acetic acid,A,Chuẩn IUPAC.\n"
        '8,8,vi,know,chemistry,"Công thức axit sunfuric?",H2SO4,HCl,HNO3,NaOH,0,'
        "Cố tình dùng chữ axit để kiểm tra cờ cảnh báo.\n"
    )
    imp_resp = client.post(
        "/api/v1/lms/cms/questions/import-csv",
        headers=teacher_hdr,
        json={"csv_content": csv_body, "is_official": False},
    )
    assert imp_resp.status_code == 200
    imp_data = imp_resp.json()
    assert imp_data["imported_count"] == 2
    assert imp_data["verified_count"] == 1
    assert imp_data["flagged_count"] == 1

    # Tenant CLIL resource CRUD + isolation from other school tenant
    res_create = client.post(
        "/api/v1/lms/cms/resources",
        headers=cgb_admin_hdr,
        json={
            "grade": 8,
            "lesson_no": 15,
            "title": "Phiếu học tập Áp suất (Pressure - Pa)",
            "resource_type": "worksheet",
            "clil_mode": "bilingual_50",
            "content_markdown": "# Pressure\nCalculate pressure in **Pascal (Pa = N/m²)**.",
            "is_official": False,
        },
    )
    assert res_create.status_code == 201
    res_id = res_create.json()["id"]
    assert res_create.json()["lint_report"]["passed"] is True

    # Other school admin cannot edit or delete CGB resource
    assert (
        client.delete(f"/api/v1/lms/cms/resources/{res_id}", headers=nt_admin_hdr).status_code
        == 403
    )
    assert (
        client.delete(f"/api/v1/lms/cms/resources/{res_id}", headers=cgb_admin_hdr).status_code
        == 200
    )


def test_unit5_cms_tenants_users_csv_and_audit_logs(client: TestClient) -> None:
    platform_hdr, _ = _auth_headers(client, "phamhaihnue95@gmail.com", "Hamberger23")

    ov_resp = client.get("/api/v1/identity/cms/overview", headers=platform_hdr)
    assert ov_resp.status_code == 200
    ov = ov_resp.json()
    assert ov["scope"] == "platform"
    assert ov["total_grades"] == 4
    assert ov["total_lessons"] == 190

    tenant_resp = client.post(
        "/api/v1/identity/cms/tenants",
        headers=platform_hdr,
        json={
            "name": "Trường THCS Dịch Vọng Hậu",
            "tenant_type": "school",
            "province": "Hà Nội",
            "district": "Cầu Giấy",
            "target_tt94_level": 2,
            "plan_code": "school_l2",
            "ai_monthly_quota": 6000,
        },
    )
    assert tenant_resp.status_code == 201
    new_tenant_id = tenant_resp.json()["id"]

    csv_users = (
        "email,full_name,role,grade_level,password\n"
        "mai.hs7@dvh.scilingo.vn,Nguyễn Phương Mai,student,7,Student123!\n"
        "tuan.gv@dvh.scilingo.vn,Phạm Anh Tuấn,teacher,,Teacher123!\n"
    )
    csv_resp = client.post(
        "/api/v1/identity/cms/users/import-csv",
        headers=platform_hdr,
        json={"csv_content": csv_users, "tenant_id": new_tenant_id},
    )
    assert csv_resp.status_code == 200
    assert csv_resp.json()["created_count"] == 2

    logs_resp = client.get("/api/v1/identity/cms/audit-logs?limit=20", headers=platform_hdr)
    assert logs_resp.status_code == 200
    summaries = [item["summary"] for item in logs_resp.json()]
    assert any("Dịch Vọng Hậu" in s for s in summaries)
    assert any("Import CSV" in s for s in summaries)


def test_traffic_tracking_and_user_delete_management(client: TestClient) -> None:
    stu_hdr, _ = _auth_headers(client, "an.hs8@demo.scilingo.vn", "Student123!")
    nt_admin_hdr, nt_admin_data = _auth_headers(client, "lan.bgh@demo.scilingo.vn", "Admin123!")
    cgb_admin_hdr, _ = _auth_headers(client, "hung.bgh@demo.scilingo.vn", "Admin123!")
    platform_hdr, platform_data = _auth_headers(client, "phamhaihnue95@gmail.com", "Hamberger23")

    # Login incremented login_count and set last_login_at
    assert platform_data["user"]["login_count"] >= 1
    assert platform_data["user"]["last_login_at"] is not None

    # Anonymous mobile visitor page view
    anon_track = client.post(
        "/api/v1/analytics/track",
        json={
            "visitor_id": "anon-device-01",
            "event_type": "page_view",
            "path": "/khtn-8",
            "grade": 8,
            "device_type": "mobile",
        },
    )
    assert anon_track.status_code == 200

    # Authenticated student lesson view in CGB tenant
    stu_track = client.post(
        "/api/v1/analytics/track",
        headers=stu_hdr,
        json={
            "visitor_id": "stu-device-01",
            "event_type": "lesson_view",
            "path": "/khtn-8/bai-8",
            "grade": 8,
            "device_type": "desktop",
        },
    )
    assert stu_track.status_code == 200

    # Platform admin sees all traffic including anonymous mobile visit and student logins
    traffic_resp = client.get("/api/v1/identity/cms/traffic?days=7", headers=platform_hdr)
    assert traffic_resp.status_code == 200
    traffic = traffic_resp.json()
    assert traffic["scope"] == "platform"
    assert len(traffic["daily_series"]) == 7
    assert traffic["visits_today"] >= 2
    assert traffic["device_breakdown"]["mobile"] >= 1
    assert traffic["grade_breakdown"]["8"] >= 2
    assert any(p["path"] == "/khtn-8/bai-8" for p in traffic["top_pages"])

    # School B admin sees only School B events (not CGB's student lesson view)
    nt_traffic = client.get("/api/v1/identity/cms/traffic?days=7", headers=nt_admin_hdr).json()
    assert nt_traffic["scope"] == "school"
    nt_paths = {ev["path"] for ev in nt_traffic["recent_events"]}
    assert "/khtn-8/bai-8" not in nt_paths

    # Create a temporary student, reset password, test login, then delete via CMS
    created = client.post(
        "/api/v1/identity/cms/users",
        headers=cgb_admin_hdr,
        json={
            "email": "temp.hs8@demo.scilingo.vn",
            "password": "TempPass123!",
            "full_name": "Tài khoản thử nghiệm",
            "role": "student",
            "grade_level": 8,
        },
    )
    assert created.status_code == 201
    temp_uid = created.json()["id"]

    # Other school admin cannot delete CGB user
    assert (
        client.delete(f"/api/v1/identity/cms/users/{temp_uid}", headers=nt_admin_hdr).status_code
        == 403
    )

    # Admin cannot self-delete
    assert (
        client.delete(
            f"/api/v1/identity/cms/users/{platform_data['user']['id']}",
            headers=platform_hdr,
        ).status_code
        == 400
    )

    # CGB admin deletes temporary student cleanly
    del_resp = client.delete(f"/api/v1/identity/cms/users/{temp_uid}", headers=cgb_admin_hdr)
    assert del_resp.status_code == 200
    assert (
        client.delete(
            f"/api/v1/identity/cms/users/{nt_admin_data['user']['id']}",
            headers=cgb_admin_hdr,
        ).status_code
        == 403
    )

"""CMS Phase 3 tests: DB-backed Study Pack CRUD, CSV exports, and traffic pruning."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.modules.identity_billing.models import AccessEvent


def _auth_headers(client: TestClient, email: str, password: str) -> dict[str, str]:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def test_cms_study_pack_crud_and_public_reflection(client: TestClient) -> None:
    settings = get_settings()
    platform_hdr = _auth_headers(
        client, settings.platform_admin_email, settings.platform_admin_password
    )
    school_hdr = _auth_headers(client, "hung.bgh@demo.scilingo.vn", "Admin123!")

    # School admin can read CMS study pack list, but cannot mutate
    list_resp = client.get(
        "/api/v1/curriculum/cms/study-pack/items?unit_no=1",
        headers=school_hdr,
    )
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 44

    blocked_create = client.post(
        "/api/v1/curriculum/cms/study-pack/items",
        headers=school_hdr,
        json={
            "unit_no": 1,
            "term_en": "nebula",
            "ipa": "/ˈneb.jə.lə/",
            "pos": "n",
            "meaning_vi": "tinh vân",
        },
    )
    assert blocked_create.status_code == 403

    # Platform admin creates a new item in Unit 1 (linter passes clean content)
    created = client.post(
        "/api/v1/curriculum/cms/study-pack/items",
        headers=platform_hdr,
        json={
            "unit_no": 1,
            "term_en": "exoplanet",
            "ipa": "/ˈek.səʊˌplæn.ɪt/",
            "pos": "n",
            "meaning_vi": "ngoại hành tinh",
            "iupac_note": "Đo khoảng cách thiên văn theo đơn vị SI (m) hoặc AU.",
        },
    )
    assert created.status_code == 201, created.text
    created_data = created.json()
    item_id = created_data["item"]["id"]
    assert created_data["item"]["order_no"] == 45
    assert created_data["lint_report"]["passed"] is True

    # Public Unit 1 endpoint now shows 45 items including 'exoplanet'
    u1_public = client.get("/api/v1/study-packs/english-science/units/1").json()
    assert u1_public["unit"]["item_count"] == 45
    assert any(it["term_en"] == "exoplanet" for it in u1_public["items"])

    # Update item with legacy phrasing triggers warning inside lint_report
    updated = client.patch(
        f"/api/v1/curriculum/cms/study-pack/items/{item_id}",
        headers=platform_hdr,
        json={"meaning_vi": "ngoại hành tinh chứa oxi"},
    )
    assert updated.status_code == 200
    assert updated.json()["lint_report"]["passed"] is False

    # Delete restores Unit 1 back to 44 items
    deleted = client.delete(
        f"/api/v1/curriculum/cms/study-pack/items/{item_id}",
        headers=platform_hdr,
    )
    assert deleted.status_code == 200
    u1_after = client.get("/api/v1/study-packs/english-science/units/1").json()
    assert u1_after["unit"]["item_count"] == 44


def test_cms_csv_exports_utf8_bom_and_tenant_scope(client: TestClient) -> None:
    settings = get_settings()
    platform_hdr = _auth_headers(
        client, settings.platform_admin_email, settings.platform_admin_password
    )
    cgb_admin_hdr = _auth_headers(client, "hung.bgh@demo.scilingo.vn", "Admin123!")
    teacher_hdr = _auth_headers(client, "hai.gv@demo.scilingo.vn", "Teacher123!")

    # Users CSV export: school admin sees CGB users only, never NT admin
    cgb_users_csv = client.get("/api/v1/identity/cms/users/export-csv", headers=cgb_admin_hdr)
    assert cgb_users_csv.status_code == 200
    assert "text/csv" in cgb_users_csv.headers["content-type"]
    users_text = cgb_users_csv.content.decode("utf-8")
    assert users_text.startswith("\ufeffemail,full_name,role,")
    assert "an.hs8@demo.scilingo.vn" in users_text
    assert "lan.bgh@demo.scilingo.vn" not in users_text

    # Traffic CSV export
    traffic_csv = client.get("/api/v1/identity/cms/traffic/export-csv?days=7", headers=platform_hdr)
    assert traffic_csv.status_code == 200
    traffic_text = traffic_csv.content.decode("utf-8")
    assert traffic_text.startswith("\ufeffdate,visits,unique_visitors,logins")

    # TT94 Compliance CSV export
    tt94_csv = client.get(
        "/api/v1/lms/reports/tt94-compliance/export-csv?academic_year=2026-2027",
        headers=teacher_hdr,
    )
    assert tt94_csv.status_code == 200
    tt94_text = tt94_csv.content.decode("utf-8")
    assert tt94_text.startswith("\ufeffschool_name,")
    assert "Trường THCS Cầu Giấy B" in tt94_text
    assert "classroom_name,is_tt94_pilot_class," in tt94_text


def test_prune_access_events_retention_and_rbac(
    client: TestClient, test_db_session: Session
) -> None:
    settings = get_settings()
    platform_hdr = _auth_headers(
        client, settings.platform_admin_email, settings.platform_admin_password
    )
    school_hdr = _auth_headers(client, "hung.bgh@demo.scilingo.vn", "Admin123!")

    now = datetime.now(UTC)
    old_event = AccessEvent(
        visitor_id="old-visitor-120d",
        event_type="page_view",
        path="/khtn-8",
        grade=8,
        device_type="desktop",
        created_at=now - timedelta(days=120),
    )
    recent_event = AccessEvent(
        visitor_id="recent-visitor-5d",
        event_type="page_view",
        path="/khtn-9",
        grade=9,
        device_type="mobile",
        created_at=now - timedelta(days=5),
    )
    test_db_session.add_all([old_event, recent_event])
    test_db_session.commit()
    old_id = old_event.id
    recent_id = recent_event.id

    # School admin is forbidden from platform-wide pruning
    assert (
        client.post(
            "/api/v1/identity/cms/traffic/prune",
            headers=school_hdr,
            json={"retention_days": 90},
        ).status_code
        == 403
    )

    prune_resp = client.post(
        "/api/v1/identity/cms/traffic/prune",
        headers=platform_hdr,
        json={"retention_days": 90},
    )
    assert prune_resp.status_code == 200
    assert prune_resp.json()["deleted_count"] >= 1

    test_db_session.expire_all()
    assert test_db_session.get(AccessEvent, old_id) is None
    assert test_db_session.get(AccessEvent, recent_id) is not None

    logs = client.get("/api/v1/identity/cms/audit-logs?limit=10", headers=platform_hdr).json()
    assert any(log["entity_type"] == "access_events" and log["action"] == "prune" for log in logs)

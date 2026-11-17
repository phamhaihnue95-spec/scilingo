"""Gate 2B tests for Unit 5: Auth, JWT, RBAC, multi-tenant isolation, and Alembic migration."""

from __future__ import annotations

from pathlib import Path

from alembic.config import Config
from fastapi.testclient import TestClient

from alembic import command


def _login(client: TestClient, email: str, password: str) -> dict:
    resp = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()


def test_healthcheck_ok(client: TestClient) -> None:
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_public_registration_and_privilege_escalation_blocked(client: TestClient) -> None:
    # Attempting to self-register as school_admin must fail validation
    bad_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "attacker@example.com",
            "password": "Password123!",
            "full_name": "Bad Actor",
            "role": "school_admin",
            "grade_level": 8,
        },
    )
    assert bad_resp.status_code == 422

    # Valid student registration
    ok_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "student.new@example.com",
            "password": "Password123!",
            "full_name": "Phạm Gia Bảo",
            "role": "student",
            "grade_level": 8,
        },
    )
    assert ok_resp.status_code == 201
    session_data = ok_resp.json()
    assert session_data["user"]["role"] == "student"
    assert session_data["tenant"]["tenant_type"] == "b2c_individual"

    # Duplicate email returns 409
    dup_resp = client.post(
        "/api/v1/auth/register",
        json={
            "email": "student.new@example.com",
            "password": "Password123!",
            "full_name": "Phạm Gia Bảo",
            "role": "student",
            "grade_level": 8,
        },
    )
    assert dup_resp.status_code == 409


def test_login_refresh_and_entitlements(client: TestClient) -> None:
    login_data = _login(client, "minh.gv@demo.scilingo.vn", "Teacher123!")
    headers = {"Authorization": f"Bearer {login_data['access_token']}"}

    me_resp = client.get("/api/v1/auth/me", headers=headers)
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == "minh.gv@demo.scilingo.vn"

    ent_resp = client.get("/api/v1/tenants/me/entitlements", headers=headers)
    assert ent_resp.status_code == 200
    ent = ent_resp.json()
    assert ent["plan_code"] == "school_l2"
    assert "exam_builder_tt94" in ent["features"]

    refresh_resp = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": login_data["refresh_token"]},
    )
    assert refresh_resp.status_code == 200
    assert refresh_resp.json()["access_token"]


def test_rbac_and_tenant_isolation(client: TestClient) -> None:
    student = _login(client, "an.hs8@demo.scilingo.vn", "Student123!")
    teacher = _login(client, "minh.gv@demo.scilingo.vn", "Teacher123!")
    cva_admin = _login(client, "hung.bgh@demo.scilingo.vn", "Admin123!")
    nt_admin = _login(client, "lan.bgh@demo.scilingo.vn", "Admin123!")

    # Student and teacher cannot list tenant users
    assert (
        client.get(
            "/api/v1/tenants/me/users",
            headers={"Authorization": f"Bearer {student['access_token']}"},
        ).status_code
        == 403
    )
    assert (
        client.get(
            "/api/v1/tenants/me/users",
            headers={"Authorization": f"Bearer {teacher['access_token']}"},
        ).status_code
        == 403
    )

    # Tenant A admin only sees Tenant A users
    cva_users_resp = client.get(
        "/api/v1/tenants/me/users",
        headers={"Authorization": f"Bearer {cva_admin['access_token']}"},
    )
    assert cva_users_resp.status_code == 200
    cva_emails = {u["email"] for u in cva_users_resp.json()}
    assert "an.hs8@demo.scilingo.vn" in cva_emails
    assert "minh.gv@demo.scilingo.vn" in cva_emails
    assert "lan.bgh@demo.scilingo.vn" not in cva_emails

    # Tenant B admin only sees Tenant B users
    nt_users_resp = client.get(
        "/api/v1/tenants/me/users",
        headers={"Authorization": f"Bearer {nt_admin['access_token']}"},
    )
    assert nt_users_resp.status_code == 200
    nt_emails = {u["email"] for u in nt_users_resp.json()}
    assert nt_emails == {"lan.bgh@demo.scilingo.vn"}


def test_alembic_upgrade_head_sqlite(tmp_path: Path, monkeypatch) -> None:
    db_path = tmp_path / "alembic_verify.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path}")

    from app.core.config import get_settings

    get_settings.cache_clear()
    try:
        alembic_cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
        command.upgrade(alembic_cfg, "head")
        assert db_path.exists()
    finally:
        get_settings.cache_clear()

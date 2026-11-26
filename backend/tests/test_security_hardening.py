"""Security hardening tests: no hardcoded admin password & rate-limit enforcement."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker

from app.core.config import Settings, get_settings
from app.core.database import Base, create_engine_for_url
from app.core.rate_limit import rate_limiter
from app.core.security import hash_password
from app.modules.identity_billing.models import Tenant, User
from app.seed import seed_demo_tenants


def test_platform_admin_password_not_hardcoded_in_settings(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("PLATFORM_ADMIN_PASSWORD", raising=False)
    fresh = Settings(_env_file=None)
    assert fresh.platform_admin_password == ""


def test_seed_without_platform_admin_password_skips_bootstrap_and_preserves_existing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db_file = tmp_path / "seed_security.db"
    engine = create_engine_for_url(f"sqlite:///{db_file}")
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(
        bind=engine, autoflush=False, autocommit=False, expire_on_commit=False
    )

    monkeypatch.setenv("PLATFORM_ADMIN_PASSWORD", "")
    get_settings.cache_clear()
    try:
        with SessionLocal() as db:
            seed_demo_tenants(db)
            admin_email = get_settings().platform_admin_email.lower().strip()
            assert db.scalar(select(User).where(User.email == admin_email)) is None

            # If an admin already exists, empty PLATFORM_ADMIN_PASSWORD keeps existing hash intact
            cgb = db.scalar(select(Tenant))
            assert cgb is not None
            custom_hash = hash_password("KeepExistingHash999!")
            db.add(
                User(
                    tenant_id=cgb.id,
                    email=admin_email,
                    password_hash=custom_hash,
                    full_name="Existing Admin",
                    role="platform_admin",
                    is_active=True,
                )
            )
            db.commit()

            seed_demo_tenants(db)
            refreshed = db.scalar(select(User).where(User.email == admin_email))
            assert refreshed is not None
            assert refreshed.password_hash == custom_hash
    finally:
        get_settings.cache_clear()
        engine.dispose()


def test_rate_limit_enforced_on_login_and_analytics(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    rate_limiter.reset()
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    get_settings.cache_clear()
    try:
        for _ in range(15):
            resp = client.post(
                "/api/v1/auth/login",
                json={"email": "an.hs8@demo.scilingo.vn", "password": "WrongPassword!"},
            )
            assert resp.status_code == 401

        limited_login = client.post(
            "/api/v1/auth/login",
            json={"email": "an.hs8@demo.scilingo.vn", "password": "WrongPassword!"},
        )
        assert limited_login.status_code == 429
        assert int(limited_login.headers["Retry-After"]) >= 1

        for _ in range(60):
            ok_track = client.post(
                "/api/v1/analytics/track",
                json={
                    "visitor_id": "rate-test-visitor",
                    "event_type": "page_view",
                    "path": "/khtn-8",
                    "grade": 8,
                    "device_type": "desktop",
                },
            )
            assert ok_track.status_code == 200

        limited_track = client.post(
            "/api/v1/analytics/track",
            json={
                "visitor_id": "rate-test-visitor",
                "event_type": "page_view",
                "path": "/khtn-8",
                "grade": 8,
                "device_type": "desktop",
            },
        )
        assert limited_track.status_code == 429
        assert int(limited_track.headers["Retry-After"]) >= 1
    finally:
        rate_limiter.reset()
        monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
        get_settings.cache_clear()

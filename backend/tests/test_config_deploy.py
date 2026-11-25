"""Deployment configuration tests for Render PostgreSQL URL and CORS parsing."""

from __future__ import annotations

from pathlib import Path

from app.core.config import Settings

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def test_settings_normalizes_render_postgres_urls() -> None:
    s1 = Settings(database_url="postgres://user:pass@dpg-123:5432/db")
    assert s1.database_url == "postgresql+psycopg://user:pass@dpg-123:5432/db"

    s2 = Settings(database_url="postgresql://user:pass@dpg-123:5432/db")
    assert s2.database_url == "postgresql+psycopg://user:pass@dpg-123:5432/db"


def test_settings_parses_csv_and_json_cors_origins() -> None:
    s_csv = Settings(
        cors_origins="https://khtn.scilingo-edu.workers.dev, http://localhost:5173"  # type: ignore[arg-type]
    )
    assert s_csv.cors_origins == [
        "https://khtn.scilingo-edu.workers.dev",
        "http://localhost:5173",
    ]

    s_json = Settings(
        cors_origins='["https://khtn.scilingo-edu.workers.dev"]'  # type: ignore[arg-type]
    )
    assert s_json.cors_origins == ["https://khtn.scilingo-edu.workers.dev"]


def test_default_cors_and_render_yaml_use_cloudflare_worker_origin() -> None:
    default_settings = Settings()
    assert "https://khtn.scilingo-edu.workers.dev" in default_settings.cors_origins
    assert all("phamhaihnue95-spec" not in origin for origin in default_settings.cors_origins)

    render_text = (REPO_ROOT / "render.yaml").read_text(encoding="utf-8")
    assert "https://khtn.scilingo-edu.workers.dev" in render_text
    assert "phamhaihnue95-spec" not in render_text


def test_production_deploy_files_exist() -> None:
    assert (REPO_ROOT / "render.yaml").is_file()
    assert (REPO_ROOT / ".dockerignore").is_file()
    assert (REPO_ROOT / "backend" / "Dockerfile").is_file()
    assert (REPO_ROOT / "backend" / "entrypoint.sh").is_file()
    assert (REPO_ROOT / ".github" / "workflows" / "deploy-cloudflare.yml").is_file()
    assert (REPO_ROOT / "scripts" / "deploy_cloudflare_worker.mjs").is_file()
    assert not (REPO_ROOT / ".github" / "workflows" / "deploy-pages.yml").exists()

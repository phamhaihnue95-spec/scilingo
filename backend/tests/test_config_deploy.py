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
        cors_origins="https://phamhaihnue95-spec.github.io, http://localhost:5173"  # type: ignore[arg-type]
    )
    assert s_csv.cors_origins == [
        "https://phamhaihnue95-spec.github.io",
        "http://localhost:5173",
    ]

    s_json = Settings(
        cors_origins='["https://phamhaihnue95-spec.github.io"]'  # type: ignore[arg-type]
    )
    assert s_json.cors_origins == ["https://phamhaihnue95-spec.github.io"]


def test_production_deploy_files_exist() -> None:
    assert (REPO_ROOT / "render.yaml").is_file()
    assert (REPO_ROOT / ".dockerignore").is_file()
    assert (REPO_ROOT / "backend" / "Dockerfile").is_file()
    assert (REPO_ROOT / "backend" / "entrypoint.sh").is_file()
    assert (REPO_ROOT / ".github" / "workflows" / "deploy-pages.yml").is_file()

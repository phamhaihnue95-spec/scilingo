"""Application configuration loaded from environment variables."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Resolve workspace root: backend/app/core/config.py -> repo root
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
REPO_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime settings for the SciLingo KHTN 8 FastAPI service."""

    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SciLingo KHTN 6–9 API"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"

    database_url: str = (
        "postgresql+psycopg://scilingo:scilingo_dev_password@localhost:5432/scilingo_khtn8"
    )
    jwt_secret_key: str = "dev-only-insecure-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7
    rate_limit_enabled: bool = True

    platform_admin_email: str = "phamhaihnue95@gmail.com"
    platform_admin_password: str = ""
    platform_admin_full_name: str = "Phạm Thị Hải (Quản trị hệ thống)"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://khtn.scilingo-edu.workers.dev",
    ]
    data_dir: Path = REPO_ROOT / "data"

    @field_validator("database_url", mode="before")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        """Convert Render/Heroku postgres:// or postgresql:// URLs to psycopg v3 dialect."""
        raw = str(value).strip()
        if raw.startswith("postgres://"):
            return "postgresql+psycopg://" + raw.removeprefix("postgres://")
        if raw.startswith("postgresql://"):
            return "postgresql+psycopg://" + raw.removeprefix("postgresql://")
        return raw

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        """Allow either JSON array or comma-separated origins in CORS_ORIGINS env var."""
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        raw = str(value).strip()
        if not raw:
            return []
        if raw.startswith("["):
            parsed = json.loads(raw)
            return [str(item).strip() for item in parsed if str(item).strip()]
        return [item.strip() for item in raw.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()

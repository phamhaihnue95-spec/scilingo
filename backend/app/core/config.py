"""Application configuration loaded from environment variables."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve workspace root: backend/app/core/config.py -> KHTN/
BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
REPO_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Runtime settings for the SciLingo KHTN 8 FastAPI service."""

    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SciLingo KHTN 8 API"
    api_v1_prefix: str = "/api/v1"
    environment: str = "development"

    database_url: str = (
        "postgresql+psycopg://scilingo:scilingo_dev_password@localhost:5432/scilingo_khtn8"
    )
    jwt_secret_key: str = "dev-only-insecure-secret-change-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]
    data_dir: Path = REPO_ROOT / "data"


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()

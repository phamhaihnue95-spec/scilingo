"""FastAPI application entry point for SciLingo KHTN 8."""

from __future__ import annotations

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.modules.curriculum.router import router as curriculum_router
from app.modules.identity_billing.router import router as identity_router
from app.modules.learning.router import router as learning_router
from app.modules.lms.router import router as lms_router


def create_app() -> FastAPI:
    """Create and configure the modular monolith FastAPI application."""
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description=(
            "SciLingo KHTN 8 API — Học & Dạy Tiếng Anh Khoa học tự nhiên THCS "
            "(SGK Kết nối tri thức, chuẩn IUPAC/SI & Thông tư 94/2026/TT-BGDĐT)."
        ),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get(f"{settings.api_v1_prefix}/health", tags=["System"])
    def healthcheck(db: Session = Depends(get_db)) -> dict[str, str]:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "dialect": db.bind.dialect.name if db.bind else "unknown"}

    app.include_router(identity_router, prefix=settings.api_v1_prefix)
    app.include_router(curriculum_router, prefix=settings.api_v1_prefix)
    app.include_router(learning_router, prefix=settings.api_v1_prefix)
    app.include_router(lms_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()

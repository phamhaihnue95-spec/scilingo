"""Shared pytest fixtures for SciLingo KHTN 8 Bolt 1 test suite."""

from __future__ import annotations

from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.core.database import Base, create_engine_for_url, get_db
from app.main import create_app
from app.seed import seed_all


@pytest.fixture()
def test_db_session(tmp_path: Path) -> Generator[Session, None, None]:
    """Provide an isolated seeded SQLite database session per test module/function."""
    db_file = tmp_path / "test_scilingo.db"
    engine = create_engine_for_url(f"sqlite:///{db_file}")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )
    session = TestingSessionLocal()
    seed_all(session, data_dir=get_settings().data_dir)
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture()
def client(test_db_session: Session) -> Generator[TestClient, None, None]:
    """FastAPI TestClient wired to the isolated seeded test database."""
    app = create_app()

    def _override_get_db() -> Generator[Session, None, None]:
        yield test_db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

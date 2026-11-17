"""Database engine, session factory, and schema translation helpers."""

from __future__ import annotations

from collections.abc import Generator
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

SCHEMA_TRANSLATION_MAP: dict[str, str | None] = {
    "identity_billing": None,
    "curriculum": None,
    "learning": None,
}


class Base(DeclarativeBase):
    """Shared declarative base for all Bounded Context ORM models."""


def create_engine_for_url(database_url: str, **kwargs: Any) -> Engine:
    """Create a SQLAlchemy engine supporting both PostgreSQL schemas and SQLite test fallback."""
    if database_url.startswith("sqlite"):
        connect_args = kwargs.pop("connect_args", {"check_same_thread": False})
        engine = create_engine(database_url, connect_args=connect_args, **kwargs)
        engine = engine.execution_options(schema_translate_map=SCHEMA_TRANSLATION_MAP)

        @event.listens_for(engine, "connect")
        def _enable_sqlite_fks(dbapi_connection: Any, _connection_record: Any) -> None:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        return engine

    return create_engine(database_url, pool_pre_ping=True, **kwargs)


_engine: Engine | None = None
_session_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    """Lazily initialize the default application SQLAlchemy engine."""
    global _engine
    if _engine is None:
        settings = get_settings()
        _engine = create_engine_for_url(settings.database_url)
    return _engine


def get_session_factory() -> sessionmaker[Session]:
    """Return a configured sessionmaker bound to the default engine."""
    global _session_factory
    if _session_factory is None:
        _session_factory = sessionmaker(
            bind=get_engine(),
            autoflush=False,
            autocommit=False,
            expire_on_commit=False,
        )
    return _session_factory


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a scoped SQLAlchemy session."""
    session = get_session_factory()()
    try:
        yield session
    finally:
        session.close()

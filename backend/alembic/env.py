"""Alembic environment supporting PostgreSQL schemas and SQLite dev/test fallback."""

from __future__ import annotations

from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool

from app.core.config import get_settings
from app.core.database import SCHEMA_TRANSLATION_MAP, Base, create_engine_for_url
from app.modules.curriculum import models as curriculum_models  # noqa: F401
from app.modules.identity_billing import models as identity_models  # noqa: F401
from app.modules.learning import models as learning_models  # noqa: F401
from app.modules.lms import models as lms_models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_url() -> str:
    return get_settings().database_url


def run_migrations_offline() -> None:
    url = get_url()
    is_sqlite = url.startswith("sqlite")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        include_schemas=not is_sqlite,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = get_url()
    is_sqlite = url.startswith("sqlite")
    connectable = create_engine_for_url(url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        opts: dict[str, object] = {
            "connection": connection,
            "target_metadata": target_metadata,
            "include_schemas": not is_sqlite,
        }
        if is_sqlite:
            opts["schema_translate_map"] = SCHEMA_TRANSLATION_MAP
        else:
            opts["version_table_schema"] = "public"

        context.configure(**opts)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

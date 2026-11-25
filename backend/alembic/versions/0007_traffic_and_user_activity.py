"""Add traffic access_events table and user activity tracking columns.

Revision ID: 0007_traffic_and_user_activity
Revises: 0006_cms_audit_logs
Create Date: 2026-11-25

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0007_traffic_and_user_activity"
down_revision: str | Sequence[str] | None = "0006_cms_audit_logs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    is_pg = _is_postgres()
    schema_identity = "identity_billing" if is_pg else None
    tenant_fk = "identity_billing.tenants.id" if is_pg else "tenants.id"
    user_fk = "identity_billing.users.id" if is_pg else "users.id"

    with op.batch_alter_table("users", schema=schema_identity) as batch_op:
        batch_op.add_column(sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(
            sa.Column("login_count", sa.Integer(), nullable=False, server_default="0")
        )

    op.create_table(
        "access_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("visitor_id", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("tenant_id", sa.String(length=36), nullable=True),
        sa.Column("event_type", sa.String(length=32), nullable=False),
        sa.Column("path", sa.String(length=160), nullable=False, server_default="/"),
        sa.Column("grade", sa.Integer(), nullable=True),
        sa.Column("device_type", sa.String(length=16), nullable=False, server_default="desktop"),
        sa.Column("referrer", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], [tenant_fk], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], [user_fk], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        schema=schema_identity,
    )
    op.create_index(
        "ix_access_events_created_at",
        "access_events",
        ["created_at"],
        schema=schema_identity,
    )
    op.create_index(
        "ix_access_events_visitor_id",
        "access_events",
        ["visitor_id"],
        schema=schema_identity,
    )
    op.create_index(
        "ix_access_events_tenant_id",
        "access_events",
        ["tenant_id"],
        schema=schema_identity,
    )
    op.create_index(
        "ix_access_events_event_type",
        "access_events",
        ["event_type"],
        schema=schema_identity,
    )


def downgrade() -> None:
    schema_identity = "identity_billing" if _is_postgres() else None
    op.drop_index("ix_access_events_event_type", table_name="access_events", schema=schema_identity)
    op.drop_index("ix_access_events_tenant_id", table_name="access_events", schema=schema_identity)
    op.drop_index("ix_access_events_visitor_id", table_name="access_events", schema=schema_identity)
    op.drop_index("ix_access_events_created_at", table_name="access_events", schema=schema_identity)
    op.drop_table("access_events", schema=schema_identity)

    with op.batch_alter_table("users", schema=schema_identity) as batch_op:
        batch_op.drop_column("login_count")
        batch_op.drop_column("last_login_at")

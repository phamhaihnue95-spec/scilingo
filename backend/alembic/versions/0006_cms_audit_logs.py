"""Add cms_audit_logs table in identity_billing for CMS audit trail.

Revision ID: 0006_cms_audit_logs
Revises: 0005_student_pets
Create Date: 2026-11-25

"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006_cms_audit_logs"
down_revision: str | Sequence[str] | None = "0005_student_pets"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def upgrade() -> None:
    is_pg = _is_postgres()
    schema_identity = "identity_billing" if is_pg else None
    tenant_fk = "identity_billing.tenants.id" if is_pg else "tenants.id"
    user_fk = "identity_billing.users.id" if is_pg else "users.id"

    op.create_table(
        "cms_audit_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.String(length=36), nullable=True),
        sa.Column("actor_user_id", sa.String(length=36), nullable=True),
        sa.Column("actor_email", sa.String(length=255), nullable=False),
        sa.Column("actor_name", sa.String(length=150), nullable=False),
        sa.Column("module", sa.String(length=32), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("entity_type", sa.String(length=48), nullable=False),
        sa.Column("entity_id", sa.String(length=64), nullable=False),
        sa.Column("summary", sa.String(length=500), nullable=False),
        sa.Column("diff_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], [tenant_fk], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["actor_user_id"], [user_fk], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        schema=schema_identity,
    )
    op.create_index(
        "ix_cms_audit_logs_tenant_id",
        "cms_audit_logs",
        ["tenant_id"],
        schema=schema_identity,
    )
    op.create_index(
        "ix_cms_audit_logs_module",
        "cms_audit_logs",
        ["module"],
        schema=schema_identity,
    )
    op.create_index(
        "ix_cms_audit_logs_created_at",
        "cms_audit_logs",
        ["created_at"],
        schema=schema_identity,
    )


def downgrade() -> None:
    schema_identity = "identity_billing" if _is_postgres() else None
    op.drop_index(
        "ix_cms_audit_logs_created_at", table_name="cms_audit_logs", schema=schema_identity
    )
    op.drop_index("ix_cms_audit_logs_module", table_name="cms_audit_logs", schema=schema_identity)
    op.drop_index(
        "ix_cms_audit_logs_tenant_id", table_name="cms_audit_logs", schema=schema_identity
    )
    op.drop_table("cms_audit_logs", schema=schema_identity)

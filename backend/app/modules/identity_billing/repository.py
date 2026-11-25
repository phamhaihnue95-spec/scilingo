"""Database access repository for Unit 5 (identity_billing)."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.modules.identity_billing.models import (
    AccessEvent,
    CmsAuditLog,
    Subscription,
    Tenant,
    User,
)


class IdentityRepository:
    """Encapsulates persistence queries for tenants, users, and subscriptions."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_user_by_email(self, email: str) -> User | None:
        stmt = (
            select(User).options(joinedload(User.tenant)).where(User.email == email.lower().strip())
        )
        return self.db.scalar(stmt)

    def get_user_by_id(self, user_id: str) -> User | None:
        stmt = select(User).options(joinedload(User.tenant)).where(User.id == user_id)
        return self.db.scalar(stmt)

    def get_tenant_by_id(self, tenant_id: str) -> Tenant | None:
        return self.db.scalar(select(Tenant).where(Tenant.id == tenant_id))

    def list_users_for_tenant(self, tenant_id: str) -> list[User]:
        stmt = (
            select(User)
            .options(joinedload(User.tenant))
            .where(User.tenant_id == tenant_id)
            .order_by(User.role, User.full_name)
        )
        return list(self.db.scalars(stmt).all())

    def get_users_by_ids(self, user_ids: list[str]) -> dict[str, User]:
        if not user_ids:
            return {}
        stmt = select(User).where(User.id.in_(user_ids))
        return {u.id: u for u in self.db.scalars(stmt).all()}

    def get_active_subscription(self, tenant_id: str) -> Subscription | None:
        stmt = (
            select(Subscription)
            .where(Subscription.tenant_id == tenant_id, Subscription.status == "active")
            .order_by(Subscription.valid_from.desc())
        )
        return self.db.scalar(stmt)

    def create_b2c_account(
        self,
        *,
        email: str,
        password_hash: str,
        full_name: str,
        role: str,
        grade_level: int,
    ) -> tuple[Tenant, User]:
        tenant = Tenant(
            name=f"Cá nhân - {full_name}",
            tenant_type="b2c_individual",
        )
        self.db.add(tenant)
        self.db.flush()

        user = User(
            tenant_id=tenant.id,
            email=email.lower().strip(),
            password_hash=password_hash,
            full_name=full_name.strip(),
            role=role,
            grade_level=grade_level if role == "student" else None,
        )
        subscription = Subscription(
            tenant_id=tenant.id,
            plan_code="free",
            ai_monthly_quota=20,
            ai_used_this_month=0,
            status="active",
        )
        self.db.add_all([user, subscription])
        self.db.commit()
        self.db.refresh(tenant)
        self.db.refresh(user)
        return tenant, user

    # --- CMS Queries & Audit Trail ---
    def list_users_filtered(
        self,
        *,
        tenant_id: str | None = None,
        role: str | None = None,
        q: str | None = None,
        is_active: bool | None = None,
    ) -> list[User]:
        stmt = select(User).options(joinedload(User.tenant))
        if tenant_id is not None:
            stmt = stmt.where(User.tenant_id == tenant_id)
        if role:
            stmt = stmt.where(User.role == role)
        if is_active is not None:
            stmt = stmt.where(User.is_active == is_active)
        if q and q.strip():
            pattern = f"%{q.strip()}%"
            stmt = stmt.where(or_(User.full_name.ilike(pattern), User.email.ilike(pattern)))
        stmt = stmt.order_by(User.created_at.desc(), User.full_name)
        return list(self.db.scalars(stmt).all())

    def delete_user(self, user: User) -> None:
        self.db.delete(user)
        self.db.flush()

    def create_user_in_tenant(self, user: User) -> User:
        self.db.add(user)
        self.db.flush()
        return user

    def list_all_tenants(self) -> list[Tenant]:
        stmt = select(Tenant).order_by(Tenant.tenant_type, Tenant.name)
        return list(self.db.scalars(stmt).all())

    def count_users_by_tenant(self) -> dict[str, int]:
        stmt = select(User.tenant_id, func.count(User.id)).group_by(User.tenant_id)
        return {str(tid): int(cnt or 0) for tid, cnt in self.db.execute(stmt).all()}

    def create_tenant_with_subscription(self, tenant: Tenant, subscription: Subscription) -> Tenant:
        self.db.add(tenant)
        self.db.flush()
        subscription.tenant_id = tenant.id
        self.db.add(subscription)
        self.db.flush()
        return tenant

    def add_audit_log(self, log: CmsAuditLog) -> CmsAuditLog:
        self.db.add(log)
        self.db.flush()
        return log

    def list_audit_logs(
        self,
        *,
        tenant_id: str | None = None,
        module: str | None = None,
        entity_type: str | None = None,
        limit: int = 50,
    ) -> list[CmsAuditLog]:
        stmt = select(CmsAuditLog)
        if tenant_id is not None:
            stmt = stmt.where(CmsAuditLog.tenant_id == tenant_id)
        if module:
            stmt = stmt.where(CmsAuditLog.module == module)
        if entity_type:
            stmt = stmt.where(CmsAuditLog.entity_type == entity_type)
        stmt = stmt.order_by(CmsAuditLog.created_at.desc()).limit(limit)
        return list(self.db.scalars(stmt).all())

    def add_access_event(self, event: AccessEvent) -> AccessEvent:
        self.db.add(event)
        self.db.flush()
        return event

    def list_access_events_since(
        self, *, since: datetime, tenant_id: str | None = None
    ) -> list[AccessEvent]:
        stmt = select(AccessEvent).where(AccessEvent.created_at >= since)
        if tenant_id is not None:
            stmt = stmt.where(AccessEvent.tenant_id == tenant_id)
        stmt = stmt.order_by(AccessEvent.created_at.desc())
        return list(self.db.scalars(stmt).all())

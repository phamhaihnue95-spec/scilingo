"""Database access repository for Unit 5 (identity_billing)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.modules.identity_billing.models import Subscription, Tenant, User


class IdentityRepository:
    """Encapsulates persistence queries for tenants, users, and subscriptions."""

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_user_by_email(self, email: str) -> User | None:
        stmt = (
            select(User)
            .options(joinedload(User.tenant))
            .where(User.email == email.lower().strip())
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
            .where(User.tenant_id == tenant_id)
            .order_by(User.role, User.full_name)
        )
        return list(self.db.scalars(stmt).all())

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

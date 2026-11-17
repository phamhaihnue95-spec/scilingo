"""FastAPI routes for Unit 5 (identity_billing)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.identity_billing.dependencies import get_current_user, require_roles
from app.modules.identity_billing.models import User
from app.modules.identity_billing.schemas import (
    AuthSessionResponse,
    EntitlementsOut,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    UserOut,
)
from app.modules.identity_billing.service import IdentityService

router = APIRouter(tags=["Identity & Billing (Unit 5)"])


@router.post(
    "/auth/register",
    response_model=AuthSessionResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> AuthSessionResponse:
    """Register a new B2C student or teacher account."""
    return IdentityService(db).register(payload)


@router.post("/auth/login", response_model=AuthSessionResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> AuthSessionResponse:
    """Authenticate with email and password."""
    return IdentityService(db).login(payload)


@router.post("/auth/refresh", response_model=AuthSessionResponse)
def refresh(payload: RefreshRequest, db: Session = Depends(get_db)) -> AuthSessionResponse:
    """Issue a new access/refresh token pair from a valid refresh token."""
    return IdentityService(db).refresh(payload.refresh_token)


@router.get("/auth/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)) -> UserOut:
    """Return the authenticated user's profile."""
    return UserOut.model_validate(current_user)


@router.get("/tenants/me/entitlements", response_model=EntitlementsOut)
def get_my_entitlements(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> EntitlementsOut:
    """Return the current tenant's subscription plan, AI quota, and unlocked features."""
    return IdentityService(db).get_entitlements(current_user)


@router.get("/tenants/me/users", response_model=list[UserOut])
def list_my_tenant_users(
    current_user: User = Depends(require_roles("school_admin", "platform_admin")),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    """List users strictly scoped to the caller's tenant (school_admin/platform_admin only)."""
    return IdentityService(db).list_tenant_users(current_user)

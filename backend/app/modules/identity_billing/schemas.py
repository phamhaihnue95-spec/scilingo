"""Pydantic schemas for Unit 5 (identity_billing)."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

PublicRole = Literal["student", "teacher"]
RoleType = Literal["student", "teacher", "school_admin", "platform_admin"]


class RegisterRequest(BaseModel):
    """B2C registration payload (self-registration is restricted to student or teacher)."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=150)
    role: PublicRole = "student"
    grade_level: int = Field(default=8, ge=6, le=9)


class LoginRequest(BaseModel):
    """Email + password login payload."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    """Refresh token rotation payload."""

    refresh_token: str = Field(min_length=10)


class TenantOut(BaseModel):
    """Serialized tenant summary."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    tenant_type: str
    province: str | None = None
    district: str | None = None
    target_tt94_level: int | None = None


class UserOut(BaseModel):
    """Serialized user profile without sensitive fields."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str
    email: str
    full_name: str
    role: str
    grade_level: int | None = None
    is_active: bool
    created_at: datetime


class AuthSessionResponse(BaseModel):
    """JWT token pair and authenticated user profile."""

    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserOut
    tenant: TenantOut


class EntitlementsOut(BaseModel):
    """Effective tenant subscription plan, AI quota, and feature flags."""

    tenant: TenantOut
    plan_code: str
    status: str
    ai_monthly_quota: int
    ai_used_this_month: int
    ai_remaining: int
    features: list[str]

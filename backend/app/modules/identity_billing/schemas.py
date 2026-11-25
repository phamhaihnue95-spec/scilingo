"""Pydantic schemas for Unit 5 (identity_billing)."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

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


class CmsAuditLogOut(BaseModel):
    """Serialized CMS audit event for governance and traceability."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    tenant_id: str | None = None
    actor_user_id: str | None = None
    actor_email: str
    actor_name: str
    module: str
    action: str
    entity_type: str
    entity_id: str
    summary: str
    diff_json: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime


class CmsUserCreateRequest(BaseModel):
    """Admin request to provision a user inside a school or platform tenant."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=2, max_length=150)
    role: RoleType = "student"
    grade_level: int | None = Field(default=None, ge=6, le=9)
    tenant_id: str | None = None


class CmsUserUpdateRequest(BaseModel):
    """Admin request to update user profile, role, active state, or reset password."""

    full_name: str | None = Field(default=None, min_length=2, max_length=150)
    role: RoleType | None = None
    grade_level: int | None = Field(default=None, ge=6, le=9)
    is_active: bool | None = None
    new_password: str | None = Field(default=None, min_length=8, max_length=128)


class CmsUserCsvImportRequest(BaseModel):
    """Bulk user CSV import payload."""

    csv_content: str = Field(min_length=1, max_length=500000)
    tenant_id: str | None = None


class CmsUserCsvImportResult(BaseModel):
    """Result summary after importing users via CSV."""

    created_count: int
    skipped_count: int
    errors: list[str] = Field(default_factory=list)


class CmsTenantDetailOut(BaseModel):
    """School/organization tenant overview including subscription and user count."""

    id: str
    name: str
    tenant_type: str
    province: str | None = None
    district: str | None = None
    target_tt94_level: int | None = None
    created_at: datetime
    user_count: int
    plan_code: str
    ai_monthly_quota: int
    ai_used_this_month: int
    subscription_status: str


class CmsTenantCreateRequest(BaseModel):
    """Platform-admin request to onboard a new school tenant and subscription."""

    name: str = Field(min_length=2, max_length=200)
    tenant_type: Literal["school", "b2c_individual"] = "school"
    province: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=120)
    target_tt94_level: int | None = Field(default=2, ge=1, le=3)
    plan_code: str = Field(default="school_l2", min_length=2, max_length=32)
    ai_monthly_quota: int = Field(default=5000, ge=0, le=1000000)


class CmsTenantUpdateRequest(BaseModel):
    """Platform-admin request to adjust school metadata or AI plan quota."""

    name: str | None = Field(default=None, min_length=2, max_length=200)
    province: str | None = Field(default=None, max_length=120)
    district: str | None = Field(default=None, max_length=120)
    target_tt94_level: int | None = Field(default=None, ge=1, le=3)
    plan_code: str | None = Field(default=None, min_length=2, max_length=32)
    ai_monthly_quota: int | None = Field(default=None, ge=0, le=1000000)
    subscription_status: str | None = Field(default=None, max_length=24)


class CmsOverviewOut(BaseModel):
    """Cross-unit CMS dashboard KPIs scoped to platform or caller's school."""

    scope: Literal["platform", "school"]
    tenant_name: str
    total_tenants: int
    total_users: int
    active_users: int
    users_by_role: dict[str, int]
    total_grades: int
    total_lessons: int
    total_terms: int
    verified_terms: int
    draft_terms: int
    total_classrooms: int
    total_questions: int
    verified_questions: int
    total_resources: int
    total_teaching_periods: int
    recent_audit_logs: list[CmsAuditLogOut] = Field(default_factory=list)

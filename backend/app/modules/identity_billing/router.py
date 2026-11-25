"""FastAPI routes for Unit 5 (identity_billing)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.identity_billing.dependencies import (
    get_current_user,
    get_optional_current_user,
    require_roles,
)
from app.modules.identity_billing.models import User
from app.modules.identity_billing.schemas import (
    AuthSessionResponse,
    CmsAuditLogOut,
    CmsOverviewOut,
    CmsTenantCreateRequest,
    CmsTenantDetailOut,
    CmsTenantUpdateRequest,
    CmsTrafficAnalyticsOut,
    CmsUserCreateRequest,
    CmsUserCsvImportRequest,
    CmsUserCsvImportResult,
    CmsUserUpdateRequest,
    EntitlementsOut,
    LoginRequest,
    RefreshRequest,
    RegisterRequest,
    TrackEventRequest,
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


# --- CMS Governance Endpoints ---
@router.get("/identity/cms/overview", response_model=CmsOverviewOut)
def get_cms_overview(
    current_user: User = Depends(require_roles("school_admin", "platform_admin")),
    db: Session = Depends(get_db),
) -> CmsOverviewOut:
    """Return CMS KPI dashboard scoped to platform or caller's school."""
    return IdentityService(db).get_cms_overview(current_user)


@router.get("/identity/cms/users", response_model=list[UserOut])
def list_cms_users(
    tenant_id: str | None = Query(default=None),
    role: str | None = Query(default=None),
    q: str | None = Query(default=None, max_length=120),
    is_active: bool | None = Query(default=None),
    current_user: User = Depends(require_roles("school_admin", "platform_admin")),
    db: Session = Depends(get_db),
) -> list[UserOut]:
    """Filter and list user accounts inside caller's authorized tenant scope."""
    return IdentityService(db).list_cms_users(
        current_user, tenant_id=tenant_id, role=role, q=q, is_active=is_active
    )


@router.post(
    "/identity/cms/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
def create_cms_user(
    payload: CmsUserCreateRequest,
    current_user: User = Depends(require_roles("school_admin", "platform_admin")),
    db: Session = Depends(get_db),
) -> UserOut:
    """Create a user account inside an authorized school or platform tenant."""
    return IdentityService(db).create_cms_user(current_user, payload)


@router.patch("/identity/cms/users/{user_id}", response_model=UserOut)
def update_cms_user(
    user_id: str,
    payload: CmsUserUpdateRequest,
    current_user: User = Depends(require_roles("school_admin", "platform_admin")),
    db: Session = Depends(get_db),
) -> UserOut:
    """Update profile, role, active state, or password for an authorized user."""
    return IdentityService(db).update_cms_user(current_user, user_id, payload)


@router.post("/identity/cms/users/import-csv", response_model=CmsUserCsvImportResult)
def import_cms_users_csv(
    payload: CmsUserCsvImportRequest,
    current_user: User = Depends(require_roles("school_admin", "platform_admin")),
    db: Session = Depends(get_db),
) -> CmsUserCsvImportResult:
    """Bulk import student or teacher accounts from CSV."""
    return IdentityService(db).import_cms_users_csv(current_user, payload)


@router.get("/identity/cms/tenants", response_model=list[CmsTenantDetailOut])
def list_cms_tenants(
    current_user: User = Depends(require_roles("school_admin", "platform_admin")),
    db: Session = Depends(get_db),
) -> list[CmsTenantDetailOut]:
    """List school/organization tenants and subscription quotas."""
    return IdentityService(db).list_cms_tenants(current_user)


@router.post(
    "/identity/cms/tenants",
    response_model=CmsTenantDetailOut,
    status_code=status.HTTP_201_CREATED,
)
def create_cms_tenant(
    payload: CmsTenantCreateRequest,
    current_user: User = Depends(require_roles("platform_admin")),
    db: Session = Depends(get_db),
) -> CmsTenantDetailOut:
    """Create a new school tenant and active subscription (platform_admin only)."""
    return IdentityService(db).create_cms_tenant(current_user, payload)


@router.patch("/identity/cms/tenants/{tenant_id}", response_model=CmsTenantDetailOut)
def update_cms_tenant(
    tenant_id: str,
    payload: CmsTenantUpdateRequest,
    current_user: User = Depends(require_roles("platform_admin")),
    db: Session = Depends(get_db),
) -> CmsTenantDetailOut:
    """Update a tenant's metadata or AI plan quota (platform_admin only)."""
    return IdentityService(db).update_cms_tenant(current_user, tenant_id, payload)


@router.get("/identity/cms/audit-logs", response_model=list[CmsAuditLogOut])
def list_cms_audit_logs(
    module: str | None = Query(default=None),
    entity_type: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    current_user: User = Depends(require_roles("school_admin", "platform_admin")),
    db: Session = Depends(get_db),
) -> list[CmsAuditLogOut]:
    """Inspect recent CMS administrative changes."""
    return IdentityService(db).list_cms_audit_logs(
        current_user, module=module, entity_type=entity_type, limit=limit
    )


@router.delete("/identity/cms/users/{user_id}")
def delete_cms_user(
    user_id: str,
    current_user: User = Depends(require_roles("school_admin", "platform_admin")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Delete an authorized user account inside caller's scope."""
    return IdentityService(db).delete_cms_user(current_user, user_id)


@router.post("/analytics/track")
def track_access_event(
    payload: TrackEventRequest,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Record a lightweight page-view or learning activity event."""
    return IdentityService(db).track_access_event(payload, current_user)


@router.get("/identity/cms/traffic", response_model=CmsTrafficAnalyticsOut)
def get_cms_traffic(
    days: int = Query(default=14, ge=1, le=90),
    current_user: User = Depends(require_roles("school_admin", "platform_admin")),
    db: Session = Depends(get_db),
) -> CmsTrafficAnalyticsOut:
    """Return traffic, login counts, devices, top pages, and recent events for CMS."""
    return IdentityService(db).get_cms_traffic(current_user, days=days)

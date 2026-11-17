"""Business logic for authentication, RBAC, and plan entitlements."""

from __future__ import annotations

import jwt
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.modules.identity_billing.models import Tenant, User
from app.modules.identity_billing.repository import IdentityRepository
from app.modules.identity_billing.schemas import (
    AuthSessionResponse,
    EntitlementsOut,
    LoginRequest,
    RegisterRequest,
    TenantOut,
    UserOut,
)

PLAN_FEATURES: dict[str, list[str]] = {
    "free": [
        "kntt8_curriculum_map",
        "glossary_47_lessons",
        "iupac_si_guide",
    ],
    "student_pro": [
        "kntt8_curriculum_map",
        "glossary_47_lessons",
        "iupac_si_guide",
        "srs_flashcards",
        "bilingual_mindmap",
        "quiz_10_50_100",
        "ai_pronunciation",
    ],
    "teacher_pro": [
        "kntt8_curriculum_map",
        "glossary_47_lessons",
        "iupac_si_guide",
        "clil_lesson_packs",
        "exam_builder_tt94",
        "ai_terminology_linter",
    ],
    "school_l1": [
        "kntt8_curriculum_map",
        "glossary_47_lessons",
        "iupac_si_guide",
        "srs_flashcards",
        "bilingual_mindmap",
        "quiz_10_50_100",
        "clil_lesson_packs",
        "exam_builder_tt94",
        "classroom_lms",
        "tt94_compliance_report",
    ],
    "school_l2": [
        "kntt8_curriculum_map",
        "glossary_47_lessons",
        "iupac_si_guide",
        "srs_flashcards",
        "bilingual_mindmap",
        "quiz_10_50_100",
        "ai_pronunciation",
        "clil_lesson_packs",
        "exam_builder_tt94",
        "classroom_lms",
        "tt94_compliance_report",
        "ai_terminology_linter",
        "ai_clil_generator",
    ],
}


class IdentityService:
    """Coordinates user authentication and tenant entitlement resolution."""

    def __init__(self, db: Session) -> None:
        self.repo = IdentityRepository(db)

    def _build_auth_response(self, user: User, tenant: Tenant) -> AuthSessionResponse:
        access_token = create_access_token(user.id, tenant.id, user.role)
        refresh_token = create_refresh_token(user.id, tenant.id)
        return AuthSessionResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=UserOut.model_validate(user),
            tenant=TenantOut.model_validate(tenant),
        )

    def register(self, payload: RegisterRequest) -> AuthSessionResponse:
        existing = self.repo.get_user_by_email(payload.email)
        if existing is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email đã được đăng ký trên hệ thống.",
            )

        tenant, user = self.repo.create_b2c_account(
            email=payload.email,
            password_hash=hash_password(payload.password),
            full_name=payload.full_name,
            role=payload.role,
            grade_level=payload.grade_level,
        )
        return self._build_auth_response(user, tenant)

    def login(self, payload: LoginRequest) -> AuthSessionResponse:
        user = self.repo.get_user_by_email(payload.email)
        if user is None or not verify_password(payload.password, user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Email hoặc mật khẩu không chính xác.",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tài khoản đã bị vô hiệu hóa.",
            )
        return self._build_auth_response(user, user.tenant)

    def refresh(self, refresh_token: str) -> AuthSessionResponse:
        try:
            claims = decode_token(refresh_token, expected_type="refresh")
        except jwt.PyJWTError as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token không hợp lệ hoặc đã hết hạn.",
            ) from exc

        user = self.repo.get_user_by_id(str(claims.get("sub", "")))
        if user is None or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Không tìm thấy tài khoản hợp lệ.",
            )
        return self._build_auth_response(user, user.tenant)

    def get_entitlements(self, user: User) -> EntitlementsOut:
        tenant = user.tenant or self.repo.get_tenant_by_id(user.tenant_id)
        if tenant is None:
            raise HTTPException(status_code=404, detail="Không tìm thấy tổ chức/tenant.")

        sub = self.repo.get_active_subscription(tenant.id)
        plan_code = sub.plan_code if sub else "free"
        quota = sub.ai_monthly_quota if sub else 20
        used = sub.ai_used_this_month if sub else 0
        return EntitlementsOut(
            tenant=TenantOut.model_validate(tenant),
            plan_code=plan_code,
            status=sub.status if sub else "active",
            ai_monthly_quota=quota,
            ai_used_this_month=used,
            ai_remaining=max(0, quota - used),
            features=PLAN_FEATURES.get(plan_code, PLAN_FEATURES["free"]),
        )

    def list_tenant_users(self, current_user: User) -> list[UserOut]:
        users = self.repo.list_users_for_tenant(current_user.tenant_id)
        return [UserOut.model_validate(u) for u in users]

    def get_user_names_map(self, user_ids: list[str]) -> dict[str, str]:
        users = self.repo.get_users_by_ids(user_ids)
        return {uid: user.full_name for uid, user in users.items()}

    def get_tenant_name(self, tenant_id: str) -> str:
        tenant = self.repo.get_tenant_by_id(tenant_id)
        return tenant.name if tenant else "Trường THCS Cầu Giấy B"

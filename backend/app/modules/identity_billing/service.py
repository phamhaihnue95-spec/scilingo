"""Business logic for authentication, RBAC, and plan entitlements."""

from __future__ import annotations

import csv
import io
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.modules.identity_billing.models import (
    AccessEvent,
    CmsAuditLog,
    Subscription,
    Tenant,
    User,
)
from app.modules.identity_billing.repository import IdentityRepository
from app.modules.identity_billing.schemas import (
    AuthSessionResponse,
    CmsAuditLogOut,
    CmsOverviewOut,
    CmsTenantCreateRequest,
    CmsTenantDetailOut,
    CmsTenantUpdateRequest,
    CmsTrafficAnalyticsOut,
    CmsTrafficPruneOut,
    CmsUserCreateRequest,
    CmsUserCsvImportRequest,
    CmsUserCsvImportResult,
    CmsUserUpdateRequest,
    DailyTrafficPointOut,
    EntitlementsOut,
    LoginRequest,
    RecentAccessEventOut,
    RegisterRequest,
    TenantOut,
    TopPageTrafficOut,
    TrackEventRequest,
    UserOut,
)


def _as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=UTC) if dt.tzinfo is None else dt.astimezone(UTC)


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

    @staticmethod
    def _to_user_out(user: User, tenant_name: str | None = None) -> UserOut:
        resolved_tenant = tenant_name or (user.tenant.name if user.tenant else None)
        base = UserOut.model_validate(user).model_dump()
        base["tenant_name"] = resolved_tenant
        return UserOut(**base)

    def _build_auth_response(self, user: User, tenant: Tenant) -> AuthSessionResponse:
        access_token = create_access_token(user.id, tenant.id, user.role)
        refresh_token = create_refresh_token(user.id, tenant.id)
        return AuthSessionResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user=self._to_user_out(user, tenant.name),
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
        now = datetime.now(UTC)
        user.last_login_at = now
        user.login_count = 1
        self.repo.add_access_event(
            AccessEvent(
                visitor_id=f"user-{user.id[:12]}",
                user_id=user.id,
                tenant_id=tenant.id,
                event_type="register",
                path="/auth/register",
                grade=user.grade_level,
                device_type="desktop",
            )
        )
        self.repo.db.commit()
        self.repo.db.refresh(user)
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
        tenant = user.tenant
        user.last_login_at = datetime.now(UTC)
        user.login_count = (user.login_count or 0) + 1
        self.repo.add_access_event(
            AccessEvent(
                visitor_id=f"user-{user.id[:12]}",
                user_id=user.id,
                tenant_id=user.tenant_id,
                event_type="login",
                path="/auth/login",
                grade=user.grade_level,
                device_type="desktop",
            )
        )
        self.repo.db.commit()
        self.repo.db.refresh(user)
        return self._build_auth_response(user, tenant)

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

    def consume_ai_quota(self, user: User, units: int = 1) -> tuple[int, int]:
        sub = self.repo.get_active_subscription(user.tenant_id)
        if sub is None:
            return (0, 0)
        if sub.ai_used_this_month + units > sub.ai_monthly_quota:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    "Đơn vị/tài khoản đã hết hạn mức AI trong tháng này. "
                    "Liên hệ quản trị viên để nâng hạn mức."
                ),
            )
        sub.ai_used_this_month += units
        self.repo.db.flush()
        self.repo.db.commit()
        remaining = max(0, sub.ai_monthly_quota - sub.ai_used_this_month)
        return (sub.ai_used_this_month, remaining)

    def list_tenant_users(self, current_user: User) -> list[UserOut]:
        users = self.repo.list_users_for_tenant(current_user.tenant_id)
        return [self._to_user_out(u) for u in users]

    def get_user_names_map(self, user_ids: list[str]) -> dict[str, str]:
        users = self.repo.get_users_by_ids(user_ids)
        return {uid: user.full_name for uid, user in users.items()}

    def get_tenant_name(self, tenant_id: str) -> str:
        tenant = self.repo.get_tenant_by_id(tenant_id)
        return tenant.name if tenant else "Trường THCS Cầu Giấy B"

    # --- CMS Governance & Audit Trail ---
    def record_audit_log(
        self,
        actor: User,
        *,
        module: str,
        action: str,
        entity_type: str,
        entity_id: str,
        summary: str,
        diff: dict[str, Any] | None = None,
        tenant_id: str | None = None,
    ) -> CmsAuditLog:
        log = CmsAuditLog(
            tenant_id=tenant_id if tenant_id is not None else actor.tenant_id,
            actor_user_id=actor.id,
            actor_email=actor.email,
            actor_name=actor.full_name,
            module=module,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            summary=summary[:500],
            diff_json=diff or {},
        )
        return self.repo.add_audit_log(log)

    def _resolve_target_tenant_id(self, caller: User, requested_tenant_id: str | None) -> str:
        if caller.role == "platform_admin":
            target_id = requested_tenant_id or caller.tenant_id
            if self.repo.get_tenant_by_id(target_id) is None:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Không tìm thấy trường học/tổ chức mục tiêu.",
                )
            return target_id
        if requested_tenant_id and requested_tenant_id != caller.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin trường chỉ được phép quản lý dữ liệu trong trường của mình.",
            )
        return caller.tenant_id

    def get_cms_overview(self, caller: User) -> CmsOverviewOut:
        from app.modules.curriculum.models import Chapter, Lesson, Term
        from app.modules.lms.models import (
            Classroom,
            QuestionBankItem,
            TeacherResource,
            TeachingSessionLog,
        )

        is_platform = caller.role == "platform_admin"
        db = self.repo.db
        tenant_scope_id = None if is_platform else caller.tenant_id

        users_stmt = select(User)
        if tenant_scope_id is not None:
            users_stmt = users_stmt.where(User.tenant_id == tenant_scope_id)
        users = list(db.scalars(users_stmt).all())

        users_by_role: dict[str, int] = {}
        active_users = 0
        for u in users:
            users_by_role[u.role] = users_by_role.get(u.role, 0) + 1
            if u.is_active:
                active_users += 1

        total_tenants = int(db.scalar(select(func.count(Tenant.id))) or 0) if is_platform else 1
        total_grades = int(
            db.scalar(
                select(func.count(func.distinct(Chapter.grade))).where(
                    Chapter.textbook_series == "kntt"
                )
            )
            or 0
        )
        total_lessons = int(db.scalar(select(func.count(Lesson.id))) or 0)
        total_terms = int(db.scalar(select(func.count(Term.id))) or 0)
        verified_terms = int(
            db.scalar(select(func.count(Term.id)).where(Term.status == "verified")) or 0
        )
        draft_terms = max(0, total_terms - verified_terms)

        cls_stmt = select(func.count(Classroom.id))
        q_stmt = select(func.count(QuestionBankItem.id))
        q_ver_stmt = select(func.count(QuestionBankItem.id)).where(
            QuestionBankItem.linter_verified.is_(True)
        )
        res_stmt = select(func.count(TeacherResource.id)).where(
            TeacherResource.resource_type != "game_challenge"
        )
        periods_stmt = select(func.coalesce(func.sum(TeachingSessionLog.periods_count), 0))

        if tenant_scope_id is not None:
            cls_stmt = cls_stmt.where(Classroom.tenant_id == tenant_scope_id)
            q_stmt = q_stmt.where(
                (QuestionBankItem.tenant_id == tenant_scope_id)
                | QuestionBankItem.tenant_id.is_(None)
            )
            q_ver_stmt = q_ver_stmt.where(
                (QuestionBankItem.tenant_id == tenant_scope_id)
                | QuestionBankItem.tenant_id.is_(None)
            )
            res_stmt = res_stmt.where(
                (TeacherResource.tenant_id == tenant_scope_id) | TeacherResource.tenant_id.is_(None)
            )
            periods_stmt = periods_stmt.where(TeachingSessionLog.tenant_id == tenant_scope_id)

        recent_logs = self.repo.list_audit_logs(tenant_id=tenant_scope_id, limit=12)
        now_utc = datetime.now(UTC)
        today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
        events_7d = self.repo.list_access_events_since(
            since=today_start - timedelta(days=6),
            tenant_id=tenant_scope_id,
        )
        visits_today = sum(1 for ev in events_7d if _as_utc(ev.created_at) >= today_start)

        return CmsOverviewOut(
            scope="platform" if is_platform else "school",
            tenant_name=(
                "Toàn hệ thống SciLingo KHTN 6–9"
                if is_platform
                else self.get_tenant_name(caller.tenant_id)
            ),
            total_tenants=total_tenants,
            total_users=len(users),
            active_users=active_users,
            users_by_role=users_by_role,
            total_grades=total_grades,
            total_lessons=total_lessons,
            total_terms=total_terms,
            verified_terms=verified_terms,
            draft_terms=draft_terms,
            total_classrooms=int(db.scalar(cls_stmt) or 0),
            total_questions=int(db.scalar(q_stmt) or 0),
            verified_questions=int(db.scalar(q_ver_stmt) or 0),
            total_resources=int(db.scalar(res_stmt) or 0),
            total_teaching_periods=int(db.scalar(periods_stmt) or 0),
            visits_today=visits_today,
            visits_7d=len(events_7d),
            recent_audit_logs=[CmsAuditLogOut.model_validate(item) for item in recent_logs],
        )

    def list_cms_users(
        self,
        caller: User,
        *,
        tenant_id: str | None = None,
        role: str | None = None,
        q: str | None = None,
        is_active: bool | None = None,
    ) -> list[UserOut]:
        scoped_tenant = (
            tenant_id
            if caller.role == "platform_admin"
            else self._resolve_target_tenant_id(caller, tenant_id)
        )

        users = self.repo.list_users_filtered(
            tenant_id=scoped_tenant,
            role=role,
            q=q,
            is_active=is_active,
        )
        return [self._to_user_out(u) for u in users]

    def create_cms_user(self, caller: User, payload: CmsUserCreateRequest) -> UserOut:
        if caller.role != "platform_admin" and payload.role not in ("student", "teacher"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin trường chỉ được tạo tài khoản học sinh hoặc giáo viên.",
            )
        target_tenant_id = self._resolve_target_tenant_id(caller, payload.tenant_id)

        if self.repo.get_user_by_email(payload.email) is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Email đã tồn tại trên hệ thống.",
            )

        user = User(
            tenant_id=target_tenant_id,
            email=str(payload.email).lower().strip(),
            password_hash=hash_password(payload.password),
            full_name=payload.full_name.strip(),
            role=payload.role,
            grade_level=payload.grade_level if payload.role == "student" else None,
            is_active=True,
        )
        self.repo.create_user_in_tenant(user)
        self.record_audit_log(
            caller,
            module="identity_billing",
            action="create",
            entity_type="user",
            entity_id=user.id,
            summary=f"Tạo tài khoản {user.email} ({user.role})",
            diff={"email": user.email, "role": user.role, "grade_level": user.grade_level},
            tenant_id=target_tenant_id,
        )
        self.repo.db.commit()
        refreshed = self.repo.get_user_by_id(user.id)
        assert refreshed is not None
        return self._to_user_out(refreshed)

    def update_cms_user(self, caller: User, user_id: str, payload: CmsUserUpdateRequest) -> UserOut:
        target = self.repo.get_user_by_id(user_id)
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tài khoản người dùng.",
            )

        if caller.role != "platform_admin":
            if target.tenant_id != caller.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Không thể chỉnh sửa tài khoản thuộc trường khác.",
                )
            if target.role in ("school_admin", "platform_admin") and target.id != caller.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admin trường không có quyền chỉnh sửa tài khoản quản trị cấp cao.",
                )
            if payload.role is not None and payload.role not in ("student", "teacher"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admin trường không được nâng quyền lên admin.",
                )

        if target.id == caller.id and payload.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể tự khóa chính tài khoản đang đăng nhập.",
            )

        changes: dict[str, Any] = {}
        if payload.full_name is not None:
            target.full_name = payload.full_name.strip()
            changes["full_name"] = target.full_name
        if payload.role is not None:
            target.role = payload.role
            changes["role"] = target.role
        if payload.grade_level is not None:
            target.grade_level = payload.grade_level
            changes["grade_level"] = target.grade_level
        if payload.is_active is not None:
            target.is_active = payload.is_active
            changes["is_active"] = target.is_active
        if payload.new_password:
            target.password_hash = hash_password(payload.new_password)
            changes["password_reset"] = True

        self.record_audit_log(
            caller,
            module="identity_billing",
            action="update",
            entity_type="user",
            entity_id=target.id,
            summary=f"Cập nhật tài khoản {target.email}",
            diff=changes,
            tenant_id=target.tenant_id,
        )
        self.repo.db.commit()
        refreshed = self.repo.get_user_by_id(target.id)
        assert refreshed is not None
        return self._to_user_out(refreshed)

    def import_cms_users_csv(
        self, caller: User, payload: CmsUserCsvImportRequest
    ) -> CmsUserCsvImportResult:
        target_tenant_id = self._resolve_target_tenant_id(caller, payload.tenant_id)
        cleaned_csv = payload.csv_content.lstrip("\ufeff").strip()
        reader = csv.DictReader(io.StringIO(cleaned_csv))

        created_count = 0
        skipped_count = 0
        errors: list[str] = []

        for line_no, raw_row in enumerate(reader, start=2):
            row = {str(k or "").strip().lower(): str(v or "").strip() for k, v in raw_row.items()}
            email = row.get("email", "").lower()
            full_name = row.get("full_name", "") or row.get("name", "")
            role = (row.get("role", "") or "student").lower()
            grade_raw = row.get("grade_level", "") or row.get("grade", "")
            raw_password = row.get("password", "") or "Student123!"

            if not email or "@" not in email:
                errors.append(f"Dòng {line_no}: Email không hợp lệ '{email}'.")
                continue
            if len(full_name) < 2:
                errors.append(f"Dòng {line_no}: Họ tên quá ngắn cho '{email}'.")
                continue
            if role not in ("student", "teacher", "school_admin", "platform_admin"):
                errors.append(f"Dòng {line_no}: Vai trò '{role}' không hợp lệ.")
                continue
            if caller.role != "platform_admin" and role not in ("student", "teacher"):
                errors.append(
                    f"Dòng {line_no}: Admin trường chỉ được import học sinh hoặc giáo viên."
                )
                continue
            if len(raw_password) < 8:
                errors.append(f"Dòng {line_no}: Mật khẩu phải có tối thiểu 8 ký tự.")
                continue

            grade_val: int | None = None
            if role == "student":
                try:
                    grade_val = int(grade_raw) if grade_raw else 8
                    if grade_val not in (6, 7, 8, 9):
                        raise ValueError("invalid grade")
                except ValueError:
                    errors.append(f"Dòng {line_no}: Khối lớp phải là 6, 7, 8 hoặc 9.")
                    continue

            if self.repo.get_user_by_email(email) is not None:
                skipped_count += 1
                continue

            self.repo.create_user_in_tenant(
                User(
                    tenant_id=target_tenant_id,
                    email=email,
                    password_hash=hash_password(raw_password),
                    full_name=full_name,
                    role=role,
                    grade_level=grade_val,
                    is_active=True,
                )
            )
            created_count += 1

        if created_count > 0:
            self.record_audit_log(
                caller,
                module="identity_billing",
                action="import",
                entity_type="user_batch",
                entity_id=target_tenant_id,
                summary=f"Import CSV: tạo mới {created_count} tài khoản (bỏ qua {skipped_count}).",
                diff={"created": created_count, "skipped": skipped_count, "errors": len(errors)},
                tenant_id=target_tenant_id,
            )
        self.repo.db.commit()
        return CmsUserCsvImportResult(
            created_count=created_count, skipped_count=skipped_count, errors=errors[:20]
        )

    def _to_tenant_detail(self, tenant: Tenant, counts_map: dict[str, int]) -> CmsTenantDetailOut:
        sub = self.repo.get_active_subscription(tenant.id)
        return CmsTenantDetailOut(
            id=tenant.id,
            name=tenant.name,
            tenant_type=tenant.tenant_type,
            province=tenant.province,
            district=tenant.district,
            target_tt94_level=tenant.target_tt94_level,
            created_at=tenant.created_at,
            user_count=counts_map.get(tenant.id, 0),
            plan_code=sub.plan_code if sub else "free",
            ai_monthly_quota=sub.ai_monthly_quota if sub else 0,
            ai_used_this_month=sub.ai_used_this_month if sub else 0,
            subscription_status=sub.status if sub else "active",
        )

    def list_cms_tenants(self, caller: User) -> list[CmsTenantDetailOut]:
        counts_map = self.repo.count_users_by_tenant()
        if caller.role == "platform_admin":
            tenants = self.repo.list_all_tenants()
        else:
            own = self.repo.get_tenant_by_id(caller.tenant_id)
            tenants = [own] if own is not None else []
        return [self._to_tenant_detail(t, counts_map) for t in tenants]

    def create_cms_tenant(
        self, caller: User, payload: CmsTenantCreateRequest
    ) -> CmsTenantDetailOut:
        tenant = Tenant(
            name=payload.name.strip(),
            tenant_type=payload.tenant_type,
            province=payload.province.strip() if payload.province else None,
            district=payload.district.strip() if payload.district else None,
            target_tt94_level=payload.target_tt94_level,
        )
        subscription = Subscription(
            tenant_id="",
            plan_code=payload.plan_code.strip(),
            ai_monthly_quota=payload.ai_monthly_quota,
            ai_used_this_month=0,
            status="active",
        )
        self.repo.create_tenant_with_subscription(tenant, subscription)
        self.record_audit_log(
            caller,
            module="identity_billing",
            action="create",
            entity_type="tenant",
            entity_id=tenant.id,
            summary=f"Khởi tạo trường/đơn vị '{tenant.name}' ({subscription.plan_code})",
            diff={"plan_code": subscription.plan_code, "quota": subscription.ai_monthly_quota},
            tenant_id=tenant.id,
        )
        self.repo.db.commit()
        self.repo.db.refresh(tenant)
        return self._to_tenant_detail(tenant, self.repo.count_users_by_tenant())

    def update_cms_tenant(
        self, caller: User, tenant_id: str, payload: CmsTenantUpdateRequest
    ) -> CmsTenantDetailOut:
        tenant = self.repo.get_tenant_by_id(tenant_id)
        if tenant is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy trường/đơn vị.",
            )
        sub = self.repo.get_active_subscription(tenant.id)
        changes: dict[str, Any] = {}
        if payload.name is not None:
            tenant.name = payload.name.strip()
            changes["name"] = tenant.name
        if payload.province is not None:
            tenant.province = payload.province.strip() or None
            changes["province"] = tenant.province
        if payload.district is not None:
            tenant.district = payload.district.strip() or None
            changes["district"] = tenant.district
        if payload.target_tt94_level is not None:
            tenant.target_tt94_level = payload.target_tt94_level
            changes["target_tt94_level"] = tenant.target_tt94_level
        if sub is not None:
            if payload.plan_code is not None:
                sub.plan_code = payload.plan_code.strip()
                changes["plan_code"] = sub.plan_code
            if payload.ai_monthly_quota is not None:
                sub.ai_monthly_quota = payload.ai_monthly_quota
                changes["ai_monthly_quota"] = sub.ai_monthly_quota
            if payload.subscription_status is not None:
                sub.status = payload.subscription_status.strip()
                changes["subscription_status"] = sub.status

        self.record_audit_log(
            caller,
            module="identity_billing",
            action="update",
            entity_type="tenant",
            entity_id=tenant.id,
            summary=f"Cập nhật đơn vị '{tenant.name}'",
            diff=changes,
            tenant_id=tenant.id,
        )
        self.repo.db.commit()
        self.repo.db.refresh(tenant)
        return self._to_tenant_detail(tenant, self.repo.count_users_by_tenant())

    def list_cms_audit_logs(
        self,
        caller: User,
        *,
        module: str | None = None,
        entity_type: str | None = None,
        limit: int = 50,
    ) -> list[CmsAuditLogOut]:
        scoped_tenant = None if caller.role == "platform_admin" else caller.tenant_id
        logs = self.repo.list_audit_logs(
            tenant_id=scoped_tenant,
            module=module,
            entity_type=entity_type,
            limit=limit,
        )
        return [CmsAuditLogOut.model_validate(item) for item in logs]

    def delete_cms_user(self, caller: User, user_id: str) -> dict[str, str]:
        target = self.repo.get_user_by_id(user_id)
        if target is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Không tìm thấy tài khoản cần xóa.",
            )
        if target.id == caller.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Không thể tự xóa tài khoản đang đăng nhập.",
            )
        if caller.role != "platform_admin":
            if target.tenant_id != caller.tenant_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Không thể xóa tài khoản thuộc trường khác.",
                )
            if target.role in ("school_admin", "platform_admin"):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Admin trường không có quyền xóa tài khoản quản trị cấp cao.",
                )

        deleted_email = target.email
        deleted_tenant = target.tenant_id
        self.record_audit_log(
            caller,
            module="identity_billing",
            action="delete",
            entity_type="user",
            entity_id=target.id,
            summary=f"Xóa tài khoản {deleted_email} ({target.role})",
            diff={"email": deleted_email, "role": target.role},
            tenant_id=deleted_tenant,
        )
        self.repo.delete_user(target)
        self.repo.db.commit()
        return {"deleted_id": user_id, "email": deleted_email}

    def track_access_event(
        self, payload: TrackEventRequest, current_user: User | None
    ) -> dict[str, str]:
        event = AccessEvent(
            visitor_id=payload.visitor_id.strip(),
            user_id=current_user.id if current_user else None,
            tenant_id=current_user.tenant_id if current_user else None,
            event_type=payload.event_type,
            path=payload.path.strip() or "/",
            grade=payload.grade,
            device_type=payload.device_type,
            referrer=payload.referrer.strip() if payload.referrer else None,
        )
        self.repo.add_access_event(event)
        self.repo.db.commit()
        return {"status": "tracked", "id": event.id}

    def get_cms_traffic(self, caller: User, days: int = 14) -> CmsTrafficAnalyticsOut:
        is_platform = caller.role == "platform_admin"
        tenant_scope = None if is_platform else caller.tenant_id
        now_utc = datetime.now(UTC)
        today_date = now_utc.date()
        start_date = today_date - timedelta(days=days - 1)
        since_dt = datetime.combine(start_date, datetime.min.time(), tzinfo=UTC)

        events = self.repo.list_access_events_since(since=since_dt, tenant_id=tenant_scope)

        day_buckets: dict[str, dict[str, Any]] = {}
        for i in range(days):
            d_str = (start_date + timedelta(days=i)).isoformat()
            day_buckets[d_str] = {"visits": 0, "visitors": set(), "logins": 0}

        unique_visitors: set[str] = set()
        unique_users: set[str] = set()
        page_counts: dict[str, int] = {}
        device_breakdown = {"mobile": 0, "tablet": 0, "desktop": 0}
        grade_breakdown = {"6": 0, "7": 0, "8": 0, "9": 0}
        visits_today = 0
        total_logins = 0

        for ev in events:
            ev_dt = _as_utc(ev.created_at)
            d_key = ev_dt.date().isoformat()
            unique_visitors.add(ev.visitor_id)
            if ev.user_id:
                unique_users.add(ev.user_id)
            if ev_dt.date() == today_date:
                visits_today += 1
            if ev.event_type == "login":
                total_logins += 1

            bucket = day_buckets.get(d_key)
            if bucket is not None:
                bucket["visits"] += 1
                bucket["visitors"].add(ev.visitor_id)
                if ev.event_type == "login":
                    bucket["logins"] += 1

            page_counts[ev.path] = page_counts.get(ev.path, 0) + 1
            dev = ev.device_type if ev.device_type in device_breakdown else "desktop"
            device_breakdown[dev] += 1
            if ev.grade in (6, 7, 8, 9):
                g_key = str(ev.grade)
                grade_breakdown[g_key] += 1

        daily_series = [
            DailyTrafficPointOut(
                date=d_key,
                visits=bucket["visits"],
                unique_visitors=len(bucket["visitors"]),
                logins=bucket["logins"],
            )
            for d_key, bucket in sorted(day_buckets.items())
        ]

        top_pages = [
            TopPageTrafficOut(path=p, visits=cnt)
            for p, cnt in sorted(page_counts.items(), key=lambda pair: pair[1], reverse=True)[:8]
        ]

        recent_slice = events[:25]
        user_ids = list({ev.user_id for ev in recent_slice if ev.user_id})
        users_map = self.repo.get_users_by_ids(user_ids)
        recent_events = [
            RecentAccessEventOut(
                id=ev.id,
                event_type=ev.event_type,
                path=ev.path,
                grade=ev.grade,
                device_type=ev.device_type,
                visitor_id=ev.visitor_id,
                user_email=users_map[ev.user_id].email if ev.user_id in users_map else None,
                user_name=users_map[ev.user_id].full_name if ev.user_id in users_map else None,
                user_role=users_map[ev.user_id].role if ev.user_id in users_map else None,
                created_at=ev.created_at,
            )
            for ev in recent_slice
        ]

        return CmsTrafficAnalyticsOut(
            scope="platform" if is_platform else "school",
            days=days,
            total_visits=len(events),
            visits_today=visits_today,
            unique_visitors=len(unique_visitors),
            unique_logged_in_users=len(unique_users),
            total_logins=total_logins,
            daily_series=daily_series,
            top_pages=top_pages,
            device_breakdown=device_breakdown,
            grade_breakdown=grade_breakdown,
            recent_events=recent_events,
        )

    def export_cms_users_csv(
        self,
        caller: User,
        *,
        tenant_id: str | None = None,
        role: str | None = None,
        q: str | None = None,
        is_active: bool | None = None,
    ) -> bytes:
        users = self.list_cms_users(
            caller, tenant_id=tenant_id, role=role, q=q, is_active=is_active
        )
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(
            [
                "email",
                "full_name",
                "role",
                "grade_level",
                "tenant_name",
                "is_active",
                "login_count",
                "last_login_at",
                "created_at",
            ]
        )
        for u in users:
            writer.writerow(
                [
                    u.email,
                    u.full_name,
                    u.role,
                    u.grade_level if u.grade_level is not None else "",
                    u.tenant_name or "",
                    "true" if u.is_active else "false",
                    u.login_count,
                    u.last_login_at.isoformat() if u.last_login_at else "",
                    u.created_at.isoformat() if u.created_at else "",
                ]
            )
        return output.getvalue().encode("utf-8-sig")

    def export_cms_traffic_csv(self, caller: User, *, days: int = 14) -> bytes:
        traffic = self.get_cms_traffic(caller, days=days)
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["date", "visits", "unique_visitors", "logins"])
        for pt in traffic.daily_series:
            writer.writerow([pt.date, pt.visits, pt.unique_visitors, pt.logins])
        writer.writerow([])
        writer.writerow(
            [
                "created_at",
                "event_type",
                "path",
                "grade",
                "device_type",
                "user_email",
                "user_name",
                "user_role",
                "visitor_id",
            ]
        )
        for ev in traffic.recent_events:
            writer.writerow(
                [
                    ev.created_at.isoformat() if ev.created_at else "",
                    ev.event_type,
                    ev.path,
                    ev.grade if ev.grade is not None else "",
                    ev.device_type,
                    ev.user_email or "",
                    ev.user_name or "",
                    ev.user_role or "",
                    ev.visitor_id,
                ]
            )
        return output.getvalue().encode("utf-8-sig")

    def prune_access_events(
        self, caller: User, retention_days: int = 90
    ) -> CmsTrafficPruneOut:
        cutoff = datetime.now(UTC) - timedelta(days=retention_days)
        deleted_count = self.repo.prune_access_events_before(cutoff)
        self.record_audit_log(
            caller,
            module="identity",
            action="prune",
            entity_type="access_events",
            entity_id=f"retention-{retention_days}d",
            summary=f"Dọn {deleted_count} bản ghi truy cập cũ hơn {retention_days} ngày",
            diff={
                "deleted_count": deleted_count,
                "retention_days": retention_days,
                "cutoff_iso": cutoff.isoformat(),
            },
            tenant_id=None,
        )
        self.repo.db.commit()
        return CmsTrafficPruneOut(
            deleted_count=deleted_count,
            retention_days=retention_days,
            cutoff_iso=cutoff.isoformat(),
        )

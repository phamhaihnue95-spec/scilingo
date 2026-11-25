import { useEffect, useState } from "react";
import {
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  History,
  Lock,
  Plus,
  Search,
  Unlock,
  UserPlus,
  X,
} from "lucide-react";

import { api } from "../../api/client";
import type { CmsAuditLog, CmsTenantDetail, GradeLevel, UserProfile } from "../../api/types";
import { VALID_GRADES } from "../../utils/grades";

interface Props {
  currentUserId: string;
  isPlatformAdmin: boolean;
}

const SAMPLE_USERS_CSV = `email,full_name,role,grade_level,password
hoa.hs8@demo.scilingo.vn,Vũ Quỳnh Hoa,student,8,Student123!
nam.hs9@demo.scilingo.vn,Đỗ Hải Nam,student,9,Student123!`;

export function CmsUsersTenantsPanel({ currentUserId, isPlatformAdmin }: Props) {
  const [subTab, setSubTab] = useState<"users" | "tenants" | "audit">("users");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [tenants, setTenants] = useState<CmsTenantDetail[]>([]);
  const [logs, setLogs] = useState<CmsAuditLog[]>([]);

  const [roleFilter, setRoleFilter] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [userModal, setUserModal] = useState(false);
  const [uEmail, setUEmail] = useState("");
  const [uName, setUName] = useState("");
  const [uPassword, setUPassword] = useState("Student123!");
  const [uRole, setURole] = useState("student");
  const [uGrade, setUGrade] = useState<GradeLevel>(8);
  const [uTenantId, setUTenantId] = useState("");

  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState(SAMPLE_USERS_CSV);

  const [tenantModal, setTenantModal] = useState(false);
  const [tName, setTName] = useState("");
  const [tProvince, setTProvince] = useState("Hà Nội");
  const [tDistrict, setTDistrict] = useState("");
  const [tPlan, setTPlan] = useState("school_l2");
  const [tQuota, setTQuota] = useState(5000);

  const loadAll = () => {
    setError(null);
    Promise.all([
      api.cmsListUsers({ role: roleFilter || undefined, q: query.trim() || undefined }),
      api.cmsListTenants(),
      api.cmsListAuditLogs({ limit: 50 }),
    ])
      .then(([uList, tList, aLogs]) => {
        setUsers(uList);
        setTenants(tList);
        setLogs(aLogs);
        if (!uTenantId && tList.length > 0) {
          setUTenantId(tList[0].id);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Lỗi tải dữ liệu quản trị."));
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.cmsCreateUser({
        email: uEmail,
        full_name: uName,
        password: uPassword,
        role: uRole,
        grade_level: uRole === "student" ? uGrade : null,
        tenant_id: isPlatformAdmin && uTenantId ? uTenantId : null,
      });
      setNotice(`Đã tạo tài khoản ${created.email} (${created.role}).`);
      setUserModal(false);
      setUEmail("");
      setUName("");
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo tài khoản thất bại.");
    }
  };

  const handleToggleActive = async (u: UserProfile) => {
    setError(null);
    try {
      const updated = await api.cmsUpdateUser(u.id, { is_active: !u.is_active });
      setNotice(
        `Đã ${updated.is_active ? "mở khóa" : "vô hiệu hóa"} tài khoản ${updated.email}.`
      );
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cập nhật trạng thái thất bại.");
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.cmsImportUsersCsv(csvText, isPlatformAdmin ? uTenantId || null : null);
      setNotice(
        `Import hoàn tất: tạo ${res.created_count}, bỏ qua trùng ${res.skipped_count}${
          res.errors.length ? ` · Lỗi: ${res.errors.join(" | ")}` : ""
        }`
      );
      setCsvOpen(false);
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import CSV thất bại.");
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const created = await api.cmsCreateTenant({
        name: tName,
        tenant_type: "school",
        province: tProvince || null,
        district: tDistrict || null,
        target_tt94_level: 2,
        plan_code: tPlan,
        ai_monthly_quota: tQuota,
      });
      setNotice(`Đã khởi tạo trường "${created.name}" (${created.plan_code}).`);
      setTenantModal(false);
      setTName("");
      loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tạo trường thất bại.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setSubTab("users")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              subTab === "users" ? "bg-indigo-600 text-white" : "text-slate-600"
            }`}
          >
            Người dùng ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("tenants")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              subTab === "tenants" ? "bg-indigo-600 text-white" : "text-slate-600"
            }`}
          >
            Trường học & Quota ({tenants.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab("audit")}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
              subTab === "audit" ? "bg-indigo-600 text-white" : "text-slate-600"
            }`}
          >
            Nhật ký CMS ({logs.length})
          </button>
        </div>

        {subTab === "users" && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCsvOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Import CSV
            </button>
            <button
              type="button"
              onClick={() => setUserModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
            >
              <UserPlus className="h-4 w-4" />
              Thêm tài khoản
            </button>
          </div>
        )}

        {subTab === "tenants" && isPlatformAdmin && (
          <button
            type="button"
            onClick={() => setTenantModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Thêm Trường học B2B
          </button>
        )}
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {subTab === "users" && (
        <>
          {csvOpen && (
            <form
              onSubmit={handleImportCsv}
              className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4"
            >
              <div className="text-xs font-extrabold text-emerald-900">
                Import nhanh danh sách Học sinh / Giáo viên từ CSV
              </div>
              <textarea
                rows={4}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full rounded-xl border border-emerald-200 bg-white p-2.5 font-mono text-[11px]"
              />
              <button
                type="submit"
                className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white"
              >
                Chạy Import CSV
              </button>
            </form>
          )}

          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold"
            >
              <option value="">Tất cả vai trò</option>
              <option value="student">Học sinh</option>
              <option value="teacher">Giáo viên</option>
              <option value="school_admin">Admin trường</option>
              {isPlatformAdmin && <option value="platform_admin">Platform Admin</option>}
            </select>
            <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5">
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && loadAll()}
                placeholder="Tìm họ tên hoặc email..."
                className="w-full bg-transparent text-xs outline-none"
              />
            </div>
            <button
              type="button"
              onClick={loadAll}
              className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
            >
              Tìm
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Họ tên & Email</th>
                  <th className="px-3 py-2.5">Vai trò</th>
                  <th className="px-3 py-2.5">Khối</th>
                  <th className="px-3 py-2.5">Trạng thái</th>
                  <th className="px-3 py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const canToggle =
                    u.id !== currentUserId &&
                    (isPlatformAdmin || (u.role !== "school_admin" && u.role !== "platform_admin"));
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-slate-900">{u.full_name}</div>
                        <div className="text-[11px] text-slate-500">{u.email}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-700">
                        {u.grade_level ? `Lớp ${u.grade_level}` : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            u.is_active
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {u.is_active ? "Hoạt động" : "Đã khóa"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {canToggle ? (
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u)}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold ${
                              u.is_active
                                ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            {u.is_active ? (
                              <>
                                <Lock className="h-3 w-3" /> Khóa
                              </>
                            ) : (
                              <>
                                <Unlock className="h-3 w-3" /> Mở khóa
                              </>
                            )}
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {subTab === "tenants" && (
        <div className="grid gap-3 md:grid-cols-2">
          {tenants.map((t) => (
            <div key={t.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                    <Building2 className="h-4 w-4 text-indigo-600" />
                    {t.name}
                  </h3>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {t.district ? `${t.district}, ` : ""}
                    {t.province ?? "Việt Nam"} · Loại: {t.tenant_type}
                  </div>
                </div>
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-bold text-indigo-800">
                  {t.plan_code}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center text-xs">
                <div>
                  <div className="text-[10px] text-slate-500">Tài khoản</div>
                  <div className="font-extrabold text-slate-900">{t.user_count}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Quota AI/tháng</div>
                  <div className="font-extrabold text-slate-900">{t.ai_monthly_quota}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Mục tiêu TT94</div>
                  <div className="font-extrabold text-indigo-700">
                    Mức {t.target_tt94_level ?? 1}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {subTab === "audit" && (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
          {logs.length === 0 && (
            <div className="py-6 text-center text-xs text-slate-500">
              Chưa có thao tác CMS nào được ghi nhận.
            </div>
          )}
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 text-xs last:border-b-0"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-indigo-600" />
                  <span className="font-bold text-slate-900">{log.summary}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {log.actor_name} ({log.actor_email}) · [{log.module}/{log.entity_type}:{" "}
                  {log.action}]
                </div>
              </div>
              <div className="text-[11px] text-slate-400">
                {new Date(log.created_at).toLocaleString("vi-VN")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Create User */}
      {userModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleCreateUser}
            className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-extrabold text-slate-900">Tạo tài khoản mới</h3>
              <button type="button" onClick={() => setUserModal(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <input
              type="email"
              required
              value={uEmail}
              onChange={(e) => setUEmail(e.target.value)}
              placeholder="Email *"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              required
              minLength={2}
              value={uName}
              onChange={(e) => setUName(e.target.value)}
              placeholder="Họ và tên *"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <input
              required
              minLength={8}
              value={uPassword}
              onChange={(e) => setUPassword(e.target.value)}
              placeholder="Mật khẩu (tối thiểu 8 ký tự)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                value={uRole}
                onChange={(e) => setURole(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="student">Học sinh (student)</option>
                <option value="teacher">Giáo viên (teacher)</option>
                {isPlatformAdmin && <option value="school_admin">Admin trường</option>}
              </select>
              {uRole === "student" && (
                <select
                  value={uGrade}
                  onChange={(e) => setUGrade(Number(e.target.value) as GradeLevel)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
                >
                  {VALID_GRADES.map((g) => (
                    <option key={g} value={g}>
                      Khối {g}
                    </option>
                  ))}
                </select>
              )}
            </div>
            {isPlatformAdmin && tenants.length > 0 && (
              <select
                value={uTenantId}
                onChange={(e) => setUTenantId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
              >
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setUserModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
              >
                Tạo tài khoản
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Create Tenant */}
      {tenantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleCreateTenant}
            className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-extrabold text-slate-900">Thêm Trường học B2B mới</h3>
              <button type="button" onClick={() => setTenantModal(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>
            <input
              required
              value={tName}
              onChange={(e) => setTName(e.target.value)}
              placeholder="Tên trường (vd: Trường THCS Dịch Vọng Hậu)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={tProvince}
                onChange={(e) => setTProvince(e.target.value)}
                placeholder="Tỉnh/Thành phố"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
              <input
                value={tDistrict}
                onChange={(e) => setTDistrict(e.target.value)}
                placeholder="Quận/Huyện"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <select
                value={tPlan}
                onChange={(e) => setTPlan(e.target.value)}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
              >
                <option value="school_l1">Gói School L1</option>
                <option value="school_l2">Gói School L2</option>
              </select>
              <input
                type="number"
                value={tQuota}
                onChange={(e) => setTQuota(Number(e.target.value))}
                placeholder="AI Quota/tháng"
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTenantModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white"
              >
                Khởi tạo Trường
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

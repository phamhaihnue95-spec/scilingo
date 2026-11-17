import { useEffect, useState } from "react";
import { Building2, CheckCircle2, LogOut, Shield, UserPlus, Users } from "lucide-react";

import { api, clearAuthTokens, saveAuthTokens } from "../../api/client";
import type { AuthSession, Entitlements, UserProfile } from "../../api/types";

interface Props {
  session: AuthSession | null;
  onSessionChange: (session: AuthSession | null) => void;
}

const DEMO_PERSONAS = [
  {
    label: "Học sinh lớp 8 (Nguyễn Minh An)",
    email: "an.hs8@demo.scilingo.vn",
    password: "Student123!",
    badge: "student",
  },
  {
    label: "Giáo viên KHTN (Cô Phạm Thị Hải)",
    email: "hai.gv@demo.scilingo.vn",
    password: "Teacher123!",
    badge: "teacher",
  },
  {
    label: "Ban Giám hiệu (Thầy Trần Quốc Hùng)",
    email: "hung.bgh@demo.scilingo.vn",
    password: "Admin123!",
    badge: "school_admin",
  },
];

export function AccountPage({ session, onSessionChange }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null);
  const [tenantUsers, setTenantUsers] = useState<UserProfile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!session) {
      setEntitlements(null);
      setTenantUsers(null);
      return;
    }

    api
      .getEntitlements()
      .then(setEntitlements)
      .catch(() => setEntitlements(null));

    if (session.user.role === "school_admin" || session.user.role === "platform_admin") {
      api
        .getTenantUsers()
        .then(setTenantUsers)
        .catch(() => setTenantUsers(null));
    } else {
      setTenantUsers(null);
    }
  }, [session]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const nextSession =
        mode === "login"
          ? await api.login({ email, password })
          : await api.register({ email, password, full_name: fullName, role, grade_level: 8 });
      saveAuthTokens(nextSession.access_token, nextSession.refresh_token);
      onSessionChange(nextSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setError(null);
    setSubmitting(true);
    try {
      const nextSession = await api.login({ email: demoEmail, password: demoPassword });
      saveAuthTokens(nextSession.access_token, nextSession.refresh_token);
      onSessionChange(nextSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể đăng nhập tài khoản demo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = () => {
    clearAuthTokens();
    onSessionChange(null);
  };

  if (session) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold uppercase text-teal-800">
              <Shield className="h-3.5 w-3.5" />
              Vai trò: {session.user.role}
            </div>
            <h1 className="text-2xl font-bold text-slate-900">{session.user.full_name}</h1>
            <p className="text-sm text-slate-600">{session.user.email}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>

        {entitlements && (
          <div className="grid gap-6 md:grid-cols-2">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Building2 className="h-4 w-4 text-teal-700" />
                Thông tin Tổ chức / Gói dịch vụ (Unit 5)
              </div>
              <dl className="mt-4 space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Đơn vị / Tenant:</dt>
                  <dd className="font-semibold text-slate-900">{entitlements.tenant.name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Loại hình:</dt>
                  <dd className="font-medium text-slate-800">{entitlements.tenant.tenant_type}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-slate-500">Gói hiện tại:</dt>
                  <dd className="rounded bg-teal-50 px-2 py-0.5 font-mono text-xs font-bold text-teal-800">
                    {entitlements.plan_code}
                  </dd>
                </div>
                {entitlements.tenant.target_tt94_level && (
                  <div className="flex justify-between">
                    <dt className="text-slate-500">Mục tiêu Thông tư 94/2026:</dt>
                    <dd className="font-semibold text-teal-800">
                      Mức độ {entitlements.tenant.target_tt94_level}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-5 border-t border-slate-100 pt-4">
                <div className="flex justify-between text-xs font-semibold text-slate-700">
                  <span>Hạn mức AI Copilot tháng này</span>
                  <span>
                    {entitlements.ai_remaining} / {entitlements.ai_monthly_quota} lượt còn lại
                  </span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-teal-600"
                    style={{
                      width: `${Math.min(
                        100,
                        (entitlements.ai_remaining / Math.max(1, entitlements.ai_monthly_quota)) * 100
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="text-sm font-bold text-slate-900">
                Tính năng được mở khóa theo gói
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {entitlements.features.map((feat) => (
                  <span
                    key={feat}
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {feat}
                  </span>
                ))}
              </div>
            </section>
          </div>
        )}

        {tenantUsers && (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
              <Users className="h-4 w-4 text-teal-700" />
              Danh sách thành viên trong Trường (Chỉ định cho school_admin — Tenant Isolation)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                    <th className="py-2 pr-4">Họ tên</th>
                    <th className="py-2 pr-4">Email</th>
                    <th className="py-2">Vai trò</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {tenantUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2 pr-4 font-medium text-slate-900">{u.full_name}</td>
                      <td className="py-2 pr-4 text-slate-600">{u.email}</td>
                      <td className="py-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                          {u.role}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      {/* Login / Register Card */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
              mode === "login" ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${
              mode === "register" ? "bg-teal-700 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <UserPlus className="h-4 w-4" />
            Đăng ký B2C
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Họ và tên</label>
                <input
                  required
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Nguyễn Minh An"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">Vai trò</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "student" | "teacher")}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="student">Học sinh THCS (Lớp 8)</option>
                  <option value="teacher">Giáo viên KHTN</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Mật khẩu</label>
            <input
              required
              minLength={8}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Tối thiểu 8 ký tự"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {submitting ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
        </form>
      </section>

      {/* Quick Demo Persona Panel */}
      <section className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50 via-sky-50 to-emerald-50 p-6 shadow-sm">
        <h2 className="text-base font-extrabold text-indigo-950">
          Đăng nhập nhanh Tài khoản Demo (Trường THCS Cầu Giấy B)
        </h2>
        <p className="mt-1 text-xs text-indigo-800">
          Trải nghiệm phân quyền RBAC giữa Học sinh, Giáo viên Phạm Thị Hải và Ban Giám hiệu.
        </p>

        <div className="mt-4 space-y-3">
          {DEMO_PERSONAS.map((persona) => (
            <button
              key={persona.email}
              type="button"
              disabled={submitting}
              onClick={() => void handleDemoLogin(persona.email, persona.password)}
              className="flex w-full items-center justify-between rounded-2xl border border-indigo-200 bg-white/90 px-4 py-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-500 hover:shadow-md"
            >
              <div>
                <div className="text-sm font-bold text-slate-900">{persona.label}</div>
                <div className="text-xs text-slate-500">{persona.email}</div>
              </div>
              <span className="rounded-lg bg-gradient-to-r from-indigo-600 to-sky-500 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                {persona.badge}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

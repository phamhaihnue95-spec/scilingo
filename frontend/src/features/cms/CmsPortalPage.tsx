import { useEffect, useState } from "react";
import {
  Activity,
  BookOpen,
  BookText,
  FileQuestion,
  FileText,
  History,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";

import { api } from "../../api/client";
import type { AuthSession, CmsOverview } from "../../api/types";
import { CmsCurriculumPanel } from "./CmsCurriculumPanel";
import { CmsGlossaryPanel } from "./CmsGlossaryPanel";
import { CmsQuestionBankPanel } from "./CmsQuestionBankPanel";
import { CmsResourcesPanel } from "./CmsResourcesPanel";
import { CmsTrafficPanel } from "./CmsTrafficPanel";
import { CmsUsersTenantsPanel } from "./CmsUsersTenantsPanel";

interface Props {
  session: AuthSession | null;
  onOpenAccount: () => void;
}

type CmsSection =
  | "overview"
  | "traffic"
  | "lessons"
  | "glossary"
  | "questions"
  | "resources"
  | "users_audit";

export function CmsPortalPage({ session, onOpenAccount }: Props) {
  const [section, setSection] = useState<CmsSection>("overview");
  const [overview, setOverview] = useState<CmsOverview | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin =
    session !== null &&
    (session.user.role === "school_admin" || session.user.role === "platform_admin");
  const isPlatformAdmin = session?.user.role === "platform_admin";

  useEffect(() => {
    if (!isAdmin) {
      setOverview(null);
      return;
    }
    setLoadingOverview(true);
    setError(null);
    api
      .cmsGetOverview()
      .then(setOverview)
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được dữ liệu CMS."))
      .finally(() => setLoadingOverview(false));
  }, [isAdmin, section]);

  if (!session || !isAdmin) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-extrabold text-slate-900">
          Khu vực Quản trị Hệ thống (CMS Portal)
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Vui lòng đăng nhập tài khoản{" "}
          <span className="font-bold text-indigo-700">Ban Giám hiệu (school_admin)</span> hoặc{" "}
          <span className="font-bold text-emerald-700">Platform Admin</span> để quản trị bài học,
          từ điển IUPAC, ngân hàng câu hỏi và người dùng.
        </p>
        <button
          type="button"
          onClick={onOpenAccount}
          className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700"
        >
          Đi tới trang Đăng nhập
        </button>
      </div>
    );
  }

  const navItems: Array<{
    id: CmsSection;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: string;
  }> = [
    { id: "overview", label: "Tổng quan CMS", icon: LayoutDashboard },
    {
      id: "traffic",
      label: "Lượt truy cập",
      icon: Activity,
      badge: overview && overview.visits_today ? `${overview.visits_today} hôm nay` : undefined,
    },
    { id: "users_audit", label: "Quản lý Tài khoản", icon: Users },
    { id: "lessons", label: "Bài học 6–9 (Unit 1)", icon: BookOpen },
    {
      id: "glossary",
      label: "Từ điển & IUPAC",
      icon: BookText,
      badge: overview && overview.draft_terms > 0 ? `${overview.draft_terms} nháp` : undefined,
    },
    { id: "questions", label: "Ngân hàng câu hỏi", icon: FileQuestion },
    { id: "resources", label: "Học liệu CLIL", icon: FileText },
  ];

  return (
    <div className="space-y-5">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-emerald-900 p-5 text-white shadow-md">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            {isPlatformAdmin ? "Platform Admin · Toàn hệ thống" : "School Admin · Quản trị trường"}
          </div>
          <h1 className="mt-1.5 text-xl font-extrabold sm:text-2xl">
            SciLingo CMS — {overview?.tenant_name ?? session.tenant.name}
          </h1>
          <p className="text-xs text-slate-300">
            Cổng kiểm chuẩn nội dung KHTN 6–9 · Danh pháp IUPAC Thông tư 32/2018 · Đề thi Thông tư 94/2026
          </p>
        </div>
        <div className="rounded-2xl bg-white/10 px-4 py-2 text-right text-xs">
          <div className="font-bold">{session.user.full_name}</div>
          <div className="text-slate-300">{session.user.email}</div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        {/* Left Sidebar */}
        <aside className="space-y-1.5 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm lg:sticky lg:top-20 lg:self-start">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition ${
                  active
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="inline-flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
                {item.badge && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                      active ? "bg-white/20 text-white" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </aside>

        {/* Main Workspace */}
        <div className="min-w-0 space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
              {error}
            </div>
          )}

          {section === "overview" && (
            <div className="space-y-4">
              {loadingOverview && !overview ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                  Đang tải thống kê hệ thống...
                </div>
              ) : (
                overview && (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      <KpiCard
                        title="Lượt truy cập"
                        value={`${overview.visits_today ?? 0}`}
                        sub={`Hôm nay · ${overview.visits_7d ?? 0} lượt / 7 ngày`}
                        accent="text-rose-700"
                      />
                      <KpiCard
                        title="Bài học KNTT 6–9"
                        value={`${overview.total_lessons}`}
                        sub={`${overview.total_grades} khối lớp tích hợp`}
                        accent="text-indigo-700"
                      />
                      <KpiCard
                        title="Thuật ngữ chuẩn IUPAC"
                        value={`${overview.verified_terms}`}
                        sub={`Tổng ${overview.total_terms} · ${overview.draft_terms} bản nháp`}
                        accent="text-emerald-700"
                      />
                      <KpiCard
                        title="Ngân hàng câu hỏi"
                        value={`${overview.total_questions}`}
                        sub={`${overview.verified_questions} câu đạt Linter · ${overview.total_resources} học liệu CLIL`}
                        accent="text-sky-700"
                      />
                      <KpiCard
                        title="Người dùng & Lớp học"
                        value={`${overview.total_users}`}
                        sub={`${overview.active_users} hoạt động · ${overview.total_classrooms} lớp · ${overview.total_teaching_periods} tiết CLIL`}
                        accent="text-amber-700"
                      />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h3 className="text-sm font-extrabold text-slate-900">
                          Phân bổ tài khoản theo vai trò
                        </h3>
                        <div className="mt-3 space-y-2 text-xs">
                          {Object.entries(overview.users_by_role).map(([roleKey, count]) => (
                            <div
                              key={roleKey}
                              className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"
                            >
                              <span className="font-bold text-slate-700">{roleKey}</span>
                              <span className="font-extrabold text-indigo-700">{count}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                          <History className="h-4 w-4 text-indigo-600" />
                          Thao tác CMS gần đây
                        </h3>
                        <div className="mt-3 space-y-2 text-xs">
                          {overview.recent_audit_logs.length === 0 && (
                            <p className="text-slate-500">
                              Chưa có nhật ký thay đổi CMS nào gần đây.
                            </p>
                          )}
                          {overview.recent_audit_logs.slice(0, 6).map((log) => (
                            <div
                              key={log.id}
                              className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                            >
                              <div className="font-bold text-slate-800">{log.summary}</div>
                              <div className="text-[11px] text-slate-500">
                                {log.actor_name} ·{" "}
                                {new Date(log.created_at).toLocaleString("vi-VN")}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )
              )}
            </div>
          )}

          {section === "traffic" && <CmsTrafficPanel />}
          {section === "lessons" && <CmsCurriculumPanel isPlatformAdmin={isPlatformAdmin} />}
          {section === "glossary" && <CmsGlossaryPanel isPlatformAdmin={isPlatformAdmin} />}
          {section === "questions" && <CmsQuestionBankPanel isPlatformAdmin={isPlatformAdmin} />}
          {section === "resources" && <CmsResourcesPanel isPlatformAdmin={isPlatformAdmin} />}
          {section === "users_audit" && (
            <CmsUsersTenantsPanel
              currentUserId={session.user.id}
              isPlatformAdmin={isPlatformAdmin}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  sub,
  accent,
}: {
  title: string;
  value: string;
  sub: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-bold text-slate-500">{title}</div>
      <div className={`mt-1 text-2xl font-extrabold ${accent}`}>{value}</div>
      <div className="mt-1 text-[11px] text-slate-500">{sub}</div>
    </div>
  );
}

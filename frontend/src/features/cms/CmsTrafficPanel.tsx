import { useEffect, useState } from "react";
import {
  Activity,
  Download,
  Monitor,
  RefreshCw,
  Smartphone,
  Tablet,
  Trash2,
  TrendingUp,
  UserCheck,
  Users,
} from "lucide-react";

import { api } from "../../api/client";
import type { CmsTrafficAnalytics } from "../../api/types";

interface Props {
  isPlatformAdmin?: boolean;
}

export function CmsTrafficPanel({ isPlatformAdmin = false }: Props) {
  const [days, setDays] = useState<7 | 14 | 30>(14);
  const [data, setData] = useState<CmsTrafficAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadTraffic = () => {
    setLoading(true);
    setError(null);
    api
      .cmsGetTraffic(days)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được dữ liệu truy cập."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTraffic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const maxDailyVisits = Math.max(1, ...(data?.daily_series.map((d) => d.visits) ?? [1]));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Thống kê Lượt truy cập & Hoạt động ({data?.scope === "platform" ? "Toàn hệ thống" : "Cấp trường"})
          </h2>
          <p className="text-xs text-slate-500">
            Theo dõi lượt ghé thăm website, đăng nhập tài khoản, phân bổ thiết bị và khối lớp theo thời gian thực.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                  days === d ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {d} ngày
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() =>
              api
                .cmsDownloadTrafficCsv(days)
                .catch((err) =>
                  setError(err instanceof Error ? err.message : "Xuất CSV truy cập thất bại.")
                )
            }
            className="inline-flex items-center gap-1 rounded-xl border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-100"
          >
            <Download className="h-3.5 w-3.5" />
            Xuất CSV
          </button>
          {isPlatformAdmin && (
            <button
              type="button"
              onClick={async () => {
                if (!window.confirm("Xóa toàn bộ log truy cập cũ hơn 90 ngày để tối ưu dung lượng?")) {
                  return;
                }
                setError(null);
                try {
                  const res = await api.cmsPruneTraffic(90);
                  setNotice(
                    `Đã dọn ${res.deleted_count} bản ghi truy cập cũ hơn ${res.retention_days} ngày.`
                  );
                  loadTraffic();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Dọn log truy cập thất bại.");
                }
              }}
              className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Dọn log &gt; 90 ngày
            </button>
          )}
          <button
            type="button"
            onClick={loadTraffic}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Làm mới
          </button>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          {notice}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <TrafficCard
              icon={Activity}
              label={`Tổng lượt (${days} ngày)`}
              value={data.total_visits}
              accent="text-indigo-700"
            />
            <TrafficCard
              icon={TrendingUp}
              label="Lượt hôm nay"
              value={data.visits_today}
              accent="text-emerald-700"
            />
            <TrafficCard
              icon={Users}
              label="Khách duy nhất"
              value={data.unique_visitors}
              accent="text-sky-700"
            />
            <TrafficCard
              icon={UserCheck}
              label="TK đã đăng nhập"
              value={data.unique_logged_in_users}
              accent="text-purple-700"
            />
            <TrafficCard
              icon={UserCheck}
              label="Lượt đăng nhập"
              value={data.total_logins}
              accent="text-amber-700"
            />
          </div>

          {/* Daily Traffic Bar Chart */}
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                Biểu đồ truy cập theo ngày ({days} ngày gần nhất)
              </h3>
              <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Tổng lượt
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Đăng nhập
                </span>
              </div>
            </div>
            <div className="flex h-44 items-end gap-1.5 overflow-x-auto pb-1">
              {data.daily_series.map((pt) => {
                const visitPct = Math.round((pt.visits / maxDailyVisits) * 100);
                const loginPct = Math.round((pt.logins / maxDailyVisits) * 100);
                return (
                  <div
                    key={pt.date}
                    title={`${pt.date}: ${pt.visits} lượt · ${pt.unique_visitors} khách · ${pt.logins} đăng nhập`}
                    className="flex min-w-[26px] flex-1 flex-col items-center justify-end gap-1"
                  >
                    <div className="text-[10px] font-bold text-slate-600">{pt.visits}</div>
                    <div className="flex h-28 w-full items-end justify-center gap-0.5">
                      <div
                        className="w-2/3 rounded-t bg-indigo-500 transition-all"
                        style={{ height: `${Math.max(pt.visits > 0 ? 8 : 2, visitPct)}%` }}
                      />
                      {pt.logins > 0 && (
                        <div
                          className="w-1/3 rounded-t bg-emerald-500 transition-all"
                          style={{ height: `${Math.max(8, loginPct)}%` }}
                        />
                      )}
                    </div>
                    <div className="text-[10px] font-medium text-slate-400">
                      {pt.date.slice(5)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3 Breakdown Panels */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Devices */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900">Thiết bị truy cập</h3>
              <div className="mt-3 space-y-2 text-xs">
                <DeviceRow
                  icon={Monitor}
                  label="Máy tính (Desktop)"
                  count={data.device_breakdown.desktop ?? 0}
                  total={data.total_visits}
                />
                <DeviceRow
                  icon={Smartphone}
                  label="Điện thoại (Mobile)"
                  count={data.device_breakdown.mobile ?? 0}
                  total={data.total_visits}
                />
                <DeviceRow
                  icon={Tablet}
                  label="Máy tính bảng (Tablet)"
                  count={data.device_breakdown.tablet ?? 0}
                  total={data.total_visits}
                />
              </div>
            </div>

            {/* Grade Breakdown */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900">Lượt xem theo Khối KHTN</h3>
              <div className="mt-3 space-y-2 text-xs">
                {(["6", "7", "8", "9"] as const).map((g) => {
                  const cnt = data.grade_breakdown[g] ?? 0;
                  const pct = data.total_visits ? Math.round((cnt / data.total_visits) * 100) : 0;
                  return (
                    <div key={g} className="space-y-1">
                      <div className="flex justify-between font-bold text-slate-700">
                        <span>KHTN Lớp {g}</span>
                        <span>
                          {cnt} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-sky-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top Pages */}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-sm font-extrabold text-slate-900">Trang truy cập nhiều nhất</h3>
              <div className="mt-3 space-y-1.5 text-xs">
                {data.top_pages.length === 0 && (
                  <p className="text-slate-500">Chưa có dữ liệu trang.</p>
                )}
                {data.top_pages.map((tp) => (
                  <div
                    key={tp.path}
                    className="flex items-center justify-between rounded-xl bg-slate-50 px-2.5 py-1.5"
                  >
                    <span className="truncate font-mono text-[11px] font-semibold text-slate-800">
                      {tp.path}
                    </span>
                    <span className="ml-2 shrink-0 font-extrabold text-indigo-700">
                      {tp.visits}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Recent Events Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-3 text-sm font-extrabold text-slate-900">
              Nhật ký truy cập gần đây ({data.recent_events.length})
            </div>
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Thời gian</th>
                  <th className="px-3 py-2">Người dùng / Khách</th>
                  <th className="px-3 py-2">Sự kiện</th>
                  <th className="px-3 py-2">Đường dẫn & Khối</th>
                  <th className="px-3 py-2">Thiết bị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.recent_events.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                      Chưa có sự kiện truy cập nào trong {days} ngày qua.
                    </td>
                  </tr>
                )}
                {data.recent_events.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-3 py-2 text-[11px] text-slate-500">
                      {new Date(ev.created_at).toLocaleString("vi-VN")}
                    </td>
                    <td className="px-3 py-2">
                      {ev.user_email ? (
                        <div>
                          <div className="font-bold text-slate-900">{ev.user_name}</div>
                          <div className="text-[11px] text-slate-500">
                            {ev.user_email} · {ev.user_role}
                          </div>
                        </div>
                      ) : (
                        <span className="font-mono text-[11px] text-slate-500">
                          Khách ({ev.visitor_id.slice(0, 10)})
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          ev.event_type === "login"
                            ? "bg-emerald-100 text-emerald-800"
                            : ev.event_type === "cms_view"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-sky-100 text-sky-800"
                        }`}
                      >
                        {ev.event_type}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-mono text-[11px] text-slate-800">{ev.path}</span>
                      {ev.grade && (
                        <span className="ml-1.5 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                          K{ev.grade}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-[11px] font-semibold text-slate-600">
                      {ev.device_type}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function TrafficCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
      <div className="flex items-center justify-between text-xs font-bold text-slate-500">
        <span>{label}</span>
        <Icon className={`h-4 w-4 ${accent}`} />
      </div>
      <div className={`mt-1 text-2xl font-extrabold ${accent}`}>{value}</div>
    </div>
  );
}

function DeviceRow({
  icon: Icon,
  label,
  count,
  total,
}: {
  icon: typeof Monitor;
  label: string;
  count: number;
  total: number;
}) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between font-semibold text-slate-700">
        <span className="inline-flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-slate-500" />
          {label}
        </span>
        <span className="font-bold">
          {count} ({pct}%)
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

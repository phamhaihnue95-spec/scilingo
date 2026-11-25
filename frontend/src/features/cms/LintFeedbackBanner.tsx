import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";

import type { LintCheckResult } from "../../api/types";

interface Props {
  result: LintCheckResult | null;
  checking?: boolean;
}

export function LintFeedbackBanner({ result, checking }: Props) {
  if (checking) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
        Đang kiểm tra 20 luật danh pháp IUPAC / SI / DNA–RNA...
      </div>
    );
  }
  if (!result) return null;

  return (
    <div
      className={`space-y-2 rounded-xl border p-3 text-xs ${
        result.passed
          ? "border-emerald-200 bg-emerald-50/80 text-emerald-900"
          : "border-rose-200 bg-rose-50/90 text-rose-900"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
        <span className="inline-flex items-center gap-1.5">
          {result.passed ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          ) : (
            <ShieldAlert className="h-4 w-4 text-rose-600" />
          )}
          {result.passed
            ? "Đạt chuẩn IUPAC / SI (TT 32/2018)"
            : `Phát hiện ${result.error_count} lỗi danh pháp bắt buộc sửa`}
        </span>
        {result.warning_count > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
            <AlertTriangle className="h-3 w-3" />
            {result.warning_count} cảnh báo
          </span>
        )}
      </div>

      {result.issues.length > 0 && (
        <ul className="space-y-1.5">
          {result.issues.map((issue, idx) => (
            <li
              key={`${issue.matched_text}-${idx}`}
              className={`rounded-lg border px-2.5 py-1.5 ${
                issue.severity === "error"
                  ? "border-rose-200 bg-white text-rose-900"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              <div>
                <span className="font-bold uppercase">
                  [{issue.severity === "error" ? "LỖI" : "CẢNH BÁO"}]
                </span>{" "}
                <span className="line-through opacity-80">{issue.matched_text}</span> →{" "}
                <span className="font-bold text-emerald-700">{issue.recommended}</span>
              </div>
              <div className="mt-0.5 text-[11px] opacity-85">{issue.reason}</div>
            </li>
          ))}
        </ul>
      )}

      {result.exception_notes.length > 0 && (
        <div className="space-y-1 rounded-lg border border-sky-200 bg-sky-50/80 p-2 text-[11px] text-sky-900">
          {result.exception_notes.map((note, idx) => (
            <div key={idx} className="flex items-start gap-1.5">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
              <span>{note}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

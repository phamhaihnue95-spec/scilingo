import { useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Edit3, Search, ShieldCheck, X } from "lucide-react";

import { api } from "../../api/client";
import type { CmsLessonItem, Discipline, GradeLevel, LintCheckResult } from "../../api/types";
import { VALID_GRADES } from "../../utils/grades";
import { DisciplineBadge } from "../curriculum/DisciplineBadge";
import { LintFeedbackBanner } from "./LintFeedbackBanner";

interface Props {
  isPlatformAdmin: boolean;
}

const DISCIPLINES: Array<{ value: string; label: string }> = [
  { value: "", label: "Tất cả phân môn" },
  { value: "general_lab", label: "Mở đầu & Đo lường" },
  { value: "chemistry", label: "Chất & Biến đổi (Hóa)" },
  { value: "physics", label: "Năng lượng & Vật lí" },
  { value: "biology", label: "Vật sống (Sinh học)" },
  { value: "earth_space", label: "Trái Đất & Bầu trời" },
];

export function CmsCurriculumPanel({ isPlatformAdmin }: Props) {
  const [grade, setGrade] = useState<GradeLevel | "all">(8);
  const [discipline, setDiscipline] = useState<string>("");
  const [query, setQuery] = useState("");
  const [lessons, setLessons] = useState<CmsLessonItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [editing, setEditing] = useState<CmsLessonItem | null>(null);
  const [titleVi, setTitleVi] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [editDiscipline, setEditDiscipline] = useState<Discipline>("chemistry");
  const [isPractical, setIsPractical] = useState(false);
  const [summaryVi, setSummaryVi] = useState("");
  const [summaryEn, setSummaryEn] = useState("");
  const [lintResult, setLintResult] = useState<LintCheckResult | null>(null);
  const [linting, setLinting] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadLessons = () => {
    setLoading(true);
    setError(null);
    api
      .cmsListLessons({
        grade: grade === "all" ? undefined : grade,
        discipline: discipline || undefined,
        q: query.trim() || undefined,
      })
      .then((res) => {
        setLessons(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được bài học."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, discipline]);

  const openEdit = (lesson: CmsLessonItem) => {
    setEditing(lesson);
    setTitleVi(lesson.title_vi);
    setTitleEn(lesson.title_en);
    setEditDiscipline(lesson.discipline);
    setIsPractical(lesson.is_practical);
    setSummaryVi(lesson.summary_vi ?? "");
    setSummaryEn(lesson.summary_en ?? "");
    setLintResult(null);
    setError(null);
  };

  const runLintPreview = async () => {
    setLinting(true);
    setError(null);
    try {
      const res = await api.cmsLintCheck(
        `${titleVi}\n${titleEn}\n${summaryVi}\n${summaryEn}`,
        editDiscipline
      );
      setLintResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không chạy được kiểm tra Linter.");
    } finally {
      setLinting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.cmsUpdateLesson(editing.id, {
        title_vi: titleVi,
        title_en: titleEn,
        discipline: editDiscipline,
        is_practical: isPractical,
        summary_vi: summaryVi,
        summary_en: summaryEn,
        strict_lint: true,
      });
      setLintResult(res.lint_report);
      setNotice(`Đã cập nhật KHTN ${editing.grade} · Bài ${editing.lesson_no} thành công.`);
      setEditing(null);
      loadLessons();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu bài học thất bại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Quản lý Chương trình & Bài học KNTT (Khối 6–9)
          </h2>
          <p className="text-xs text-slate-500">
            Tổng số bài phù hợp bộ lọc: <span className="font-bold text-slate-800">{total}</span> bài
            {!isPlatformAdmin && " · Quyền Trường: chỉ xem cấu trúc chương trình quốc gia."}
          </p>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            {notice}
          </span>
          <button type="button" onClick={() => setNotice(null)} className="text-emerald-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setGrade("all")}
            className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
              grade === "all" ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Cả 4 khối
          </button>
          {VALID_GRADES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGrade(g)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                grade === g ? "bg-indigo-600 text-white" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Khối {g}
            </button>
          ))}
        </div>

        <select
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          {DISCIPLINES.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>

        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadLessons()}
            placeholder="Tìm theo tên bài VI / EN..."
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
        <button
          type="button"
          onClick={loadLessons}
          className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
        >
          Tìm kiếm
        </button>
      </div>

      {/* Lessons table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Khối / Bài</th>
              <th className="px-3 py-2.5">Tiêu đề Tiếng Việt & Tiếng Anh</th>
              <th className="px-3 py-2.5">Phân môn</th>
              <th className="px-3 py-2.5 text-center">Thuật ngữ</th>
              <th className="px-3 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Đang tải danh sách bài học...
                </td>
              </tr>
            )}
            {!loading && lessons.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                  Không có bài học nào khớp bộ lọc.
                </td>
              </tr>
            )}
            {!loading &&
              lessons.map((lesson) => (
                <tr key={lesson.id} className="hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-3 py-2.5 font-bold text-slate-800">
                    <div>
                      KHTN {lesson.grade} · Bài {lesson.lesson_no}
                    </div>
                    <div className="text-[11px] font-normal text-slate-500">
                      Chương {lesson.chapter_no}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-bold text-slate-900">{lesson.title_vi}</div>
                    <div className="text-[11px] font-medium text-indigo-700">{lesson.title_en}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <DisciplineBadge discipline={lesson.discipline} />
                      {lesson.is_practical && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                          Thực hành
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-center font-semibold text-slate-700">
                    {lesson.term_count}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {isPlatformAdmin ? (
                      <button
                        type="button"
                        onClick={() => openEdit(lesson)}
                        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Sửa bài
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <BookOpen className="h-3.5 w-3.5" />
                        Chuẩn BGDĐT
                      </span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSave}
            className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="text-xs font-bold uppercase text-indigo-600">
                  KHTN {editing.grade} · Bài {editing.lesson_no}
                </div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Chỉnh sửa nội dung bài học chuẩn
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-xs font-bold text-slate-700">
                <span>Tiêu đề Tiếng Việt</span>
                <input
                  value={titleVi}
                  onChange={(e) => setTitleVi(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal outline-none focus:border-indigo-500"
                />
              </label>
              <label className="block space-y-1 text-xs font-bold text-slate-700">
                <span>Tiêu đề Tiếng Anh (CLIL)</span>
                <input
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal outline-none focus:border-indigo-500"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <span>Phân môn:</span>
                <select
                  value={editDiscipline}
                  onChange={(e) => setEditDiscipline(e.target.value as Discipline)}
                  className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-semibold"
                >
                  {DISCIPLINES.filter((d) => d.value !== "").map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={isPractical}
                  onChange={(e) => setIsPractical(e.target.checked)}
                />
                Bài thực hành / thí nghiệm
              </label>
            </div>

            <label className="block space-y-1 text-xs font-bold text-slate-700">
              <span>Tóm tắt Tiếng Việt</span>
              <textarea
                rows={3}
                value={summaryVi}
                onChange={(e) => setSummaryVi(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal outline-none focus:border-indigo-500"
              />
            </label>

            <label className="block space-y-1 text-xs font-bold text-slate-700">
              <span>Tóm tắt Tiếng Anh</span>
              <textarea
                rows={3}
                value={summaryEn}
                onChange={(e) => setSummaryEn(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal outline-none focus:border-indigo-500"
              />
            </label>

            <LintFeedbackBanner result={lintResult} checking={linting} />

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={runLintPreview}
                disabled={linting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100"
              >
                <ShieldCheck className="h-4 w-4" />
                Kiểm chuẩn IUPAC / SI
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu bài học"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  FileText,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import { api } from "../../api/client";
import type { ClilMode, CmsResourceItem, GradeLevel, LintCheckResult } from "../../api/types";
import { VALID_GRADES } from "../../utils/grades";
import { LintFeedbackBanner } from "./LintFeedbackBanner";

interface Props {
  isPlatformAdmin: boolean;
}

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  lesson_plan: "Giáo án CLIL",
  bilingual_slide: "Slide song ngữ",
  worksheet: "Phiếu học tập",
  glossary_card: "Thẻ thuật ngữ",
};

const CLIL_LABELS: Record<ClilMode, string> = {
  term_only: "Từ khóa EN",
  bilingual_10: "Song ngữ 10%",
  bilingual_50: "Song ngữ 50%",
  full_english: "100% Tiếng Anh",
};

export function CmsResourcesPanel({ isPlatformAdmin }: Props) {
  const [items, setItems] = useState<CmsResourceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [grade, setGrade] = useState<GradeLevel | "all">("all");
  const [resourceType, setResourceType] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CmsResourceItem | null>(null);
  const [rGrade, setRGrade] = useState<GradeLevel>(8);
  const [rLessonNo, setRLessonNo] = useState(8);
  const [rTitle, setRTitle] = useState("");
  const [rType, setRType] = useState<
    "lesson_plan" | "bilingual_slide" | "worksheet" | "glossary_card"
  >("lesson_plan");
  const [rClil, setRClil] = useState<ClilMode>("bilingual_10");
  const [rMarkdown, setRMarkdown] = useState("");
  const [rOfficial, setROfficial] = useState(false);
  const [lintResult, setLintResult] = useState<LintCheckResult | null>(null);
  const [linting, setLinting] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadResources = () => {
    setLoading(true);
    setError(null);
    api
      .cmsListResources({
        grade: grade === "all" ? undefined : grade,
        resource_type: resourceType || undefined,
        q: query.trim() || undefined,
        limit: 80,
      })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được học liệu CLIL."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, resourceType]);

  const openCreate = () => {
    setEditing(null);
    setRGrade(8);
    setRLessonNo(8);
    setRTitle("");
    setRType("lesson_plan");
    setRClil("bilingual_10");
    setRMarkdown(
      `# Giáo án CLIL: Acid — Hydrochloric acid (HCl)\n\n## 1. Mục tiêu (Objectives)\n- Học sinh đọc chuẩn IUPAC: **Hydrochloric acid**, **Sulfuric acid**.\n- Thực hành quan sát đổi màu quỳ tím.\n\n## 2. Hoạt động song ngữ (Bilingual Activity)\n- What happens when Hydrochloric acid reacts with Zinc?`
    );
    setROfficial(isPlatformAdmin);
    setLintResult(null);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (item: CmsResourceItem) => {
    setEditing(item);
    setRGrade(item.grade);
    setRLessonNo(item.lesson_no);
    setRTitle(item.title);
    setRType(item.resource_type);
    setRClil(item.clil_mode);
    setRMarkdown(item.content_markdown);
    setROfficial(item.is_official);
    setLintResult(item.lint_report ?? null);
    setError(null);
    setModalOpen(true);
  };

  const runLintPreview = async () => {
    setLinting(true);
    setError(null);
    try {
      const res = await api.cmsLintCheck(`${rTitle}\n${rMarkdown}`);
      setLintResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi kiểm chuẩn IUPAC.");
    } finally {
      setLinting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = editing
        ? await api.cmsUpdateResource(editing.id, {
            grade: rGrade,
            lesson_no: rLessonNo,
            title: rTitle,
            resource_type: rType,
            clil_mode: rClil,
            content_markdown: rMarkdown,
            is_official: isPlatformAdmin ? rOfficial : undefined,
          })
        : await api.cmsCreateResource({
            grade: rGrade,
            lesson_no: rLessonNo,
            title: rTitle,
            resource_type: rType,
            clil_mode: rClil,
            content_markdown: rMarkdown,
            is_official: isPlatformAdmin ? rOfficial : false,
          });
      setNotice(`Đã lưu học liệu "${saved.title}".`);
      setModalOpen(false);
      loadResources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu học liệu thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: CmsResourceItem) => {
    if (!window.confirm(`Xóa học liệu "${item.title}"?`)) return;
    try {
      await api.cmsDeleteResource(item.id);
      setNotice(`Đã xóa "${item.title}".`);
      loadResources();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa học liệu.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Kho Giáo án, Slide & Phiếu học tập CLIL ({total})
          </h2>
          <p className="text-xs text-slate-500">
            Soạn thảo Markdown song ngữ kèm kiểm chuẩn danh pháp IUPAC/SI & xem trước trực tiếp.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          Tạo học liệu CLIL
        </button>
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

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <select
          value={grade}
          onChange={(e) =>
            setGrade(e.target.value === "all" ? "all" : (Number(e.target.value) as GradeLevel))
          }
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold"
        >
          <option value="all">Mọi khối (6–9)</option>
          {VALID_GRADES.map((g) => (
            <option key={g} value={g}>
              KHTN {g}
            </option>
          ))}
        </select>

        <select
          value={resourceType}
          onChange={(e) => setResourceType(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold"
        >
          <option value="">Tất cả loại học liệu</option>
          <option value="lesson_plan">Giáo án CLIL</option>
          <option value="bilingual_slide">Slide song ngữ</option>
          <option value="worksheet">Phiếu học tập</option>
          <option value="glossary_card">Thẻ thuật ngữ</option>
        </select>

        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadResources()}
            placeholder="Tìm tiêu đề hoặc nội dung giáo án..."
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
        <button
          type="button"
          onClick={loadResources}
          className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
        >
          Lọc
        </button>
      </div>

      {/* Resource cards */}
      <div className="grid gap-3 md:grid-cols-2">
        {loading && (
          <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
            Đang tải học liệu CLIL...
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="col-span-full rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
            Chưa có học liệu tùy chỉnh trong kho CMS (các gói CLIL mẫu vẫn sinh tự động trong Teacher Studio).
          </div>
        )}
        {!loading &&
          items.map((res) => {
            const canEdit = isPlatformAdmin || !res.is_official;
            return (
              <div
                key={res.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                      <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                        KHTN {res.grade} · Bài {res.lesson_no}
                      </span>
                      <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-800">
                        {RESOURCE_TYPE_LABELS[res.resource_type] ?? res.resource_type}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-800">
                        {CLIL_LABELS[res.clil_mode] ?? res.clil_mode}
                      </span>
                      {res.is_official && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                          Chuẩn quốc gia
                        </span>
                      )}
                    </div>
                    {canEdit && (
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(res)}
                          className="rounded-lg border border-slate-200 p-1 text-slate-700 hover:bg-slate-100"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(res)}
                          className="rounded-lg border border-rose-200 p-1 text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                    <FileText className="h-4 w-4 shrink-0 text-indigo-600" />
                    {res.title}
                  </h3>
                  <pre className="max-h-28 overflow-hidden whitespace-pre-wrap rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-700">
                    {res.content_markdown}
                  </pre>
                </div>
              </div>
            );
          })}
      </div>

      {/* Two-Column Markdown Editor Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSave}
            className="max-h-[92vh] w-full max-w-4xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {editing ? `Sửa học liệu: ${editing.title}` : "Soạn học liệu CLIL mới"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="space-y-1 text-xs font-bold text-slate-700 sm:col-span-2">
                <span>Tiêu đề học liệu *</span>
                <input
                  required
                  value={rTitle}
                  onChange={(e) => setRTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
                />
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">
                <span>Khối / Bài</span>
                <div className="flex gap-1.5">
                  <select
                    value={rGrade}
                    onChange={(e) => setRGrade(Number(e.target.value) as GradeLevel)}
                    className="w-1/2 rounded-xl border border-slate-200 px-2 py-2 text-xs font-normal"
                  >
                    {VALID_GRADES.map((g) => (
                      <option key={g} value={g}>
                        Lớp {g}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={rLessonNo}
                    onChange={(e) => setRLessonNo(Number(e.target.value))}
                    className="w-1/2 rounded-xl border border-slate-200 px-2 py-2 text-xs font-normal"
                  />
                </div>
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">
                <span>Loại & Chế độ CLIL</span>
                <div className="flex gap-1.5">
                  <select
                    value={rType}
                    onChange={(e) =>
                      setRType(
                        e.target.value as
                          | "lesson_plan"
                          | "bilingual_slide"
                          | "worksheet"
                          | "glossary_card"
                      )
                    }
                    className="w-1/2 rounded-xl border border-slate-200 px-2 py-2 text-xs font-normal"
                  >
                    <option value="lesson_plan">Giáo án</option>
                    <option value="bilingual_slide">Slide</option>
                    <option value="worksheet">Phiếu HT</option>
                    <option value="glossary_card">Thẻ từ</option>
                  </select>
                  <select
                    value={rClil}
                    onChange={(e) => setRClil(e.target.value as ClilMode)}
                    className="w-1/2 rounded-xl border border-slate-200 px-2 py-2 text-xs font-normal"
                  >
                    <option value="bilingual_10">10% EN</option>
                    <option value="bilingual_50">50% EN</option>
                    <option value="full_english">100% EN</option>
                    <option value="term_only">Từ khóa</option>
                  </select>
                </div>
              </label>
            </div>

            {/* 2-Column Markdown Editor & Preview */}
            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex flex-col space-y-1 text-xs font-bold text-slate-700">
                <span>Soạn thảo Markdown *</span>
                <textarea
                  required
                  rows={12}
                  value={rMarkdown}
                  onChange={(e) => setRMarkdown(e.target.value)}
                  className="flex-1 rounded-xl border border-slate-200 p-3 font-mono text-xs font-normal outline-none focus:border-indigo-500"
                />
              </label>
              <div className="flex flex-col space-y-1">
                <span className="text-xs font-bold text-slate-700">Xem trước nội dung</span>
                <div className="max-h-72 flex-1 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
                  {rMarkdown.split("\n").map((line, i) => {
                    if (line.startsWith("# ")) {
                      return (
                        <h4 key={i} className="text-sm font-extrabold text-indigo-800">
                          {line.slice(2)}
                        </h4>
                      );
                    }
                    if (line.startsWith("## ")) {
                      return (
                        <h5 key={i} className="pt-1 text-xs font-extrabold text-slate-900">
                          {line.slice(3)}
                        </h5>
                      );
                    }
                    if (line.startsWith("- ")) {
                      return (
                        <div key={i} className="pl-3">
                          • {line.slice(2)}
                        </div>
                      );
                    }
                    return (
                      <p key={i} className="min-h-[0.75rem]">
                        {line}
                      </p>
                    );
                  })}
                </div>
              </div>
            </div>

            {isPlatformAdmin && (
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={rOfficial}
                  onChange={(e) => setROfficial(e.target.checked)}
                />
                Xuất bản là Học liệu Chuẩn quốc gia (hiển thị cho tất cả trường)
              </label>
            )}

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
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Lưu học liệu"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

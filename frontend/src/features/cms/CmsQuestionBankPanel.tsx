import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  FileSpreadsheet,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";

import { api } from "../../api/client";
import type { CmsQuestionItem, GradeLevel, LintCheckResult } from "../../api/types";
import { VALID_GRADES } from "../../utils/grades";
import { LintFeedbackBanner } from "./LintFeedbackBanner";

interface Props {
  isPlatformAdmin: boolean;
}

const SAMPLE_QUESTION_CSV = `grade,lesson_no,language,cognitive_level,discipline,prompt_text,option_a,option_b,option_c,option_d,correct_index,explanation_vi
8,8,en,know,chemistry,"Which chemical name follows IUPAC for H2SO4?",Sulfuric acid,Axit sunfuric,Hydrogen oxide,Sodium sulfate,0,"Theo TT 32/2018 dùng danh pháp Sulfuric acid."
8,15,vi,understand,physics,"Đơn vị chuẩn quốc tế SI của áp suất (Pressure) là gì?",Pascal (Pa),Newton (N),Kilogram (kg),Joule (J),0,"1 Pa = 1 N/m² theo hệ đo lường quốc tế SI."`;

export function CmsQuestionBankPanel({ isPlatformAdmin }: Props) {
  const [items, setItems] = useState<CmsQuestionItem[]>([]);
  const [total, setTotal] = useState(0);
  const [grade, setGrade] = useState<GradeLevel | "all">("all");
  const [language, setLanguage] = useState<"" | "vi" | "en">("");
  const [scope, setScope] = useState<"all" | "official" | "tenant">("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CmsQuestionItem | null>(null);
  const [qGrade, setQGrade] = useState<GradeLevel>(8);
  const [qLessonNo, setQLessonNo] = useState(8);
  const [qLang, setQLang] = useState<"vi" | "en">("en");
  const [qCog, setQCog] = useState<"know" | "understand" | "apply">("know");
  const [qDisc, setQDisc] = useState("chemistry");
  const [qPrompt, setQPrompt] = useState("");
  const [qOptions, setQOptions] = useState(["", "", "", ""]);
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qExplanation, setQExplanation] = useState("");
  const [qOfficial, setQOfficial] = useState(false);
  const [lintResult, setLintResult] = useState<LintCheckResult | null>(null);
  const [linting, setLinting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [csvOpen, setCsvOpen] = useState(false);
  const [csvText, setCsvText] = useState(SAMPLE_QUESTION_CSV);
  const [csvOfficial, setCsvOfficial] = useState(false);
  const [importing, setImporting] = useState(false);

  const loadQuestions = () => {
    setLoading(true);
    setError(null);
    api
      .cmsListQuestions({
        grade: grade === "all" ? undefined : grade,
        language: language || undefined,
        scope,
        q: query.trim() || undefined,
        limit: 80,
      })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được ngân hàng câu hỏi."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade, language, scope]);

  const openCreate = () => {
    setEditing(null);
    setQGrade(8);
    setQLessonNo(8);
    setQLang("en");
    setQCog("know");
    setQDisc("chemistry");
    setQPrompt("");
    setQOptions(["", "", "", ""]);
    setQCorrectIdx(0);
    setQExplanation("");
    setQOfficial(isPlatformAdmin);
    setLintResult(null);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (item: CmsQuestionItem) => {
    setEditing(item);
    setQGrade(item.grade);
    setQLessonNo(item.lesson_no);
    setQLang(item.language);
    const cog = item.cognitive_level;
    setQCog(cog === "understand" || cog === "apply" ? cog : "know");
    setQDisc(item.discipline);
    setQPrompt(item.prompt_text);
    const opts = [...item.options];
    while (opts.length < 4) opts.push("");
    setQOptions(opts.slice(0, 4));
    const foundIdx = opts.findIndex((o) => o === item.correct_answer);
    setQCorrectIdx(foundIdx >= 0 ? foundIdx : 0);
    setQExplanation(item.explanation_vi);
    setQOfficial(item.is_official);
    setLintResult(item.lint_report ?? null);
    setError(null);
    setModalOpen(true);
  };

  const runLintPreview = async () => {
    setLinting(true);
    setError(null);
    try {
      const res = await api.cmsLintCheck(
        [qPrompt, ...qOptions, qExplanation].join("\n"),
        qDisc
      );
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
        ? await api.cmsUpdateQuestion(editing.id, {
            grade: qGrade,
            lesson_no: qLessonNo,
            language: qLang,
            cognitive_level: qCog,
            discipline: qDisc,
            prompt_text: qPrompt,
            options: qOptions,
            correct_index: qCorrectIdx,
            explanation_vi: qExplanation,
            is_official: isPlatformAdmin ? qOfficial : undefined,
          })
        : await api.cmsCreateQuestion({
            grade: qGrade,
            lesson_no: qLessonNo,
            language: qLang,
            cognitive_level: qCog,
            discipline: qDisc,
            prompt_text: qPrompt,
            options: qOptions,
            correct_index: qCorrectIdx,
            explanation_vi: qExplanation,
            is_official: isPlatformAdmin ? qOfficial : false,
          });
      setNotice(
        `Đã lưu câu hỏi KHTN ${saved.grade} Bài ${saved.lesson_no} (${
          saved.linter_verified ? "Đạt chuẩn IUPAC" : "Cần rà soát IUPAC"
        }).`
      );
      setModalOpen(false);
      loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu câu hỏi thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: CmsQuestionItem) => {
    if (!window.confirm("Xóa câu hỏi này khỏi ngân hàng đề?")) return;
    try {
      await api.cmsDeleteQuestion(item.id);
      setNotice("Đã xóa câu hỏi.");
      loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa câu hỏi.");
    }
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setError(null);
    try {
      const res = await api.cmsImportQuestionsCsv(csvText, isPlatformAdmin ? csvOfficial : false);
      setNotice(
        `Đã import ${res.imported_count} câu (${res.verified_count} đạt chuẩn IUPAC, ${res.flagged_count} cần rà soát)${
          res.errors.length ? ` · Lỗi: ${res.errors.join(" | ")}` : ""
        }`
      );
      setCsvOpen(false);
      loadQuestions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import CSV thất bại.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Ngân hàng Câu hỏi Exam Builder ({total})
          </h2>
          <p className="text-xs text-slate-500">
            Mọi câu hỏi được chấm tự động bởi IUPAC/SI Linter trước khi đưa vào đề kiểm tra Thông tư 94/2026 (10% / 50%).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Thêm câu hỏi
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
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

      {csvOpen && (
        <form
          onSubmit={handleImportCsv}
          className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold text-emerald-900">
              Import hàng loạt câu hỏi trắc nghiệm từ CSV
            </div>
            <button
              type="button"
              onClick={() => setCsvText(SAMPLE_QUESTION_CSV)}
              className="text-[11px] font-bold text-indigo-700 underline"
            >
              Khôi phục mẫu CSV
            </button>
          </div>
          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full rounded-xl border border-emerald-200 bg-white p-2.5 font-mono text-[11px]"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {isPlatformAdmin ? (
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={csvOfficial}
                  onChange={(e) => setCsvOfficial(e.target.checked)}
                />
                Đánh dấu là Kho câu hỏi Chuẩn quốc gia (toàn hệ thống)
              </label>
            ) : (
              <span className="text-[11px] text-slate-600">
                Câu hỏi import sẽ lưu riêng cho trường của bạn.
              </span>
            )}
            <button
              type="submit"
              disabled={importing}
              className="rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {importing ? "Đang import..." : "Chạy Import & Kiểm chuẩn IUPAC"}
            </button>
          </div>
        </form>
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
          value={language}
          onChange={(e) => setLanguage(e.target.value as "" | "vi" | "en")}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold"
        >
          <option value="">VI + EN</option>
          <option value="en">Tiếng Anh (EN)</option>
          <option value="vi">Tiếng Việt (VI)</option>
        </select>

        <select
          value={scope}
          onChange={(e) => setScope(e.target.value as "all" | "official" | "tenant")}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold"
        >
          <option value="all">Tất cả nguồn</option>
          <option value="tenant">Riêng trường</option>
          <option value="official">Chuẩn hệ thống</option>
        </select>

        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadQuestions()}
            placeholder="Tìm nội dung câu hỏi..."
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
        <button
          type="button"
          onClick={loadQuestions}
          className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
        >
          Lọc
        </button>
      </div>

      {/* Question List */}
      <div className="space-y-2.5">
        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
            Đang tải câu hỏi...
          </div>
        )}
        {!loading && items.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
            Chưa có câu hỏi nào trong ngân hàng cho bộ lọc này. Hãy bấm &quot;Thêm câu hỏi&quot; hoặc
            &quot;Import CSV&quot;.
          </div>
        )}
        {!loading &&
          items.map((item) => {
            const canEdit = isPlatformAdmin || !item.is_official;
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                    <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                      KHTN {item.grade} · Bài {item.lesson_no}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 uppercase ${
                        item.language === "en"
                          ? "bg-sky-100 text-sky-800"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {item.language}
                    </span>
                    <span className="rounded-full bg-purple-50 px-2 py-0.5 text-purple-700">
                      {item.cognitive_level}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
                        item.linter_verified
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-rose-100 text-rose-800"
                      }`}
                    >
                      {item.linter_verified ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <AlertTriangle className="h-3 w-3" />
                      )}
                      {item.linter_verified ? "Chuẩn IUPAC" : "Cảnh báo IUPAC"}
                    </span>
                    {item.is_official && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                        Chuẩn quốc gia
                      </span>
                    )}
                  </div>

                  {canEdit && (
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="rounded-lg border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-100"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="rounded-lg border border-rose-200 px-2 py-1 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="mt-2 text-sm font-bold text-slate-900">{item.prompt_text}</p>
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {item.options.map((opt, idx) => (
                    <div
                      key={idx}
                      className={`rounded-lg border px-2.5 py-1.5 text-xs ${
                        opt === item.correct_answer
                          ? "border-emerald-300 bg-emerald-50 font-bold text-emerald-900"
                          : "border-slate-200 bg-slate-50 text-slate-700"
                      }`}
                    >
                      {String.fromCharCode(65 + idx)}. {opt}
                    </div>
                  ))}
                </div>
                {item.explanation_vi && (
                  <p className="mt-2 text-xs text-slate-500">Giải thích: {item.explanation_vi}</p>
                )}
              </div>
            );
          })}
      </div>

      {/* Modal Create/Edit Question */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSave}
            className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {editing ? "Chỉnh sửa câu hỏi" : "Soạn câu hỏi mới vào Ngân hàng đề"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <label className="space-y-1 text-xs font-bold text-slate-700">
                <span>Khối</span>
                <select
                  value={qGrade}
                  onChange={(e) => setQGrade(Number(e.target.value) as GradeLevel)}
                  className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-normal"
                >
                  {VALID_GRADES.map((g) => (
                    <option key={g} value={g}>
                      Lớp {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">
                <span>Bài số</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={qLessonNo}
                  onChange={(e) => setQLessonNo(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-normal"
                />
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">
                <span>Ngôn ngữ</span>
                <select
                  value={qLang}
                  onChange={(e) => setQLang(e.target.value as "vi" | "en")}
                  className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-normal"
                >
                  <option value="en">Tiếng Anh (EN)</option>
                  <option value="vi">Tiếng Việt (VI)</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">
                <span>Mức độ</span>
                <select
                  value={qCog}
                  onChange={(e) => setQCog(e.target.value as "know" | "understand" | "apply")}
                  className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-normal"
                >
                  <option value="know">Nhận biết</option>
                  <option value="understand">Thông hiểu</option>
                  <option value="apply">Vận dụng</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">
                <span>Phân môn</span>
                <select
                  value={qDisc}
                  onChange={(e) => setQDisc(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-2.5 py-2 text-xs font-normal"
                >
                  <option value="chemistry">Hóa học</option>
                  <option value="physics">Vật lí</option>
                  <option value="biology">Sinh học</option>
                  <option value="general_lab">Mở đầu</option>
                  <option value="earth_space">Trái Đất</option>
                </select>
              </label>
            </div>

            <label className="block space-y-1 text-xs font-bold text-slate-700">
              <span>Nội dung câu hỏi *</span>
              <textarea
                rows={2}
                required
                value={qPrompt}
                onChange={(e) => setQPrompt(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
              />
            </label>

            <div className="grid gap-2 sm:grid-cols-2">
              {qOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-xl border border-slate-200 p-2">
                  <input
                    type="radio"
                    name="q_correct_idx"
                    checked={qCorrectIdx === idx}
                    onChange={() => setQCorrectIdx(idx)}
                  />
                  <span className="text-xs font-extrabold text-slate-600">
                    {String.fromCharCode(65 + idx)}.
                  </span>
                  <input
                    required
                    value={opt}
                    onChange={(e) => {
                      const next = [...qOptions];
                      next[idx] = e.target.value;
                      setQOptions(next);
                    }}
                    placeholder={`Đáp án ${String.fromCharCode(65 + idx)}`}
                    className="w-full text-xs outline-none"
                  />
                </div>
              ))}
            </div>

            <label className="block space-y-1 text-xs font-bold text-slate-700">
              <span>Giải thích đáp án (Tiếng Việt)</span>
              <input
                value={qExplanation}
                onChange={(e) => setQExplanation(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
              />
            </label>

            {isPlatformAdmin && (
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={qOfficial}
                  onChange={(e) => setQOfficial(e.target.checked)}
                />
                Xuất bản vào Kho Chuẩn quốc gia (dùng chung mọi trường)
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
                  {saving ? "Đang lưu..." : "Lưu câu hỏi"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

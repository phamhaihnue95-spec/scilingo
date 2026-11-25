import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Volume2,
  X,
} from "lucide-react";

import { api } from "../../api/client";
import type { CmsTermItem, Discipline, LintCheckResult } from "../../api/types";
import { speakEnglishTerm } from "../../utils/speech";
import { DisciplineBadge } from "../curriculum/DisciplineBadge";
import { LintFeedbackBanner } from "./LintFeedbackBanner";

interface Props {
  isPlatformAdmin: boolean;
}

export function CmsGlossaryPanel({ isPlatformAdmin }: Props) {
  const [terms, setTerms] = useState<CmsTermItem[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<"all" | "verified" | "draft">("all");
  const [disciplineFilter, setDisciplineFilter] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CmsTermItem | null>(null);
  const [termEn, setTermEn] = useState("");
  const [termVi, setTermVi] = useState("");
  const [ipa, setIpa] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>("chemistry");
  const [formula, setFormula] = useState("");
  const [iupacNote, setIupacNote] = useState("");
  const [defVi, setDefVi] = useState("");
  const [defEn, setDefEn] = useState("");
  const [statusVal, setStatusVal] = useState<"draft" | "verified">("draft");
  const [lintResult, setLintResult] = useState<LintCheckResult | null>(null);
  const [linting, setLinting] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadTerms = () => {
    setLoading(true);
    setError(null);
    api
      .cmsListTerms({
        q: query.trim() || undefined,
        discipline: disciplineFilter || undefined,
        status_filter: statusFilter,
        limit: 80,
      })
      .then((res) => {
        setTerms(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được từ điển."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTerms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, disciplineFilter]);

  const openCreate = () => {
    setEditing(null);
    setTermEn("");
    setTermVi("");
    setIpa("");
    setDiscipline("chemistry");
    setFormula("");
    setIupacNote("");
    setDefVi("");
    setDefEn("");
    setStatusVal(isPlatformAdmin ? "verified" : "draft");
    setLintResult(null);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (t: CmsTermItem) => {
    setEditing(t);
    setTermEn(t.term_en);
    setTermVi(t.term_vi);
    setIpa(t.ipa ?? "");
    setDiscipline(t.discipline);
    setFormula(t.formula_or_symbol ?? "");
    setIupacNote(t.iupac_note ?? "");
    setDefVi(t.definition_vi ?? "");
    setDefEn(t.definition_en ?? "");
    setStatusVal(t.status === "verified" ? "verified" : "draft");
    setLintResult(null);
    setError(null);
    setModalOpen(true);
  };

  const runLintPreview = async () => {
    setLinting(true);
    setError(null);
    try {
      const res = await api.cmsLintCheck(
        `${termEn}\n${termVi}\n${iupacNote}\n${defVi}\n${defEn}`,
        discipline
      );
      setLintResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi chạy Linter.");
    } finally {
      setLinting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        term_en: termEn,
        term_vi: termVi,
        ipa: ipa || undefined,
        discipline,
        formula_or_symbol: formula || undefined,
        iupac_note: iupacNote || undefined,
        definition_vi: defVi || undefined,
        definition_en: defEn || undefined,
        status: isPlatformAdmin ? statusVal : ("draft" as const),
      };
      const res = editing
        ? await api.cmsUpdateTerm(editing.id, payload)
        : await api.cmsCreateTerm(payload);
      setLintResult(res.lint_report);
      setNotice(
        `Đã lưu thuật ngữ "${res.term.term_en}" (${res.term.status === "verified" ? "Đã duyệt chuẩn" : "Bản nháp"}).`
      );
      setModalOpen(false);
      loadTerms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu thuật ngữ thất bại.");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickVerify = async (t: CmsTermItem) => {
    setError(null);
    try {
      const res = await api.cmsUpdateTerm(t.id, { status: "verified" });
      setNotice(`Đã duyệt xuất bản thuật ngữ "${res.term.term_en}".`);
      loadTerms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể duyệt thuật ngữ.");
    }
  };

  const handleDelete = async (t: CmsTermItem) => {
    if (!window.confirm(`Xóa thuật ngữ "${t.term_en}" khỏi cơ sở dữ liệu?`)) return;
    setError(null);
    try {
      await api.cmsDeleteTerm(t.id);
      setNotice(`Đã xóa "${t.term_en}".`);
      loadTerms();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa thuật ngữ thất bại.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Quản lý Từ điển Thuật ngữ & Danh pháp IUPAC ({total})
          </h2>
          <p className="text-xs text-slate-500">
            {isPlatformAdmin
              ? "Platform Admin có quyền duyệt xuất bản 'verified' sau khi vượt qua IUPAC Linter."
              : "School Admin có thể đề xuất thuật ngữ mới ở trạng thái Bản nháp (draft) để duyệt."}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          {isPlatformAdmin ? "Thêm thuật ngữ mới" : "Đề xuất thuật ngữ (Nháp)"}
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
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
          {(["all", "verified", "draft"] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                statusFilter === st
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {st === "all" ? "Tất cả" : st === "verified" ? "Đã duyệt" : "Bản nháp"}
            </button>
          ))}
        </div>

        <select
          value={disciplineFilter}
          onChange={(e) => setDisciplineFilter(e.target.value)}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          <option value="">Tất cả phân môn</option>
          <option value="general_lab">Mở đầu & Đo lường</option>
          <option value="chemistry">Hóa học (IUPAC)</option>
          <option value="physics">Vật lí (SI)</option>
          <option value="biology">Sinh học (DNA/RNA)</option>
          <option value="earth_space">Trái Đất & Bầu trời</option>
        </select>

        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadTerms()}
            placeholder="Tìm từ EN, nghĩa VI, công thức..."
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
        <button
          type="button"
          onClick={loadTerms}
          className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
        >
          Lọc
        </button>
      </div>

      {/* Terms Table */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Thuật ngữ EN / IPA</th>
              <th className="px-3 py-2.5">Nghĩa Tiếng Việt & Công thức</th>
              <th className="px-3 py-2.5">Phân môn / Trạng thái</th>
              <th className="px-3 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Đang tải từ điển thuật ngữ...
                </td>
              </tr>
            )}
            {!loading && terms.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Không có thuật ngữ nào phù hợp.
                </td>
              </tr>
            )}
            {!loading &&
              terms.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-slate-900">{t.term_en}</span>
                      <button
                        type="button"
                        onClick={() => speakEnglishTerm(t.term_en, t.audio_url)}
                        title="Nghe phát âm"
                        className="rounded p-0.5 text-sky-600 hover:bg-sky-50"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {t.ipa || "—"} {t.is_13_exception_element && "· ★ 13 nguyên tố"}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-slate-800">{t.term_vi}</div>
                    {t.formula_or_symbol && (
                      <div className="text-[11px] font-mono text-indigo-700">
                        {t.formula_or_symbol}
                      </div>
                    )}
                    {t.iupac_note && (
                      <div className="mt-0.5 max-w-md truncate text-[11px] text-slate-500">
                        {t.iupac_note}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <DisciplineBadge discipline={t.discipline} />
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          t.status === "verified"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {t.status === "verified" ? "Verified" : "Draft"}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {isPlatformAdmin && t.status !== "verified" && (
                        <button
                          type="button"
                          onClick={() => handleQuickVerify(t)}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700"
                        >
                          Duyệt
                        </button>
                      )}
                      {(isPlatformAdmin || t.status === "draft") && (
                        <button
                          type="button"
                          onClick={() => openEdit(t)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-slate-700 hover:bg-slate-100"
                          title="Chỉnh sửa"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isPlatformAdmin && (
                        <button
                          type="button"
                          onClick={() => handleDelete(t)}
                          className="rounded-lg border border-rose-200 px-2 py-1 text-rose-600 hover:bg-rose-50"
                          title="Xóa"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSave}
            className="max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                {editing ? `Sửa thuật ngữ: ${editing.term_en}` : "Thêm / Đề xuất thuật ngữ KHTN"}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-xs font-bold text-slate-700">
                <span>Thuật ngữ Tiếng Anh (chuẩn IUPAC/SI) *</span>
                <input
                  value={termEn}
                  onChange={(e) => setTermEn(e.target.value)}
                  required
                  placeholder="vd: Hydrochloric acid"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal outline-none focus:border-indigo-500"
                />
              </label>
              <label className="block space-y-1 text-xs font-bold text-slate-700">
                <span>Nghĩa Tiếng Việt *</span>
                <input
                  value={termVi}
                  onChange={(e) => setTermVi(e.target.value)}
                  required
                  placeholder="vd: Dung dịch acid HCl"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal outline-none focus:border-indigo-500"
                />
              </label>
              <label className="block space-y-1 text-xs font-bold text-slate-700">
                <span>Phiên âm IPA</span>
                <input
                  value={ipa}
                  onChange={(e) => setIpa(e.target.value)}
                  placeholder="/ˌhaɪ.drəˈklɔːr.ɪk ˈæs.ɪd/"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal outline-none focus:border-indigo-500"
                />
              </label>
              <label className="block space-y-1 text-xs font-bold text-slate-700">
                <span>Công thức / Ký hiệu SI</span>
                <input
                  value={formula}
                  onChange={(e) => setFormula(e.target.value)}
                  placeholder="vd: HCl / Pa = N/m²"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal outline-none focus:border-indigo-500"
                />
              </label>
              <label className="block space-y-1 text-xs font-bold text-slate-700">
                <span>Phân môn</span>
                <select
                  value={discipline}
                  onChange={(e) => setDiscipline(e.target.value as Discipline)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
                >
                  <option value="general_lab">Mở đầu & Đo lường</option>
                  <option value="chemistry">Hóa học</option>
                  <option value="physics">Vật lí</option>
                  <option value="biology">Sinh học</option>
                  <option value="earth_space">Trái Đất & Bầu trời</option>
                </select>
              </label>
              {isPlatformAdmin && (
                <label className="block space-y-1 text-xs font-bold text-slate-700">
                  <span>Trạng thái xuất bản</span>
                  <select
                    value={statusVal}
                    onChange={(e) => setStatusVal(e.target.value as "draft" | "verified")}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
                  >
                    <option value="verified">Đã duyệt chuẩn (verified)</option>
                    <option value="draft">Bản nháp (draft)</option>
                  </select>
                </label>
              )}
            </div>

            <label className="block space-y-1 text-xs font-bold text-slate-700">
              <span>Ghi chú sư phạm / IUPAC (Thông tư 32/2018)</span>
              <input
                value={iupacNote}
                onChange={(e) => setIupacNote(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-xs font-bold text-slate-700">
                <span>Định nghĩa Tiếng Việt</span>
                <textarea
                  rows={2}
                  value={defVi}
                  onChange={(e) => setDefVi(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
                />
              </label>
              <label className="block space-y-1 text-xs font-bold text-slate-700">
                <span>Định nghĩa Tiếng Anh</span>
                <textarea
                  rows={2}
                  value={defEn}
                  onChange={(e) => setDefEn(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
                />
              </label>
            </div>

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
                  {saving ? "Đang lưu..." : "Lưu thuật ngữ"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

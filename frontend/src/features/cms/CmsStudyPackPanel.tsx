import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { api } from "../../api/client";
import type { CmsStudyPackItem, LintCheckResult } from "../../api/types";

interface Props {
  isPlatformAdmin: boolean;
}

const UNITS = Array.from({ length: 16 }, (_, idx) => idx + 1);

export function CmsStudyPackPanel({ isPlatformAdmin }: Props) {
  const [unitFilter, setUnitFilter] = useState<number | "">("");
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CmsStudyPackItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lintReport, setLintReport] = useState<LintCheckResult | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CmsStudyPackItem | null>(null);
  const [unitNo, setUnitNo] = useState(1);
  const [orderNo, setOrderNo] = useState<string>("");
  const [termEn, setTermEn] = useState("");
  const [ipa, setIpa] = useState("");
  const [pos, setPos] = useState("n");
  const [meaningVi, setMeaningVi] = useState("");
  const [iupacNote, setIupacNote] = useState("");

  const loadItems = () => {
    setLoading(true);
    setError(null);
    api
      .cmsListStudyPackItems({
        unit_no: unitFilter === "" ? undefined : unitFilter,
        q: query.trim() || undefined,
        limit: 120,
      })
      .then((res) => {
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Không tải được Bộ Đề 16 Units."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitFilter]);

  const openCreate = () => {
    setEditing(null);
    setUnitNo(unitFilter === "" ? 1 : unitFilter);
    setOrderNo("");
    setTermEn("");
    setIpa("");
    setPos("n");
    setMeaningVi("");
    setIupacNote("");
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (item: CmsStudyPackItem) => {
    setEditing(item);
    setUnitNo(item.unit_no);
    setOrderNo(String(item.order_no));
    setTermEn(item.term_en);
    setIpa(item.ipa);
    setPos(item.pos);
    setMeaningVi(item.meaning_vi);
    setIupacNote(item.iupac_note ?? "");
    setError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsedOrder = orderNo.trim() ? Number(orderNo.trim()) : undefined;
    try {
      const res = editing
        ? await api.cmsUpdateStudyPackItem(editing.id, {
            unit_no: unitNo,
            order_no: parsedOrder,
            term_en: termEn,
            ipa,
            pos,
            meaning_vi: meaningVi,
            iupac_note: iupacNote.trim() ? iupacNote.trim() : null,
          })
        : await api.cmsCreateStudyPackItem({
            unit_no: unitNo,
            order_no: parsedOrder ?? null,
            term_en: termEn,
            ipa,
            pos,
            meaning_vi: meaningVi,
            iupac_note: iupacNote.trim() ? iupacNote.trim() : null,
          });
      setLintReport(res.lint_report);
      setNotice(
        editing
          ? `Đã cập nhật mục Unit ${res.item.unit_no} #${res.item.order_no}: ${res.item.term_en}`
          : `Đã thêm mục mới Unit ${res.item.unit_no} #${res.item.order_no}: ${res.item.term_en}`
      );
      setModalOpen(false);
      loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lưu mục Bộ Đề thất bại.");
    }
  };

  const handleDelete = async (item: CmsStudyPackItem) => {
    if (!window.confirm(`Xóa "${item.term_en}" khỏi Unit ${item.unit_no}?`)) return;
    setError(null);
    try {
      await api.cmsDeleteStudyPackItem(item.id);
      setNotice(`Đã xóa "${item.term_en}" khỏi Unit ${item.unit_no}.`);
      loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xóa mục thất bại.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">
            Quản lý Bộ Đề 16 Units ({total} mục)
          </h2>
          <p className="text-xs text-slate-500">
            Mọi thay đổi ở đây cập nhật trực tiếp lên Bộ Đề 16 Units, Quiz thực hành và Mini-Game.
          </p>
        </div>

        {isPlatformAdmin && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" />
            Thêm từ vào Bộ Đề
          </button>
        )}
      </div>

      {!isPlatformAdmin && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          Ban Giám hiệu trường xem ở chế độ chỉ đọc. Chỉ Platform Admin mới được thêm/sửa/xóa mục
          trong Bộ Đề 16 Units chuẩn quốc gia.
        </div>
      )}

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

      {lintReport && !lintReport.passed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Cảnh báo IUPAC / SI ({lintReport.error_count} lỗi, {lintReport.warning_count} lưu ý):
          </div>
          <ul className="mt-1 list-disc pl-5">
            {lintReport.issues.map((iss, idx) => (
              <li key={idx}>
                "{iss.matched_text}" → đề xuất <strong>{iss.recommended}</strong> ({iss.reason})
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value ? Number(e.target.value) : "")}
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold"
        >
          <option value="">Tất cả 16 Units</option>
          {UNITS.map((u) => (
            <option key={u} value={u}>
              Unit {u}
            </option>
          ))}
        </select>
        <div className="flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-1.5">
          <Search className="h-3.5 w-3.5 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadItems()}
            placeholder="Tìm thuật ngữ EN, IPA hoặc nghĩa tiếng Việt..."
            className="w-full bg-transparent text-xs outline-none"
          />
        </div>
        <button
          type="button"
          onClick={loadItems}
          disabled={loading}
          className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white"
        >
          {loading ? "Đang tải..." : "Tìm"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-500">
            <tr>
              <th className="px-3 py-2.5">Unit / #</th>
              <th className="px-3 py-2.5">Thuật ngữ EN &amp; IPA</th>
              <th className="px-3 py-2.5">Từ loại</th>
              <th className="px-3 py-2.5">Nghĩa tiếng Việt &amp; IUPAC</th>
              {isPlatformAdmin && <th className="px-3 py-2.5 text-right">Thao tác</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr>
                <td colSpan={isPlatformAdmin ? 5 : 4} className="px-4 py-8 text-center text-slate-500">
                  Không tìm thấy mục nào phù hợp.
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-3 py-2.5">
                  <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                    U{item.unit_no} · #{item.order_no}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-bold text-slate-900">{item.term_en}</div>
                  {item.ipa && <div className="font-mono text-[11px] text-sky-700">{item.ipa}</div>}
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-slate-600">{item.pos}</td>
                <td className="px-3 py-2.5">
                  <div className="font-semibold text-slate-800">{item.meaning_vi}</div>
                  {item.iupac_note && (
                    <div className="mt-0.5 text-[11px] text-emerald-700">{item.iupac_note}</div>
                  )}
                </td>
                {isPlatformAdmin && (
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        title="Chỉnh sửa"
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-700 hover:bg-slate-100"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        title="Xóa mục"
                        className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <form
            onSubmit={handleSave}
            className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-base font-extrabold text-slate-900">
                {editing ? "Sửa mục Bộ Đề 16 Units" : "Thêm mục mới vào Bộ Đề"}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)}>
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <label className="space-y-1 text-xs font-bold text-slate-700">
                <span>Unit (1–16)</span>
                <select
                  value={unitNo}
                  onChange={(e) => setUnitNo(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      Unit {u}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">
                <span>STT (#)</span>
                <input
                  type="number"
                  min={1}
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  placeholder="Tự tăng"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
                />
              </label>
              <label className="space-y-1 text-xs font-bold text-slate-700">
                <span>Từ loại</span>
                <input
                  value={pos}
                  onChange={(e) => setPos(e.target.value)}
                  placeholder="n, v, adj..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
                />
              </label>
            </div>

            <label className="block space-y-1 text-xs font-bold text-slate-700">
              <span>Thuật ngữ tiếng Anh *</span>
              <input
                required
                value={termEn}
                onChange={(e) => setTermEn(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
              />
            </label>

            <label className="block space-y-1 text-xs font-bold text-slate-700">
              <span>Phiên âm IPA</span>
              <input
                value={ipa}
                onChange={(e) => setIpa(e.target.value)}
                placeholder="/ˈmɔː.ʃən/"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-xs font-normal"
              />
            </label>

            <label className="block space-y-1 text-xs font-bold text-slate-700">
              <span>Nghĩa tiếng Việt *</span>
              <input
                required
                value={meaningVi}
                onChange={(e) => setMeaningVi(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
              />
            </label>

            <label className="block space-y-1 text-xs font-bold text-slate-700">
              <span>Ghi chú IUPAC / SI (tùy chọn)</span>
              <textarea
                rows={2}
                value={iupacNote}
                onChange={(e) => setIupacNote(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-normal"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
              >
                {editing ? "Lưu thay đổi" : "Thêm mục"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

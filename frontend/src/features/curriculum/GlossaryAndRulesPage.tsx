import { useEffect, useState } from "react";
import { AlertCircle, BookMarked, Search, ShieldCheck, Volume2 } from "lucide-react";

import { api } from "../../api/client";
import type {
  Discipline,
  TermDetail,
  TermSummary,
  TerminologyRulebook,
} from "../../api/types";
import { speakEnglishTerm } from "../../utils/speech";
import { DisciplineBadge } from "./DisciplineBadge";

interface Props {
  onSelectLesson: (lessonNo: number) => void;
}

export function GlossaryAndRulesPage({ onSelectLesson }: Props) {
  const [tab, setTab] = useState<"glossary" | "iupac">("glossary");
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState<"" | Discipline>("");
  const [terms, setTerms] = useState<TermSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedTerm, setSelectedTerm] = useState<TermDetail | null>(null);
  const [rulebook, setRulebook] = useState<TerminologyRulebook | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .searchTerms({
          q: query || undefined,
          discipline: discipline || undefined,
          limit: 100,
        })
        .then((res) => {
          if (!active) return;
          setTerms(res.items);
          setTotal(res.total);
        })
        .catch(() => {
          if (!active) return;
          setTerms([]);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 180);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, discipline]);

  useEffect(() => {
    api
      .getIupacRules()
      .then(setRulebook)
      .catch(() => setRulebook(null));
  }, []);

  const handleOpenTerm = (slug: string) => {
    api
      .getTermDetail(slug)
      .then(setSelectedTerm)
      .catch(() => setSelectedTerm(null));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Từ điển Song ngữ & Cẩm nang Chuẩn IUPAC / SI
          </h1>
          <p className="text-sm text-slate-600">
            Nguồn chuẩn hóa duy nhất cho học sinh lớp 8 và công cụ kiểm lỗi giáo án của giáo viên.
          </p>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setTab("glossary")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium ${
              tab === "glossary" ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <BookMarked className="h-4 w-4" />
            Tra cứu Từ điển ({total})
          </button>
          <button
            type="button"
            onClick={() => setTab("iupac")}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium ${
              tab === "iupac" ? "bg-teal-700 text-white" : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            13 Ngoại lệ IUPAC & Lỗi hay gặp
          </button>
        </div>
      </div>

      {tab === "glossary" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm tiếng Anh, tiếng Việt hoặc công thức (vd: Sulfuric, Pa, HCl, quang hợp)..."
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
              />
            </div>

            <select
              value={discipline}
              onChange={(e) => setDiscipline(e.target.value as "" | Discipline)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 focus:outline-none"
            >
              <option value="">Tất cả phân môn</option>
              <option value="general_lab">Phòng thí nghiệm</option>
              <option value="chemistry">Hóa học (IUPAC)</option>
              <option value="physics">Vật lí (SI)</option>
              <option value="biology">Sinh học</option>
            </select>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-2.5 lg:col-span-2">
              {loading && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                  Đang tìm kiếm...
                </div>
              )}

              {!loading &&
                terms.map((term) => (
                  <div
                    key={term.id}
                    onClick={() => handleOpenTerm(term.slug)}
                    className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-400"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900">{term.term_en}</span>
                        {term.ipa && (
                          <span className="formula-pill text-xs text-slate-500">{term.ipa}</span>
                        )}
                        {term.formula_or_symbol && (
                          <span className="formula-pill rounded bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-800">
                            {term.formula_or_symbol}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-700">{term.term_vi}</div>
                    </div>

                    <div className="flex items-center gap-2">
                      <DisciplineBadge discipline={term.discipline} />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          speakEnglishTerm(term.term_en, term.audio_url);
                        }}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
            </div>

            {/* Detail Side Panel */}
            <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:h-fit">
              {selectedTerm ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">{selectedTerm.term_en}</h2>
                      <p className="formula-pill text-xs text-slate-500">{selectedTerm.ipa}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => speakEnglishTerm(selectedTerm.term_en, selectedTerm.audio_url)}
                      className="inline-flex items-center gap-1 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-800"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      Phát âm
                    </button>
                  </div>

                  <div>
                    <div className="text-xs font-semibold uppercase text-slate-400">Nghĩa SGK</div>
                    <div className="text-base font-semibold text-slate-800">
                      {selectedTerm.term_vi}
                    </div>
                  </div>

                  {selectedTerm.formula_or_symbol && (
                    <div>
                      <div className="text-xs font-semibold uppercase text-slate-400">
                        Ký hiệu / Công thức
                      </div>
                      <div className="formula-pill mt-1 inline-block rounded-md bg-sky-50 px-3 py-1 text-sm font-semibold text-sky-900">
                        {selectedTerm.formula_or_symbol}
                      </div>
                    </div>
                  )}

                  {selectedTerm.iupac_note && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                      <strong>Ghi chú chuẩn hóa: </strong>
                      {selectedTerm.iupac_note}
                    </div>
                  )}

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase text-slate-400">
                      Xuất hiện trong bài học
                    </div>
                    <div className="space-y-1.5">
                      {selectedTerm.lessons.map((ref) => (
                        <button
                          key={ref.lesson_no}
                          type="button"
                          onClick={() => onSelectLesson(ref.lesson_no)}
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-xs font-medium text-teal-800 hover:bg-teal-50"
                        >
                          Bài {ref.lesson_no}: {ref.title_vi}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-sm text-slate-500">
                  Chọn một thuật ngữ bên trái để xem IPA, công thức và bài học liên quan.
                </div>
              )}
            </aside>
          </div>
        </div>
      )}

      {tab === "iupac" && rulebook && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              13 Nguyên tố Ngoại lệ (Thông tư 32/2018/TT-BGDĐT)
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Được giữ tên tiếng Việt ở dạng đơn chất / vật thể đời sống, nhưng{" "}
              <strong className="text-slate-900">bắt buộc dùng tên tiếng Anh chuẩn IUPAC</strong>{" "}
              khi tạo thành hợp chất.
            </p>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
                    <th className="px-3 py-2.5">Ký hiệu</th>
                    <th className="px-3 py-2.5">Tên tiếng Việt (Đơn chất)</th>
                    <th className="px-3 py-2.5">IUPAC Tiếng Anh</th>
                    <th className="px-3 py-2.5">Ngữ cảnh đời sống hợp lệ</th>
                    <th className="px-3 py-2.5">Hợp chất bắt buộc IUPAC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rulebook.exception_13_elements.map((el) => (
                    <tr key={el.symbol} className="hover:bg-slate-50">
                      <td className="formula-pill px-3 py-2 font-bold text-teal-800">{el.symbol}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{el.vi_elemental}</td>
                      <td className="px-3 py-2 font-semibold text-amber-800">{el.iupac_en}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">
                        {el.allowed_elemental_contexts.join(", ")}
                      </td>
                      <td className="px-3 py-2 font-medium text-sky-900">
                        {el.compound_example_iupac}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900">
              Danh mục Cách viết cũ cần thay thế (Terminology Guardrail Rules)
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rulebook.deprecated_terms_to_flag.map((rule) => (
                <div
                  key={rule.pattern}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold uppercase text-rose-700">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {rule.severity}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{rule.discipline}</span>
                  </div>
                  <div className="mt-2 text-sm">
                    <span className="formula-pill line-through text-rose-700">{rule.pattern}</span>
                    <span className="mx-2 text-slate-400">→</span>
                    <span className="font-bold text-teal-800">{rule.recommended}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600">{rule.reason}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { BookOpen, FlaskConical, Link2, Search, Sparkles } from "lucide-react";

import { api } from "../../api/client";
import type { CurriculumTreeResponse, Discipline } from "../../api/types";
import { DisciplineBadge } from "./DisciplineBadge";

interface Props {
  onSelectLesson: (lessonNo: number) => void;
}

const DISCIPLINE_TABS: Array<{ id: "all" | Discipline; label: string }> = [
  { id: "all", label: "Tất cả (47 bài)" },
  { id: "general_lab", label: "Phòng thí nghiệm" },
  { id: "chemistry", label: "Hóa học (IUPAC)" },
  { id: "physics", label: "Vật lí (SI)" },
  { id: "biology", label: "Sinh học" },
];

export function CurriculumMapPage({ onSelectLesson }: Props) {
  const [tree, setTree] = useState<CurriculumTreeResponse | null>(null);
  const [discipline, setDiscipline] = useState<"all" | Discipline>("all");
  const [filterText, setFilterText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getChapters(discipline === "all" ? undefined : discipline)
      .then((data) => {
        if (!active) return;
        setTree(data);
        setError(null);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [discipline]);

  const filteredChapters = useMemo(() => {
    if (!tree) return [];
    const needle = filterText.trim().toLowerCase();
    if (!needle) return tree.chapters;

    return tree.chapters
      .map((ch) => ({
        ...ch,
        lessons: ch.lessons.filter(
          (l) =>
            String(l.lesson_no) === needle ||
            l.title_vi.toLowerCase().includes(needle) ||
            l.title_en.toLowerCase().includes(needle)
        ),
      }))
      .filter((ch) => ch.lessons.length > 0);
  }, [tree, filterText]);

  return (
    <div className="space-y-6">
      {/* Hero Summary Card */}
      <section className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-700 via-teal-800 to-slate-900 p-6 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-teal-100">
              <Sparkles className="h-3.5 w-3.5" />
              SGK Thống nhất Toàn quốc · Kết nối tri thức với cuộc sống (QĐ 3588/QĐ-BGDĐT)
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Bản đồ Chương trình Tiếng Anh KHTN 8
            </h1>
            <p className="max-w-2xl text-sm text-teal-100">
              Trọn bộ 47 bài học tích hợp (Hóa học IUPAC · Vật lí SI · Sinh học) sẵn sàng cho lộ trình
              dạy học song ngữ và kiểm tra định kỳ 10%–50% tiếng Anh theo Thông tư 94/2026/TT-BGDĐT.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <div className="text-2xl font-bold">{tree?.total_lessons ?? 47}</div>
              <div className="text-xs text-teal-100">Bài học</div>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <div className="text-2xl font-bold">8 + 1</div>
              <div className="text-xs text-teal-100">Chương</div>
            </div>
            <div className="rounded-xl bg-white/10 px-4 py-3 backdrop-blur-sm">
              <div className="text-2xl font-bold">13</div>
              <div className="text-xs text-teal-100">Ngoại lệ IUPAC</div>
            </div>
          </div>
        </div>
      </section>

      {/* Filter & Quick Jump Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {DISCIPLINE_TABS.map((tab) => {
            const active = discipline === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDiscipline(tab.id)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-teal-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Tìm số bài (vd: 8) hoặc tên bài..."
            className="w-full rounded-lg border border-slate-300 py-1.5 pl-9 pr-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
          />
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Đang tải bản đồ 47 bài KHTN 8...
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Không thể kết nối Backend API: {error}. Hãy đảm bảo FastAPI đang chạy tại cổng 8000.
        </div>
      )}

      {/* Chapter Cards */}
      {!loading && !error && (
        <div className="space-y-5">
          {filteredChapters.map((chapter) => (
            <section
              key={chapter.id}
              className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-col gap-2 border-b border-slate-100 bg-slate-50/80 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{chapter.title_vi}</h2>
                  <p className="text-xs font-medium text-slate-500">{chapter.title_en}</p>
                </div>
                <DisciplineBadge discipline={chapter.discipline} />
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {chapter.lessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => onSelectLesson(lesson.lesson_no)}
                    className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-teal-500 hover:bg-teal-50/30 hover:shadow-sm"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 rounded-md bg-teal-50 px-2 py-0.5 text-xs font-bold text-teal-800">
                          <BookOpen className="h-3 w-3" />
                          Bài {lesson.lesson_no}
                        </span>
                        {lesson.is_practical && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                            <FlaskConical className="h-3 w-3" />
                            Thực hành
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-slate-900 group-hover:text-teal-800">
                        {lesson.title_vi}
                      </h3>
                      <p className="text-xs font-medium text-slate-500">{lesson.title_en}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                      <span>{lesson.term_count} thuật ngữ chuẩn</span>
                      {lesson.integration_count > 0 && (
                        <span className="inline-flex items-center gap-1 font-medium text-teal-700">
                          <Link2 className="h-3 w-3" />
                          {lesson.integration_count} liên kết
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

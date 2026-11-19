import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, BookOpen, FlaskConical, Library, Link2, Search, Sparkles } from "lucide-react";

import { api } from "../../api/client";
import type { CurriculumTreeResponse, Discipline } from "../../api/types";
import { ScienceAmbientParticles } from "../../components/motion/MotionPrimitives";
import { playClickSound } from "../../utils/soundFx";
import { DisciplineBadge } from "./DisciplineBadge";

interface Props {
  onSelectLesson: (lessonNo: number) => void;
  onOpenStudyPack?: () => void;
}

const CHAPTER_ACCENT: Record<Discipline, { headerBg: string; cardHover: string; badge: string }> = {
  general_lab: {
    headerBg: "bg-gradient-to-r from-violet-50 via-fuchsia-50 to-white border-b border-violet-100",
    cardHover: "hover:border-violet-400 hover:bg-violet-50/40",
    badge: "bg-violet-100 text-violet-800",
  },
  chemistry: {
    headerBg: "bg-gradient-to-r from-amber-50 via-orange-50 to-white border-b border-orange-100",
    cardHover: "hover:border-orange-400 hover:bg-orange-50/40",
    badge: "bg-orange-100 text-orange-800",
  },
  physics: {
    headerBg: "bg-gradient-to-r from-sky-50 via-cyan-50 to-white border-b border-sky-100",
    cardHover: "hover:border-sky-400 hover:bg-sky-50/40",
    badge: "bg-sky-100 text-sky-800",
  },
  biology: {
    headerBg: "bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-b border-emerald-100",
    cardHover: "hover:border-emerald-400 hover:bg-emerald-50/40",
    badge: "bg-emerald-100 text-emerald-800",
  },
};

const DISCIPLINE_TABS: Array<{ id: "all" | Discipline; label: string }> = [
  { id: "all", label: "Tất cả (47 bài)" },
  { id: "general_lab", label: "Phòng thí nghiệm" },
  { id: "chemistry", label: "Hóa học (IUPAC)" },
  { id: "physics", label: "Vật lí (SI)" },
  { id: "biology", label: "Sinh học" },
];

export function CurriculumMapPage({ onSelectLesson, onOpenStudyPack }: Props) {
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
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-sky-500 to-teal-400 p-6 text-white shadow-lg sm:p-7">
        <ScienceAmbientParticles />
        <div className="pointer-events-none absolute -right-10 -top-12 h-52 w-52 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-1/3 h-44 w-44 rounded-full bg-amber-300/25 blur-2xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2.5">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-white/20 px-3.5 py-1 text-xs font-bold text-white backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
              <span>Trường THCS Cầu Giấy B · Giáo viên Phạm Thị Hải</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Bản đồ Chương trình Tiếng Anh KHTN 8
            </h1>
            <p className="max-w-2xl text-sm text-sky-50">
              Trọn bộ 47 bài học tích hợp SGK Kết nối tri thức (Hóa học IUPAC · Vật lí SI · Sinh học)
              kèm bộ từ điển & đề luyện 16 Units theo Thông tư 94/2026/TT-BGDĐT.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { value: tree?.total_lessons ?? 47, label: "Bài học" },
              { value: "16", label: "Chuyên đề" },
              { value: "920+", label: "Từ vựng IPA" },
            ].map((stat) => (
              <motion.div
                key={stat.label}
                whileHover={{ y: -4, scale: 1.04 }}
                transition={{ type: "spring", stiffness: 360, damping: 22 }}
                className="rounded-2xl bg-white/20 px-4 py-3 backdrop-blur-sm"
              >
                <div className="text-2xl font-extrabold">{stat.value}</div>
                <div className="text-xs font-medium text-sky-50">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {onOpenStudyPack && (
        <motion.section
          whileHover={{ y: -2 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          className="holo-card flex flex-col items-start justify-between gap-4 rounded-2xl border border-fuchsia-200 bg-gradient-to-r from-fuchsia-50 via-indigo-50 to-sky-50 p-4 shadow-sm sm:flex-row sm:items-center sm:px-5"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-indigo-600 text-white shadow">
              <Library className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-fuchsia-600 px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
                  Mới cập nhật
                </span>
                <h2 className="text-sm font-extrabold text-slate-900 sm:text-base">
                  Bộ Đề Học & Từ điển Khoa học 16 Units (The English Dictionary for SCIENCE)
                </h2>
              </div>
              <p className="mt-0.5 text-xs text-slate-600">
                Trọn bộ 16 chuyên đề (920 thuật ngữ chuẩn IPA) với thẻ lật Flashcard, nghe phát âm và
                bài thi thử 10% / 50% / 100% tiếng Anh.
              </p>
            </div>
          </div>
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={onOpenStudyPack}
            className="btn-tactile inline-flex shrink-0 items-center gap-1.5 rounded-xl border-indigo-800 bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-4 py-2 text-xs font-extrabold text-white shadow hover:opacity-95 sm:text-sm"
          >
            Mở Bộ Đề 16 Units
            <ArrowRight className="h-4 w-4" />
          </motion.button>
        </motion.section>
      )}

      {/* Filter & Quick Jump Controls */}
      <div className="flex flex-col gap-3 rounded-2xl border border-sky-100 bg-white/95 p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {DISCIPLINE_TABS.map((tab) => {
            const active = discipline === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  playClickSound();
                  setDiscipline(tab.id);
                }}
                className={`relative rounded-xl px-3.5 py-1.5 text-sm font-bold transition-colors ${
                  active ? "text-white" : "bg-slate-100 text-slate-700 hover:bg-sky-50"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="discipline-tab-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 shadow-sm"
                  />
                )}
                <span className="relative z-10">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-sky-500" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Tìm số bài (vd: 8) hoặc tên bài..."
            className="w-full rounded-xl border border-sky-200 bg-sky-50/40 py-1.5 pl-9 pr-3 text-sm focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
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
          Không thể kết nối Backend API ({error}). Nếu đang chạy bản GitHub Pages + Render Free,
          server Backend có thể đang khởi động lại (~30–50 giây) hoặc chưa cấu hình biến{" "}
          <code>VITE_API_BASE_URL</code>.
        </div>
      )}

      {/* Chapter Cards */}
      {!loading && !error && (
        <div className="space-y-5">
          {filteredChapters.map((chapter) => {
            const accent = CHAPTER_ACCENT[chapter.discipline] ?? CHAPTER_ACCENT.general_lab;
            return (
              <section
                key={chapter.id}
                className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-sm"
              >
                <div
                  className={`flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between ${accent.headerBg}`}
                >
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">{chapter.title_vi}</h2>
                    <p className="text-xs font-semibold text-slate-500">{chapter.title_en}</p>
                  </div>
                  <DisciplineBadge discipline={chapter.discipline} />
                </div>

                <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {chapter.lessons.map((lesson, idx) => {
                    const cardAccent = CHAPTER_ACCENT[lesson.discipline] ?? accent;
                    return (
                      <motion.button
                        key={lesson.id}
                        type="button"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.2) }}
                        whileHover={{ y: -4, scale: 1.015 }}
                        whileTap={{ scale: 0.985 }}
                        onClick={() => onSelectLesson(lesson.lesson_no)}
                        className={`group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:shadow-md ${cardAccent.cardHover}`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-extrabold ${cardAccent.badge}`}
                            >
                              <BookOpen className="h-3 w-3" />
                              Bài {lesson.lesson_no}
                            </span>
                            {lesson.is_practical && (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-fuchsia-100 px-2 py-0.5 text-xs font-bold text-fuchsia-800">
                                <FlaskConical className="h-3 w-3" />
                                Thực hành
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-slate-900 group-hover:text-indigo-700">
                            {lesson.title_vi}
                          </h3>
                          <p className="text-xs font-medium text-slate-500">{lesson.title_en}</p>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
                          <span>{lesson.term_count} thuật ngữ chuẩn</span>
                          {lesson.integration_count > 0 && (
                            <span className="inline-flex items-center gap-1 font-bold text-sky-700">
                              <Link2 className="h-3 w-3" />
                              {lesson.integration_count} liên kết
                            </span>
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

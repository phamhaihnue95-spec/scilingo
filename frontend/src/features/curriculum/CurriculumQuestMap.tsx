import { useMemo } from "react";
import { motion } from "framer-motion";
import { BookOpen, FlaskConical, Link2, Sparkles, Star } from "lucide-react";

import type { ChapterWithLessons, Discipline, LessonSummary } from "../../api/types";
import {
  BioDiagram,
  DISCIPLINE_3D_ICON,
  DISCIPLINE_BIO_DIAGRAM,
  Icon3D,
} from "../../components/visuals/ScienceVisuals";
import { playClickSound } from "../../utils/soundFx";
import { DisciplineBadge } from "./DisciplineBadge";

interface Props {
  chapters: ChapterWithLessons[];
  lessonStars: Record<number, number>;
  onSelectLesson: (lessonNo: number) => void;
}

const REGION_STYLE: Record<
  Discipline,
  {
    regionName: string;
    cardBg: string;
    headerBg: string;
    nodeBg: string;
    nodeBorder: string;
    stroke: string;
    halo: string;
    pillBg: string;
  }
> = {
  general_lab: {
    regionName: "Xưởng Thí Nghiệm Khởi Đầu",
    cardBg: "from-violet-50/90 via-fuchsia-50/40 to-white border-violet-200",
    headerBg: "from-violet-600 to-fuchsia-600",
    nodeBg: "from-violet-500 to-fuchsia-600",
    nodeBorder: "border-violet-800",
    stroke: "#8b5cf6",
    halo: "bg-violet-400",
    pillBg: "bg-violet-100 text-violet-800",
  },
  chemistry: {
    regionName: "Thung Lũng Nguyên Tử & IUPAC",
    cardBg: "from-amber-50/90 via-orange-50/40 to-white border-orange-200",
    headerBg: "from-amber-500 to-orange-600",
    nodeBg: "from-amber-500 to-orange-600",
    nodeBorder: "border-orange-800",
    stroke: "#f59e0b",
    halo: "bg-amber-400",
    pillBg: "bg-orange-100 text-orange-800",
  },
  physics: {
    regionName: "Thành Phố Điện & Áp Suất SI",
    cardBg: "from-sky-50/90 via-cyan-50/40 to-white border-sky-200",
    headerBg: "from-sky-500 to-indigo-600",
    nodeBg: "from-sky-500 to-indigo-600",
    nodeBorder: "border-indigo-800",
    stroke: "#0ea5e9",
    halo: "bg-sky-400",
    pillBg: "bg-sky-100 text-sky-800",
  },
  biology: {
    regionName: "Rừng Sinh Quyển Tích Hợp",
    cardBg: "from-emerald-50/90 via-teal-50/40 to-white border-emerald-200",
    headerBg: "from-emerald-500 to-teal-600",
    nodeBg: "from-emerald-500 to-teal-600",
    nodeBorder: "border-emerald-800",
    stroke: "#10b981",
    halo: "bg-emerald-400",
    pillBg: "bg-emerald-100 text-emerald-800",
  },
};

// Gentle sinusoidal X offsets across nodes (percent in [20..80]) for a winding S-curve feel
const CURVE_X_PERCENTS = [50, 74, 80, 62, 34, 20, 32, 62];
const ROW_STEP = 166;
const TOP_OFFSET = 58;

function getNodeXPercent(index: number): number {
  return CURVE_X_PERCENTS[index % CURVE_X_PERCENTS.length];
}

function buildSvgPath(count: number): { height: number; d: string } {
  const height = Math.max(180, count * ROW_STEP + 32);
  if (count <= 1) {
    return { height, d: "" };
  }
  const points = Array.from({ length: count }, (_, idx) => ({
    x: getNodeXPercent(idx) * 8, // mapped into viewBox width=800
    y: TOP_OFFSET + idx * ROW_STEP,
  }));

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p1 = points[i];
    const p2 = points[i + 1];
    const midY = (p1.y + p2.y) / 2;
    d += ` C ${p1.x} ${midY}, ${p2.x} ${midY}, ${p2.x} ${p2.y}`;
  }
  return { height, d };
}

function findNextLessonNo(chapters: ChapterWithLessons[], lessonStars: Record<number, number>): number | null {
  for (const ch of chapters) {
    for (const l of ch.lessons) {
      if ((lessonStars[l.lesson_no] ?? 0) === 0) {
        return l.lesson_no;
      }
    }
  }
  return chapters[0]?.lessons[0]?.lesson_no ?? null;
}

export function CurriculumQuestMap({ chapters, lessonStars, onSelectLesson }: Props) {
  const nextLessonNo = useMemo(
    () => findNextLessonNo(chapters, lessonStars),
    [chapters, lessonStars]
  );

  if (chapters.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
        Không tìm thấy bài học phù hợp trên bản đồ hành trình.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {chapters.map((chapter) => {
        const theme = REGION_STYLE[chapter.discipline] ?? REGION_STYLE.general_lab;
        const { height, d } = buildSvgPath(chapter.lessons.length);
        const completedInChapter = chapter.lessons.filter(
          (l) => (lessonStars[l.lesson_no] ?? 0) > 0
        ).length;

        return (
          <section
            key={chapter.id}
            className={`overflow-hidden rounded-3xl border bg-gradient-to-b shadow-sm ${theme.cardBg}`}
          >
            {/* Region Header */}
            <div className="flex flex-col gap-3 border-b border-white/70 bg-white/80 px-5 py-4 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br p-1.5 text-white shadow ring-2 ring-white/50 ${theme.headerBg}`}
                >
                  <Icon3D name={DISCIPLINE_3D_ICON[chapter.discipline] ?? "microscope"} size={32} />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${theme.pillBg}`}>
                      {theme.regionName}
                    </span>
                    <span className="text-xs font-bold text-slate-500">
                      {completedInChapter}/{chapter.lessons.length} bài đạt sao
                    </span>
                  </div>
                  <h2 className="mt-1 text-base font-extrabold text-slate-900">
                    {chapter.title_vi}
                  </h2>
                  <p className="text-xs font-semibold text-slate-500">{chapter.title_en}</p>
                </div>
              </div>
              <DisciplineBadge discipline={chapter.discipline} />
            </div>

            {/* Winding SVG Trail */}
            <div className="relative mx-auto max-w-4xl px-4 py-4 sm:px-6" style={{ minHeight: height }}>
              <BioDiagram
                name={DISCIPLINE_BIO_DIAGRAM[chapter.discipline] ?? "distillation"}
                className="pointer-events-none absolute right-4 top-6 h-40 w-40 opacity-[0.08]"
              />
              {d && (
                <svg
                  viewBox={`0 0 800 ${height}`}
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute inset-0 h-full w-full"
                  aria-hidden="true"
                >
                  {/* Soft background track */}
                  <path
                    d={d}
                    fill="none"
                    stroke="rgba(148,163,184,0.28)"
                    strokeWidth="12"
                    strokeLinecap="round"
                  />
                  {/* Animated glowing dashed trail */}
                  <motion.path
                    d={d}
                    fill="none"
                    stroke={theme.stroke}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray="14 14"
                    initial={{ pathLength: 0, opacity: 0.3 }}
                    animate={{ pathLength: 1, opacity: 0.85 }}
                    transition={{ duration: 0.9, ease: "easeOut" }}
                  />
                </svg>
              )}

              {/* Lesson Quest Nodes */}
              <div className="relative" style={{ height }}>
                {chapter.lessons.map((lesson: LessonSummary, idx: number) => {
                  const stars = lessonStars[lesson.lesson_no] ?? 0;
                  const isNext = lesson.lesson_no === nextLessonNo;
                  const xPct = getNodeXPercent(idx);
                  const topPx = TOP_OFFSET + idx * ROW_STEP - 32;
                  const cardOnRight = xPct <= 55;

                  return (
                    <div
                      key={lesson.id}
                      style={{ top: topPx, left: `${xPct}%` }}
                      className="absolute -translate-x-1/2"
                    >
                      <div className="relative flex flex-col items-center">
                        {/* Pulsing halo for next recommended lesson */}
                        {isNext && (
                          <motion.span
                            animate={{ scale: [1, 1.38, 1], opacity: [0.65, 0.1, 0.65] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            className={`pointer-events-none absolute -inset-1.5 rounded-full ${theme.halo}`}
                          />
                        )}

                        <motion.button
                          type="button"
                          whileHover={{ scale: 1.1, y: -3 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => {
                            playClickSound();
                            onSelectLesson(lesson.lesson_no);
                          }}
                          className={`btn-tactile relative z-10 flex h-16 w-16 flex-col items-center justify-center rounded-full border-b-4 bg-gradient-to-br text-white shadow-lg ${theme.nodeBg} ${theme.nodeBorder}`}
                          title={`Bài ${lesson.lesson_no}: ${lesson.title_vi}`}
                        >
                          {lesson.is_practical ? (
                            <FlaskConical className="h-4 w-4 text-amber-200" />
                          ) : (
                            <BookOpen className="h-3.5 w-3.5 opacity-90" />
                          )}
                          <span className="text-sm font-black leading-none">
                            B{lesson.lesson_no}
                          </span>
                        </motion.button>

                        {/* 3-Star Progress Row */}
                        <div className="relative z-10 -mt-2 flex items-center gap-0.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 shadow-sm">
                          {[1, 2, 3].map((sIdx) =>
                            stars >= sIdx ? (
                              <Icon3D key={sIdx} name="glowing_star" size={14} />
                            ) : (
                              <Star
                                key={sIdx}
                                className="h-3 w-3 fill-slate-100 text-slate-300"
                              />
                            )
                          )}
                        </div>

                        {/* Floating Label Card */}
                        <button
                          type="button"
                          onClick={() => {
                            playClickSound();
                            onSelectLesson(lesson.lesson_no);
                          }}
                          className={`mt-1.5 w-48 rounded-2xl border bg-white/95 px-3 py-2 text-left shadow-sm transition hover:border-indigo-400 hover:shadow-md sm:absolute sm:top-0 sm:mt-0 sm:w-56 ${
                            cardOnRight ? "sm:left-20" : "sm:right-20"
                          } ${isNext ? "border-amber-400 ring-2 ring-amber-200" : "border-slate-200"}`}
                        >
                          <div className="flex items-center justify-between gap-1 text-[10px] font-extrabold uppercase text-slate-500">
                            <span>Bài {lesson.lesson_no}</span>
                            {isNext && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-800">
                                <Sparkles className="h-2.5 w-2.5" />
                                Tiếp theo
                              </span>
                            )}
                          </div>
                          <div className="line-clamp-2 text-xs font-extrabold text-slate-900">
                            {lesson.title_vi}
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                            <span>{lesson.term_count} từ</span>
                            {lesson.integration_count > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-sky-700">
                                <Link2 className="h-2.5 w-2.5" />
                                {lesson.integration_count}
                              </span>
                            )}
                          </div>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

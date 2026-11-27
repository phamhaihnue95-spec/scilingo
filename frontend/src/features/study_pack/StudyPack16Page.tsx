import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  Play,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
  Target,
  X,
  XCircle,
  Zap,
} from "lucide-react";

import { api } from "../../api/client";
import type {
  AuthSession,
  Discipline,
  GradeLevel,
  PracticeMode,
  StudyPackItem,
  StudyPackOverview,
  StudyPackQuiz,
  StudyPackUnitDetail,
} from "../../api/types";
import {
  AnimatedScoreCounter,
  FlipCard3D,
  FloatingXPBurst,
  ScienceAmbientParticles,
  SpeakButton,
} from "../../components/motion/MotionPrimitives";
import { Icon3D, STUDY_PACK_UNIT_3D_ICON } from "../../components/visuals/ScienceVisuals";
import { fireSuccessSpark, fireVictoryCelebration } from "../../utils/confetti";
import { emitPetCelebration } from "../../utils/petEvents";
import { unlockLocalSciDexUnit } from "../../utils/scidex";
import {
  playCelebrationSound,
  playClickSound,
  playSuccessSound,
} from "../../utils/soundFx";
import { DisciplineBadge } from "../curriculum/DisciplineBadge";

interface Props {
  session?: AuthSession | null;
  grade?: GradeLevel;
  initialUnitNo?: number;
  onSelectLesson: (lessonNo: number, grade?: GradeLevel) => void;
  onLaunchLightningUnit?: (unitNo: number) => void;
}

type StudyMode = "list" | "flashcards" | "quiz";

const DISC_CARD_STYLE: Record<Discipline, { active: string; chip: string }> = {
  general_lab: {
    active: "border-violet-500 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md",
    chip: "bg-violet-100 text-violet-800",
  },
  physics: {
    active: "border-sky-500 bg-gradient-to-r from-sky-600 to-cyan-500 text-white shadow-md",
    chip: "bg-sky-100 text-sky-800",
  },
  chemistry: {
    active: "border-orange-500 bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-md",
    chip: "bg-orange-100 text-orange-800",
  },
  biology: {
    active: "border-emerald-500 bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-md",
    chip: "bg-emerald-100 text-emerald-800",
  },
};

export function StudyPack16Page({
  session,
  grade = 8,
  initialUnitNo,
  onSelectLesson,
  onLaunchLightningUnit,
}: Props) {
  const [overview, setOverview] = useState<StudyPackOverview | null>(null);
  const [activeUnitNo, setActiveUnitNo] = useState<number>(initialUnitNo ?? 1);
  const [unitDetail, setUnitDetail] = useState<StudyPackUnitDetail | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<StudyPackItem[] | null>(null);
  const [searchTotal, setSearchTotal] = useState(0);

  const [mode, setMode] = useState<StudyMode>("list");
  const [mobileUnitDrawerOpen, setMobileUnitDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);

  const selectUnit = (unitNo: number, scrollOnMobile = false) => {
    playClickSound();
    setActiveUnitNo(unitNo);
    setSearchQuery("");
    setMobileUnitDrawerOpen(false);
    setQuizUnits((prev) => (prev.includes(unitNo) ? prev : [unitNo]));
    if (scrollOnMobile) {
      window.setTimeout(() => {
        workspaceRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 60);
    }
  };

  // Flashcard state
  const [fcIndex, setFcIndex] = useState(0);
  const [fcFlipped, setFcFlipped] = useState(false);
  const [fcOrder, setFcOrder] = useState<number[]>([]);
  const [fcDir, setFcDir] = useState<1 | -1>(1);
  const [fcBurstKey, setFcBurstKey] = useState(0);
  const [masteredKeys, setMasteredKeys] = useState<Record<string, boolean>>({});

  // Quiz state
  const [quizUnits, setQuizUnits] = useState<number[]>([initialUnitNo ?? 1]);
  const [quizMode, setQuizMode] = useState<PracticeMode>("quiz_50");
  const [quizCount, setQuizCount] = useState<number>(10);
  const [quizData, setQuizData] = useState<StudyPackQuiz | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizBusy, setQuizBusy] = useState(false);
  const [unlockedSciDexUnit, setUnlockedSciDexUnit] = useState<number | null>(null);

  useEffect(() => {
    if (initialUnitNo !== undefined) {
      setActiveUnitNo(initialUnitNo);
      setQuizUnits([initialUnitNo]);
    }
  }, [initialUnitNo]);

  useEffect(() => {
    setLoading(true);
    api
      .getStudyPackOverview()
      .then((res) => {
        setOverview(res);
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let active = true;
    api
      .getStudyPackUnit(activeUnitNo)
      .then((res) => {
        if (!active) return;
        setUnitDetail(res);
        setFcOrder(res.items.map((_, idx) => idx));
        setFcIndex(0);
        setFcFlipped(false);
      })
      .catch((err: Error) => {
        if (active) setError(err.message);
      });
    return () => {
      active = false;
    };
  }, [activeUnitNo]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      setSearchTotal(0);
      return;
    }
    const timer = setTimeout(() => {
      api
        .searchStudyPack({ q: trimmed, limit: 150 })
        .then((res) => {
          setSearchResults(res.items);
          setSearchTotal(res.total);
        })
        .catch(() => {
          setSearchResults([]);
          setSearchTotal(0);
        });
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const displayedItems = searchResults ?? unitDetail?.items ?? [];

  const activeFlashcard = useMemo(() => {
    if (!unitDetail || unitDetail.items.length === 0) return null;
    const mappedIdx = fcOrder[fcIndex] ?? fcIndex;
    return unitDetail.items[mappedIdx] ?? unitDetail.items[0];
  }, [unitDetail, fcOrder, fcIndex]);

  const masteredCountInUnit = useMemo(() => {
    if (!unitDetail) return 0;
    return unitDetail.items.filter((i) => masteredKeys[`${i.unit_no}-${i.order_no}`]).length;
  }, [unitDetail, masteredKeys]);

  const handleShuffleFlashcards = () => {
    if (!unitDetail) return;
    const indices = unitDetail.items.map((_, idx) => idx);
    for (let i = indices.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setFcOrder(indices);
    setFcIndex(0);
    setFcFlipped(false);
  };

  const handleToggleMastered = (item: StudyPackItem) => {
    const key = `${item.unit_no}-${item.order_no}`;
    const wasMastered = Boolean(masteredKeys[key]);
    setMasteredKeys((prev) => ({ ...prev, [key]: !wasMastered }));
    if (!wasMastered) {
      playSuccessSound(2);
      setFcBurstKey((k) => k + 1);
      fireSuccessSpark();
    } else {
      playClickSound();
    }
  };

  const handleSubmitStudyQuiz = () => {
    if (!quizData) return;
    let totalScore = 0;
    let correctCount = 0;
    for (const q of quizData.questions) {
      if (quizAnswers[q.index] === q.correct_index) {
        totalScore += q.points;
        correctCount += 1;
      }
    }
    const rounded = Math.round(totalScore * 100) / 100;
    setQuizSubmitted(true);
    if (rounded >= 7) {
      fireVictoryCelebration();
      playCelebrationSound();
      if (quizData.unit_nos.length === 1) {
        const uNo = quizData.unit_nos[0];
        unlockLocalSciDexUnit(uNo);
        setUnlockedSciDexUnit(uNo);
        if (session) {
          const disc =
            overview?.units.find((u) => u.unit_no === uNo)?.discipline ??
            unitDetail?.unit.discipline ??
            "physics";
          void api
            .recordGameReward({
              game_type: "lightning_match",
              correct_count: correctCount,
              total_attempts: Math.max(1, quizData.questions.length),
              max_combo: 1,
              discipline: disc,
              study_pack_unit_no: uNo,
            })
            .catch(() => undefined);
        }
      }
    } else {
      playSuccessSound(1);
    }
    emitPetCelebration({
      source: "study_pack",
      xpEarned: rounded >= 7 ? 35 : 15,
      discipline: unitDetail?.unit.discipline ?? "physics",
      messageVi: `Hoàn thành Quiz 16 Units: ${rounded}/10 điểm!`,
    });
  };

  const handleToggleQuizUnit = (unitNo: number) => {
    setQuizUnits((prev) => {
      if (prev.includes(unitNo)) {
        return prev.length > 1 ? prev.filter((u) => u !== unitNo) : prev;
      }
      return [...prev, unitNo].sort((a, b) => a - b);
    });
  };

  const handleStartQuiz = async () => {
    setQuizBusy(true);
    setQuizSubmitted(false);
    setQuizAnswers({});
    setUnlockedSciDexUnit(null);
    try {
      const unitsToUse = quizUnits.length > 0 ? quizUnits : [activeUnitNo];
      const generated = await api.generateStudyPackQuiz({
        unit_nos: unitsToUse,
        mode: quizMode,
        question_count: quizCount,
      });
      setQuizData(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tạo bộ đề trắc nghiệm.");
    } finally {
      setQuizBusy(false);
    }
  };

  const quizScoreSummary = useMemo(() => {
    if (!quizData || !quizSubmitted) return null;
    let totalScore = 0;
    let viScore = 0;
    let enScore = 0;
    let correctCount = 0;
    for (const q of quizData.questions) {
      const chosen = quizAnswers[q.index];
      if (chosen === q.correct_index) {
        correctCount += 1;
        totalScore += q.points;
        if (q.language === "en") enScore += q.points;
        else viScore += q.points;
      }
    }
    return {
      totalScore: Math.round(totalScore * 100) / 100,
      viScore: Math.round(viScore * 100) / 100,
      enScore: Math.round(enScore * 100) / 100,
      correctCount,
    };
  }, [quizData, quizSubmitted, quizAnswers]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-sky-500 to-emerald-500 p-4 text-white shadow-lg sm:p-7">
        <ScienceAmbientParticles />
        <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/3 h-48 w-48 rounded-full bg-amber-300/20 blur-2xl" />

        <div className="relative flex flex-col gap-3.5 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
          <div className="space-y-1.5 sm:space-y-2">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-white/20 px-3 py-0.5 text-[11px] font-bold backdrop-blur-sm sm:px-3.5 sm:py-1 sm:text-xs">
              <Sparkles className="h-3.5 w-3.5 text-amber-200" />
              <span>Trường THCS Cầu Giấy B · GV Phạm Thị Hải</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden rounded-2xl bg-white/20 p-2 backdrop-blur-sm sm:flex">
                <Icon3D name="books" size={44} float />
              </div>
              <h1 className="text-lg font-extrabold tracking-tight sm:text-3xl">
                {overview?.title ?? "The English Dictionary for SCIENCE (16 Units)"}
              </h1>
            </div>
            <p className="hidden max-w-2xl text-sm text-sky-50 sm:block">
              Bộ đề học & cẩm nang {overview?.total_items ?? 920} thuật ngữ Khoa học tự nhiên kèm
              phiên âm IPA chuẩn, phát âm giọng đọc, thẻ lật Flashcard và bài luyện trắc nghiệm
              10% / 50% / 100% tiếng Anh theo chuyên đề.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center sm:gap-3">
            <div className="rounded-2xl bg-white/20 px-2.5 py-2 backdrop-blur-sm sm:px-4 sm:py-3">
              <div className="text-lg font-extrabold sm:text-2xl">{overview?.total_units ?? 16}</div>
              <div className="text-[11px] font-medium text-sky-50 sm:text-xs">Chuyên đề</div>
            </div>
            <div className="rounded-2xl bg-white/20 px-2.5 py-2 backdrop-blur-sm sm:px-4 sm:py-3">
              <div className="text-lg font-extrabold sm:text-2xl">{overview?.total_items ?? 920}</div>
              <div className="text-[11px] font-medium text-sky-50 sm:text-xs">Thuật ngữ IPA</div>
            </div>
            <div className="rounded-2xl bg-white/20 px-2.5 py-2 backdrop-blur-sm sm:px-4 sm:py-3">
              <div className="text-lg font-extrabold sm:text-2xl">TT 32 & 94</div>
              <div className="text-[11px] font-medium text-sky-50 sm:text-xs">Chuẩn IUPAC</div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-sky-100 bg-white/90 p-10 text-center text-sm text-slate-500 shadow-sm">
          Đang tải Bộ Đề Học 16 Units...
        </div>
      )}

      {!loading && overview && (
        <div className="grid gap-4 lg:grid-cols-12 lg:gap-6">
          {/* Desktop Left Unit Index */}
          <aside className="hidden lg:col-span-4 lg:block">
            <div className="sticky top-20 rounded-2xl border border-sky-100 bg-white/90 p-4 shadow-sm backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-extrabold uppercase tracking-wide text-slate-700">
                  16 Units Chuyên đề
                </h2>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700">
                  {overview.total_items} từ
                </span>
              </div>

              <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
                {overview.units.map((u) => {
                  const isActive = u.unit_no === activeUnitNo && !searchQuery.trim();
                  const style = DISC_CARD_STYLE[u.discipline] ?? DISC_CARD_STYLE.physics;
                  return (
                    <button
                      key={u.unit_no}
                      type="button"
                      onClick={() => selectUnit(u.unit_no)}
                      className={`flex w-full items-center justify-between gap-2 rounded-xl border p-3 text-left transition ${
                        isActive
                          ? style.active
                          : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon3D
                            name={STUDY_PACK_UNIT_3D_ICON[u.unit_no] ?? "sparkles"}
                            size={22}
                          />
                          <span
                            className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold ${
                              isActive ? "bg-white/25 text-white" : style.chip
                            }`}
                          >
                            Unit {u.unit_no}
                          </span>
                          <span
                            className={`truncate text-sm font-bold ${
                              isActive ? "text-white" : "text-slate-900"
                            }`}
                          >
                            {u.title_en}
                          </span>
                        </div>
                        <div
                          className={`mt-0.5 truncate text-xs ${
                            isActive ? "text-white/90" : "text-slate-500"
                          }`}
                        >
                          {u.title_vi}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                          isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {u.item_count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Right Interactive Workspace (Unified Single-Screen on Mobile) */}
          <div ref={workspaceRef} className="min-w-0 space-y-3 sm:space-y-4 lg:col-span-8">
            {/* Compact Sticky Mobile Unit Switcher */}
            {(() => {
              const currentUnitSummary =
                overview.units.find((u) => u.unit_no === activeUnitNo) ?? overview.units[0];
              const activeStyle =
                DISC_CARD_STYLE[currentUnitSummary.discipline] ?? DISC_CARD_STYLE.physics;
              return (
                <div className="sticky top-[57px] z-10 space-y-2 rounded-2xl border border-sky-200/80 bg-white/95 p-2.5 shadow-sm backdrop-blur-md lg:hidden">
                  <button
                    type="button"
                    onClick={() => setMobileUnitDrawerOpen(true)}
                    className="flex w-full items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-indigo-50 via-sky-50 to-emerald-50 px-3 py-2 text-left ring-1 ring-sky-200/70"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon3D
                        name={STUDY_PACK_UNIT_3D_ICON[currentUnitSummary.unit_no] ?? "sparkles"}
                        size={24}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${activeStyle.chip}`}
                          >
                            Unit {currentUnitSummary.unit_no}
                          </span>
                          <span className="truncate text-xs font-extrabold text-slate-900">
                            {currentUnitSummary.title_en}
                          </span>
                        </div>
                        <div className="truncate text-[11px] font-medium text-slate-600">
                          {currentUnitSummary.title_vi} · {currentUnitSummary.item_count} từ
                        </div>
                      </div>
                    </div>
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                      16 Units
                      <ChevronDown className="h-3.5 w-3.5" />
                    </span>
                  </button>

                  <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                    {overview.units.map((u) => {
                      const isActive = u.unit_no === activeUnitNo && !searchQuery.trim();
                      const style = DISC_CARD_STYLE[u.discipline] ?? DISC_CARD_STYLE.physics;
                      return (
                        <button
                          key={u.unit_no}
                          type="button"
                          onClick={() => selectUnit(u.unit_no)}
                          className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-xs font-extrabold transition ${
                            isActive
                              ? style.active
                              : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-sky-50"
                          }`}
                        >
                          U{u.unit_no} · {u.title_en}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            {/* Search & Mode Controls */}
            <div className="space-y-3 rounded-2xl border border-sky-100 bg-white/95 p-4 shadow-sm">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-sky-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm trong toàn bộ 920 từ vựng (vd: acid, photosynthesis, force, ẩm bào)..."
                  className="w-full rounded-xl border border-sky-200 bg-sky-50/40 py-2.5 pl-10 pr-4 text-sm focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500/20"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      { id: "list", label: "Từ vựng & Phát âm IPA", icon: BookOpen },
                      { id: "flashcards", label: "Flashcard Lật thẻ", icon: Layers },
                      { id: "quiz", label: "Làm Đề Trắc Nghiệm", icon: Target },
                    ] as const
                  ).map((item) => {
                    const Icon = item.icon;
                    const active = mode === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setMode(item.id);
                        }}
                        className={`relative inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors sm:text-sm ${
                          active
                            ? "text-white"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-sky-50"
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="studypack-mode-pill"
                            transition={{ type: "spring", stiffness: 420, damping: 32 }}
                            className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 shadow-sm"
                          />
                        )}
                        <Icon className="relative z-10 h-4 w-4" />
                        <span className="relative z-10">{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                {unitDetail && !searchQuery.trim() && (
                  <DisciplineBadge discipline={unitDetail.unit.discipline} />
                )}
              </div>

              {unitDetail && !searchQuery.trim() && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-sky-50 to-emerald-50 px-3.5 py-2.5 text-xs">
                  <div>
                    <span className="font-extrabold text-slate-900">
                      Unit {unitDetail.unit.unit_no}: {unitDetail.unit.title_en}
                    </span>
                    <span className="mx-1.5 text-slate-400">·</span>
                    <span className="font-medium text-slate-700">{unitDetail.unit.title_vi}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {onLaunchLightningUnit && (
                      <button
                        type="button"
                        onClick={() => onLaunchLightningUnit(unitDetail.unit.unit_no)}
                        className="btn-tactile mr-1 inline-flex items-center gap-1 rounded-lg border-amber-700 bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm hover:opacity-95"
                      >
                        <Zap className="h-3 w-3" />
                        Chơi Nối Cặp 60s Unit này
                      </button>
                    )}
                    <span className="font-semibold text-slate-500">
                      Liên kết SGK KNTT {grade}:
                    </span>
                    {(
                      unitDetail.unit.related_lessons_by_grade?.[String(grade)] ??
                      (grade === 8 ? unitDetail.unit.kntt8_related_lessons : [])
                    ).map((lno) => (
                      <button
                        key={lno}
                        type="button"
                        onClick={() => onSelectLesson(lno, grade)}
                        className="rounded-lg bg-white px-2 py-0.5 font-bold text-indigo-700 shadow-sm ring-1 ring-indigo-200 hover:bg-indigo-600 hover:text-white"
                      >
                        Bài {lno}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* MODE 1: VOCABULARY TABLE */}
            {mode === "list" && (
              <section className="rounded-2xl border border-sky-100 bg-white/95 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {searchResults !== null
                      ? `Tìm thấy ${searchTotal} kết quả khớp từ khóa "${searchQuery}"`
                      : `Hiển thị đầy đủ ${displayedItems.length} mục của Unit ${activeUnitNo}`}
                  </span>
                  <span className="font-medium text-indigo-700">
                    Bấm biểu tượng loa để nghe phát âm tiếng Anh
                  </span>
                </div>

                <div className="space-y-2">
                  {displayedItems.map((item) => (
                    <div
                      key={`${item.unit_no}-${item.order_no}`}
                      className="flex flex-col justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5 transition hover:border-sky-300 hover:bg-sky-50/40 sm:flex-row sm:items-center"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-indigo-100 px-1.5 text-xs font-extrabold text-indigo-800">
                            {searchResults !== null
                              ? `U${item.unit_no}.${item.order_no}`
                              : item.order_no}
                          </span>
                          <span className="text-base font-extrabold text-slate-900">
                            {item.term_en}
                          </span>
                          <span className="rounded-md bg-white px-2 py-0.5 font-mono text-xs text-sky-700 ring-1 ring-sky-200">
                            {item.ipa}
                          </span>
                          <span className="rounded-full bg-fuchsia-100 px-2 py-0.5 text-[11px] font-bold text-fuchsia-800">
                            ({item.pos})
                          </span>
                          <SpeakButton
                            termEn={item.term_en}
                            title={`Phát âm: ${item.term_en}`}
                            className="h-8 w-8 sm:h-7 sm:w-7"
                          />
                        </div>
                        <div className="text-sm font-semibold text-slate-700">
                          {item.meaning_vi}
                        </div>
                        {item.iupac_note && (
                          <div className="inline-flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-900">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                            <span>{item.iupac_note}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {displayedItems.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
                      Không tìm thấy thuật ngữ phù hợp.
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* MODE 2: INTERACTIVE FLASHCARDS */}
            {mode === "flashcards" && activeFlashcard && unitDetail && (
              <section className="relative space-y-4 rounded-2xl border border-sky-100 bg-white/95 p-5 shadow-sm">
                <FloatingXPBurst
                  burstKey={fcBurstKey}
                  text="Đã thuộc!"
                  subtext="Unit Mastery"
                  className="right-6 top-12"
                />

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs font-bold text-slate-600">
                      Thẻ {fcIndex + 1} / {unitDetail.items.length} · Đã thuộc:{" "}
                      <span className="text-emerald-700">
                        {masteredCountInUnit}/{unitDetail.items.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          handleShuffleFlashcards();
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-800 hover:bg-indigo-100"
                      >
                        <Shuffle className="h-3.5 w-3.5" />
                        Trộn thẻ
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          playClickSound();
                          setFcOrder(unitDetail.items.map((_, i) => i));
                          setFcDir(-1);
                          setFcIndex(0);
                          setFcFlipped(false);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Từ đầu
                      </button>
                    </div>
                  </div>

                  {/* Animated Mastery Progress Bar */}
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.round(
                          (masteredCountInUnit / Math.max(1, unitDetail.items.length)) * 100
                        )}%`,
                      }}
                      transition={{ type: "spring", stiffness: 150, damping: 22 }}
                      className="xp-liquid-bar h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-sky-500"
                    />
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${activeFlashcard.unit_no}-${activeFlashcard.order_no}`}
                    initial={{ opacity: 0, x: fcDir * 36, scale: 0.97 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: fcDir * -40, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                  >
                    <FlipCard3D
                      flipped={fcFlipped}
                      onToggle={() => setFcFlipped((prev) => !prev)}
                      front={
                        <div className="flex h-full flex-col items-center justify-center text-center">
                          <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-bold text-indigo-800">
                            Unit {activeFlashcard.unit_no} #{activeFlashcard.order_no} · (
                            {activeFlashcard.pos}) — Bấm để lật 3D
                          </span>
                          <div className="mt-4 space-y-3">
                            <div className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                              {activeFlashcard.term_en}
                            </div>
                            <div className="font-mono text-base text-sky-700">
                              {activeFlashcard.ipa}
                            </div>
                            <div className="flex justify-center">
                              <SpeakButton termEn={activeFlashcard.term_en} label="Nghe phát âm" />
                            </div>
                          </div>
                        </div>
                      }
                      back={
                        <div className="flex h-full flex-col items-center justify-center text-center">
                          <span className="rounded-full bg-white/25 px-3 py-0.5 text-xs font-bold text-white">
                            Nghĩa tiếng Việt (Bấm để lật lại)
                          </span>
                          <div className="mt-4 space-y-3">
                            <div className="text-3xl font-extrabold">
                              {activeFlashcard.meaning_vi}
                            </div>
                            <div className="text-sm font-medium text-emerald-50">
                              {activeFlashcard.term_en} {activeFlashcard.ipa} ({activeFlashcard.pos})
                            </div>
                            {activeFlashcard.iupac_note && (
                              <div className="mx-auto max-w-md rounded-xl bg-white/20 px-3 py-2 text-xs text-amber-50 backdrop-blur-sm">
                                {activeFlashcard.iupac_note}
                              </div>
                            )}
                          </div>
                        </div>
                      }
                    />
                  </motion.div>
                </AnimatePresence>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    disabled={fcIndex === 0}
                    onClick={() => {
                      playClickSound();
                      setFcDir(-1);
                      setFcIndex((i) => Math.max(0, i - 1));
                      setFcFlipped(false);
                    }}
                    className="btn-tactile inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Thẻ trước
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleToggleMastered(activeFlashcard)}
                    className={`btn-tactile inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition ${
                      masteredKeys[`${activeFlashcard.unit_no}-${activeFlashcard.order_no}`]
                        ? "border border-emerald-800 bg-emerald-600 text-white"
                        : "border border-emerald-300 border-b-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                    }`}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {masteredKeys[`${activeFlashcard.unit_no}-${activeFlashcard.order_no}`]
                      ? "Đã thuộc thẻ này"
                      : "Đánh dấu đã thuộc"}
                  </motion.button>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    disabled={fcIndex >= unitDetail.items.length - 1}
                    onClick={() => {
                      playClickSound();
                      setFcDir(1);
                      setFcIndex((i) => Math.min(unitDetail.items.length - 1, i + 1));
                      setFcFlipped(false);
                    }}
                    className="btn-tactile inline-flex items-center gap-1 rounded-xl border-indigo-800 bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-40"
                  >
                    Thẻ tiếp
                    <ChevronRight className="h-4 w-4" />
                  </motion.button>
                </div>
              </section>
            )}

            {/* MODE 3: INTERACTIVE QUIZ */}
            {mode === "quiz" && (
              <section className="space-y-4 rounded-2xl border border-sky-100 bg-white/95 p-5 shadow-sm">
                <div className="space-y-3 border-b border-slate-100 pb-4">
                  <h2 className="text-base font-extrabold text-slate-900">
                    Cấu hình Bộ Đề Trắc Nghiệm Từ Bộ Sách (10% / 50% / 100% EN)
                  </h2>

                  <div>
                    <div className="mb-1.5 text-xs font-semibold text-slate-600">
                      Chọn Unit gộp vào đề thi ({quizUnits.length} Unit đang chọn):
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {overview.units.map((u) => {
                        const selected = quizUnits.includes(u.unit_no);
                        return (
                          <button
                            key={u.unit_no}
                            type="button"
                            onClick={() => handleToggleQuizUnit(u.unit_no)}
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                              selected
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-sky-50"
                            }`}
                          >
                            Unit {u.unit_no}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <select
                      value={quizMode}
                      onChange={(e) => setQuizMode(e.target.value as PracticeMode)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                    >
                      <option value="quiz_10">10% Tiếng Anh (TT94 Khởi đầu)</option>
                      <option value="quiz_50">50% Tiếng Anh (TT94 Nâng cao)</option>
                      <option value="quiz_100">100% Tiếng Anh CLIL</option>
                    </select>

                    <select
                      value={quizCount}
                      onChange={(e) => setQuizCount(Number(e.target.value))}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
                    >
                      <option value={10}>10 câu hỏi (Thang 10đ)</option>
                      <option value={20}>20 câu hỏi (Thang 10đ)</option>
                      <option value={30}>30 câu hỏi (Thang 10đ)</option>
                    </select>

                    <button
                      type="button"
                      disabled={quizBusy}
                      onClick={() => void handleStartQuiz()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 px-4 py-2 text-sm font-extrabold text-white shadow hover:opacity-95 disabled:opacity-50"
                    >
                      <Play className="h-4 w-4" />
                      {quizBusy ? "Đang sinh đề..." : "Tạo & Làm Đề Ngay"}
                    </button>
                  </div>
                </div>

                {quizScoreSummary && quizData && (
                  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-sky-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-extrabold uppercase text-emerald-700">
                          Kết quả Chấm điểm ({quizData.title})
                        </div>
                        <div className="mt-1 text-2xl font-extrabold text-slate-900">
                          <AnimatedScoreCounter
                            value={quizScoreSummary.totalScore}
                            className="text-indigo-700"
                          />{" "}
                          / 10 điểm (Đúng {quizScoreSummary.correctCount}/{quizData.questions.length}{" "}
                          câu)
                        </div>
                        <div className="text-xs text-slate-700">
                          Phần Tiếng Việt: <strong>{quizScoreSummary.viScore}đ</strong> · Phần Tiếng
                          Anh:{" "}
                          <strong className="text-indigo-700">{quizScoreSummary.enScore}đ</strong>
                        </div>
                        {unlockedSciDexUnit !== null && (
                          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-300 px-3 py-1 text-xs font-extrabold text-amber-950 shadow-sm">
                            <Sparkles className="h-3.5 w-3.5" />
                            Đã mở khóa Huy hiệu 3D SciDex: Unit {unlockedSciDexUnit}!
                          </div>
                        )}
                      </div>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          playClickSound();
                          void handleStartQuiz();
                        }}
                        className="btn-tactile inline-flex items-center gap-1.5 rounded-xl border-indigo-800 bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Sinh đề mới khác câu
                      </motion.button>
                    </div>
                  </div>
                )}

                {quizData ? (
                  <div className="space-y-4">
                    {quizData.questions.map((q) => {
                      const picked = quizAnswers[q.index];
                      const isCorrect = picked === q.correct_index;
                      return (
                        <div
                          key={q.index}
                          className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-extrabold text-indigo-700">
                              Câu {q.index + 1} · {q.points} điểm
                            </span>
                            <span
                              className={`rounded-full px-2 py-0.5 font-bold ${
                                q.language === "en"
                                  ? "bg-sky-100 text-sky-800"
                                  : "bg-slate-200 text-slate-700"
                              }`}
                            >
                              {q.language === "en" ? "English" : "Tiếng Việt"}
                            </span>
                          </div>
                          <p className="mt-1.5 text-sm font-bold text-slate-900">{q.prompt_text}</p>
                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {q.options.map((opt, optIdx) => {
                              const selected = picked === optIdx;
                              let cls = "border-slate-200 bg-white text-slate-800 hover:bg-sky-50";
                              if (quizSubmitted) {
                                if (optIdx === q.correct_index) {
                                  cls = "border-emerald-500 bg-emerald-50 text-emerald-900 font-bold";
                                } else if (selected) {
                                  cls = "border-rose-400 bg-rose-50 text-rose-800";
                                }
                              } else if (selected) {
                                cls = "border-indigo-600 bg-indigo-50 text-indigo-900 font-bold";
                              }
                              return (
                                <button
                                  key={optIdx}
                                  type="button"
                                  disabled={quizSubmitted}
                                  onClick={() =>
                                    setQuizAnswers((prev) => ({ ...prev, [q.index]: optIdx }))
                                  }
                                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${cls}`}
                                >
                                  <span className="mr-1.5 font-bold">
                                    {String.fromCharCode(65 + optIdx)}.
                                  </span>
                                  {opt}
                                </button>
                              );
                            })}
                          </div>

                          {quizSubmitted && (
                            <div
                              className={`mt-3 flex items-start gap-2 rounded-lg p-2.5 text-xs ${
                                isCorrect
                                  ? "bg-emerald-50 text-emerald-900"
                                  : "bg-rose-50 text-rose-900"
                              }`}
                            >
                              {isCorrect ? (
                                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              ) : (
                                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                              )}
                              <span>{q.explanation_vi}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {!quizSubmitted && (
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.97 }}
                        onClick={handleSubmitStudyQuiz}
                        className="btn-tactile w-full rounded-2xl border-emerald-800 bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-extrabold text-white shadow hover:opacity-95"
                      >
                        Nộp Bài & Xem Điểm Chi Tiết ({Object.keys(quizAnswers).length}/
                        {quizData.questions.length} câu đã chọn)
                      </motion.button>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 p-8 text-center text-sm text-slate-600">
                    Chọn một hoặc nhiều Unit ở phía trên rồi nhấn{" "}
                    <strong>Tạo & Làm Đề Ngay</strong> để luyện tập từ vựng & kiến thức khoa học!
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      )}

      {/* Mobile Full 16-Unit Drawer / Bottom Sheet */}
      {mobileUnitDrawerOpen && overview && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileUnitDrawerOpen(false)}
        >
          <div
            className="flex max-h-[82vh] w-full flex-col rounded-t-3xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">
                  Chọn chuyên đề (16 Units · {overview.total_items} từ)
                </h2>
                <p className="text-[11px] text-slate-500">
                  Chạm vào một Unit để chuyển nhanh danh sách &amp; flashcard
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileUnitDrawerOpen(false)}
                className="rounded-xl p-1.5 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-2 overflow-y-auto p-3.5">
              {overview.units.map((u) => {
                const isActive = u.unit_no === activeUnitNo && !searchQuery.trim();
                const style = DISC_CARD_STYLE[u.discipline] ?? DISC_CARD_STYLE.physics;
                return (
                  <button
                    key={u.unit_no}
                    type="button"
                    onClick={() => selectUnit(u.unit_no, true)}
                    className={`flex w-full items-center justify-between gap-2 rounded-xl border p-3 text-left transition ${
                      isActive
                        ? style.active
                        : "border-slate-200 bg-white hover:border-sky-300 hover:bg-sky-50/50"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon3D
                          name={STUDY_PACK_UNIT_3D_ICON[u.unit_no] ?? "sparkles"}
                          size={22}
                        />
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-extrabold ${
                            isActive ? "bg-white/25 text-white" : style.chip
                          }`}
                        >
                          Unit {u.unit_no}
                        </span>
                        <span
                          className={`truncate text-sm font-bold ${
                            isActive ? "text-white" : "text-slate-900"
                          }`}
                        >
                          {u.title_en}
                        </span>
                      </div>
                      <div
                        className={`mt-0.5 truncate text-xs ${
                          isActive ? "text-white/90" : "text-slate-500"
                        }`}
                      >
                        {u.title_vi}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${
                        isActive ? "bg-white/25 text-white" : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {u.item_count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

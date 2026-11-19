import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Atom,
  BookOpen,
  Dna,
  FlaskConical,
  Lock,
  Sparkles,
  Zap,
} from "lucide-react";

import { api } from "../../api/client";
import type { Discipline, GamificationSummary, StudyPackOverview } from "../../api/types";
import { Tilt3DCard } from "../../components/motion/MotionPrimitives";
import { getMergedSciDexUnits } from "../../utils/scidex";
import { playClickSound } from "../../utils/soundFx";

interface Props {
  gamification: GamificationSummary | null;
  onPlayUnitLightning: (unitNo: number) => void;
  onOpenStudyPackUnit?: (unitNo: number) => void;
}

const DISC_CARD_THEME: Record<
  Discipline,
  { grad: string; chip: string; icon: typeof Atom }
> = {
  general_lab: {
    grad: "from-violet-600 via-fuchsia-500 to-indigo-600",
    chip: "bg-violet-100 text-violet-900",
    icon: Sparkles,
  },
  chemistry: {
    grad: "from-amber-500 via-orange-500 to-rose-500",
    chip: "bg-amber-100 text-amber-900",
    icon: FlaskConical,
  },
  physics: {
    grad: "from-sky-500 via-cyan-500 to-indigo-600",
    chip: "bg-sky-100 text-sky-900",
    icon: Atom,
  },
  biology: {
    grad: "from-emerald-500 via-teal-500 to-cyan-600",
    chip: "bg-emerald-100 text-emerald-900",
    icon: Dna,
  },
};

export function SciDexAlbumView({
  gamification,
  onPlayUnitLightning,
  onOpenStudyPackUnit,
}: Props) {
  const [overview, setOverview] = useState<StudyPackOverview | null>(null);
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .getStudyPackOverview()
      .then((data) => {
        if (active) setOverview(data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const unlockedSet = useMemo(
    () => new Set(getMergedSciDexUnits(gamification?.badges)),
    [gamification]
  );

  const visibleUnits = useMemo(() => {
    const units = overview?.units ?? [];
    if (filter === "unlocked") return units.filter((u) => unlockedSet.has(u.unit_no));
    if (filter === "locked") return units.filter((u) => !unlockedSet.has(u.unit_no));
    return units;
  }, [overview, filter, unlockedSet]);

  const unlockedCount = unlockedSet.size;
  const totalCount = overview?.total_units ?? 16;
  const progressPct = Math.round((unlockedCount / Math.max(1, totalCount)) * 100);

  return (
    <div className="space-y-5">
      {/* Collector Header */}
      <section className="rounded-3xl border border-indigo-200 bg-white/95 p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-1 text-xs font-extrabold text-indigo-800">
              <Sparkles className="h-3.5 w-3.5" />
              Sổ Tay Huy Hiệu Hologram 3D · 16 Units KHTN
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">
              Bộ Sưu Tập SciDex: {unlockedCount} / {totalCount} Huy hiệu đã mở khóa
            </h2>
            <p className="text-xs text-slate-600">
              Ghép đúng <strong>≥ 6 cặp</strong> trong <strong>Nối Cặp 60s</strong> theo từng Unit
              hoặc đạt <strong>≥ 7.0 điểm Quiz Unit</strong> để mở khóa thẻ 3D Hologram tương ứng!
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5 rounded-2xl border border-slate-200 bg-slate-100 p-1">
            {(
              [
                { id: "all" as const, label: `Tất cả (${totalCount})` },
                { id: "unlocked" as const, label: `Đã mở (${unlockedCount})` },
                { id: "locked" as const, label: `Chưa mở (${Math.max(0, totalCount - unlockedCount)})` },
              ] as const
            ).map((pill) => {
              const active = filter === pill.id;
              return (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setFilter(pill.id);
                  }}
                  className={`relative rounded-xl px-3 py-1.5 text-xs font-extrabold transition-colors ${
                    active ? "text-white" : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="scidex-filter-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 shadow-sm"
                    />
                  )}
                  <span className="relative z-10">{pill.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Collector Progress Bar */}
        <div className="mt-4 space-y-1">
          <div className="flex justify-between text-xs font-bold text-slate-600">
            <span>Tiến độ Sưu tập SciDex 16 Units</span>
            <span className="text-indigo-700">{progressPct}%</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.max(unlockedCount > 0 ? 6 : 0, progressPct)}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
              className="xp-liquid-bar h-full rounded-full bg-gradient-to-r from-indigo-500 via-fuchsia-500 to-amber-400"
            />
          </div>
        </div>
      </section>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Đang tải sổ tay 16 huy hiệu 3D SciDex...
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {visibleUnits.map((unit) => {
            const unlocked = unlockedSet.has(unit.unit_no);
            const theme = DISC_CARD_THEME[unit.discipline] ?? DISC_CARD_THEME.general_lab;
            const UnitIcon = theme.icon;

            return (
              <Tilt3DCard
                key={unit.unit_no}
                holographic={unlocked}
                className={`flex h-full flex-col justify-between rounded-3xl border p-4 shadow-sm transition ${
                  unlocked
                    ? `border-transparent bg-gradient-to-br ${theme.grad} text-white shadow-md`
                    : "border-slate-200 bg-gradient-to-b from-slate-100/90 to-white text-slate-700"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        unlocked ? "bg-white/25 text-white backdrop-blur-sm" : theme.chip
                      }`}
                    >
                      Unit {unit.unit_no}
                    </span>
                    {unlocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-black uppercase text-amber-950 shadow-sm">
                        <Sparkles className="h-2.5 w-2.5" />
                        Đã sưu tầm
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                        <Lock className="h-2.5 w-2.5" />
                        Chưa mở
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-center gap-3">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-inner ${
                        unlocked ? "bg-white/20 text-white" : "bg-slate-200/80 text-slate-400"
                      }`}
                    >
                      {unlocked ? (
                        <UnitIcon className="h-6 w-6" />
                      ) : (
                        <Lock className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3
                        className={`line-clamp-2 text-sm font-extrabold ${
                          unlocked ? "text-white" : "text-slate-800"
                        }`}
                      >
                        {unit.title_en}
                      </h3>
                      <p
                        className={`line-clamp-1 text-xs font-semibold ${
                          unlocked ? "text-white/85" : "text-slate-500"
                        }`}
                      >
                        {unit.title_vi}
                      </p>
                    </div>
                  </div>

                  <div
                    className={`mt-3 text-[11px] font-bold ${
                      unlocked ? "text-white/85" : "text-slate-500"
                    }`}
                  >
                    {unit.item_count} thuật ngữ chuẩn IPA · Liên quan Bài{" "}
                    {unit.kntt8_related_lessons.slice(0, 3).join(", ")}
                  </div>
                </div>

                <div className="mt-4 flex gap-2 border-t border-black/10 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      playClickSound();
                      onPlayUnitLightning(unit.unit_no);
                    }}
                    className={`btn-tactile flex flex-1 items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-extrabold shadow-sm ${
                      unlocked
                        ? "border-amber-700 bg-white text-indigo-700 hover:bg-amber-50"
                        : "border-indigo-800 bg-gradient-to-r from-indigo-600 to-sky-500 text-white"
                    }`}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {unlocked ? "Phá kỷ lục" : "Mở khóa 60s"}
                  </button>
                  {onOpenStudyPackUnit && (
                    <button
                      type="button"
                      onClick={() => {
                        playClickSound();
                        onOpenStudyPackUnit(unit.unit_no);
                      }}
                      title="Ôn Flashcard Unit"
                      className={`inline-flex items-center justify-center rounded-xl px-2.5 py-1.5 text-xs font-bold transition ${
                        unlocked
                          ? "bg-white/20 text-white hover:bg-white/30"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </Tilt3DCard>
            );
          })}
        </div>
      )}
    </div>
  );
}

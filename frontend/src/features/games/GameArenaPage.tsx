import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Award, Flame, FlaskConical, Gamepad2, Trophy, UserCheck, Zap } from "lucide-react";

import { api, saveAuthTokens } from "../../api/client";
import type { AuthSession, GamificationSummary } from "../../api/types";
import { ScienceAmbientParticles } from "../../components/motion/MotionPrimitives";
import { playClickSound } from "../../utils/soundFx";
import { IupacLabGame } from "./IupacLabGame";
import { LightningMatchGame } from "./LightningMatchGame";

interface Props {
  session: AuthSession | null;
  onSessionChange: (session: AuthSession) => void;
  initialGame?: "lightning" | "iupac";
  initialUnitNo?: number;
}

export function GameArenaPage({
  session,
  onSessionChange,
  initialGame = "lightning",
  initialUnitNo,
}: Props) {
  const [activeGame, setActiveGame] = useState<"lightning" | "iupac">(initialGame);
  const [gamification, setGamification] = useState<GamificationSummary | null>(null);
  const [loggingInDemo, setLoggingInDemo] = useState(false);

  useEffect(() => {
    setActiveGame(initialGame);
  }, [initialGame]);

  const refreshGamification = useCallback(() => {
    if (!session) {
      setGamification(null);
      return;
    }
    api
      .getGamification()
      .then(setGamification)
      .catch(() => setGamification(null));
  }, [session]);

  useEffect(() => {
    refreshGamification();
  }, [refreshGamification]);

  const handleQuickStudentLogin = async () => {
    setLoggingInDemo(true);
    try {
      const next = await api.login({
        email: "an.hs8@demo.scilingo.vn",
        password: "Student123!",
      });
      saveAuthTokens(next.access_token, next.refresh_token);
      onSessionChange(next);
    } finally {
      setLoggingInDemo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Arcade Hero Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 p-6 text-white shadow-lg sm:p-7">
        <ScienceAmbientParticles />
        <div className="pointer-events-none absolute -right-10 -top-10 h-52 w-52 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 left-1/3 h-44 w-44 rounded-full bg-amber-300/25 blur-2xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-white/20 px-3.5 py-1 text-xs font-bold backdrop-blur-sm">
              <Gamepad2 className="h-4 w-4 text-amber-200" />
              <span>Trường THCS Cầu Giấy B · Giáo viên Phạm Thị Hải</span>
            </div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Đấu Trường Trò Chơi KHTN 8
            </h1>
            <p className="max-w-2xl text-sm text-amber-50">
              Vừa chơi vừa chinh phục 920 thuật ngữ IPA, công thức Hóa học chuẩn IUPAC (TT 32/2018)
              và đơn vị Vật lí SI. Thu thập XP, nâng Level và mở khóa huy hiệu hiếm!
            </p>
          </div>

          {session && gamification ? (
            <div className="rounded-2xl bg-white/20 px-4 py-3 backdrop-blur-sm">
              <div className="text-[11px] font-bold uppercase text-amber-100">
                {session.user.full_name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-base font-extrabold">
                <span className="inline-flex items-center gap-1">
                  <Flame className="h-4 w-4 text-amber-300" />
                  {gamification.current_streak}d
                </span>
                <span className="inline-flex items-center gap-1">
                  <Trophy className="h-4 w-4 text-emerald-300" />
                  Lv.{gamification.level} ({gamification.total_xp} XP)
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-amber-100">
                <Award className="h-3.5 w-3.5" />
                <span>{gamification.badges.length} huy hiệu đã mở</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={loggingInDemo}
              onClick={() => void handleQuickStudentLogin()}
              className="btn-tactile inline-flex shrink-0 items-center gap-2 rounded-2xl border-indigo-900 bg-white px-4 py-2.5 text-sm font-extrabold text-indigo-700 shadow hover:bg-amber-50 disabled:opacity-50"
            >
              <UserCheck className="h-4 w-4" />
              {loggingInDemo ? "Đang đăng nhập..." : "Dùng thử Học sinh An (lưu XP & Huy hiệu)"}
            </button>
          )}
        </div>
      </section>

      {/* Arena Switcher Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "lightning" as const, label: "Chớp Nhoáng Nối Cặp 60s", icon: Zap },
            { id: "iupac" as const, label: "Phòng Pha Chế & Bắt Lỗi IUPAC", icon: FlaskConical },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeGame === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                playClickSound();
                setActiveGame(tab.id);
              }}
              className={`relative inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-extrabold transition-colors ${
                active
                  ? "text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-amber-50"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="game-arena-tab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 shadow-sm"
                />
              )}
              <Icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Mini-Game */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeGame}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeGame === "lightning" ? (
            <LightningMatchGame
              session={session}
              initialUnitNo={initialUnitNo}
              onRewardRecorded={refreshGamification}
            />
          ) : (
            <IupacLabGame session={session} onRewardRecorded={refreshGamification} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

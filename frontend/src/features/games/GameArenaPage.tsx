import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  Flame,
  FlaskConical,
  Gamepad2,
  KeyRound,
  ListOrdered,
  Sparkles,
  Trophy,
  UserCheck,
  Zap,
} from "lucide-react";

import { api, saveAuthTokens } from "../../api/client";
import type {
  AuthSession,
  Classroom,
  ClassroomLeaderboard,
  GamificationSummary,
  GradeLevel,
} from "../../api/types";
import { ScienceAmbientParticles } from "../../components/motion/MotionPrimitives";
import { playClickSound } from "../../utils/soundFx";
import { ClassroomLeaderboardPanel } from "./ClassroomLeaderboardPanel";
import { IupacLabGame } from "./IupacLabGame";
import { LightningMatchGame } from "./LightningMatchGame";
import { SciDexAlbumView } from "./SciDexAlbumView";
import { SequenceLabGame } from "./SequenceLabGame";

export type ArenaTab = "lightning" | "iupac" | "sequence" | "scidex" | "leaderboard";

interface Props {
  session: AuthSession | null;
  grade?: GradeLevel;
  onSessionChange: (session: AuthSession) => void;
  initialGame?: ArenaTab;
  initialUnitNo?: number;
  onOpenStudyPackUnit?: (unitNo: number) => void;
}

export function GameArenaPage({
  session,
  grade = 8,
  onSessionChange,
  initialGame = "lightning",
  initialUnitNo,
  onOpenStudyPackUnit,
}: Props) {
  const [activeGame, setActiveGame] = useState<ArenaTab>(initialGame);
  const [unitOverride, setUnitOverride] = useState<number | undefined>(initialUnitNo);
  const [focusPlaying, setFocusPlaying] = useState(false);
  const [gamification, setGamification] = useState<GamificationSummary | null>(null);
  const [loggingInDemo, setLoggingInDemo] = useState(false);

  // Classroom leaderboard state
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>("");
  const [leaderboard, setLeaderboard] = useState<ClassroomLeaderboard | null>(null);
  const [lbLoading, setLbLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [lbError, setLbError] = useState<string | null>(null);

  useEffect(() => {
    setActiveGame(initialGame);
  }, [initialGame]);

  useEffect(() => {
    setFocusPlaying(false);
  }, [activeGame]);

  useEffect(() => {
    setUnitOverride(initialUnitNo);
  }, [initialUnitNo]);

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

  const loadLeaderboardClassrooms = useCallback(() => {
    if (!session) {
      setClassrooms([]);
      setSelectedClassroomId("");
      setLeaderboard(null);
      return;
    }
    const isStaff = session.user.role !== "student";
    const fetcher = isStaff ? api.listClassrooms() : api.listMyClassrooms();
    fetcher
      .then((list) => {
        setClassrooms(list);
        setSelectedClassroomId((prev) =>
          list.some((c) => c.id === prev) ? prev : (list[0]?.id ?? "")
        );
        setLbError(null);
      })
      .catch((err: Error) => setLbError(err.message));
  }, [session]);

  useEffect(() => {
    if (activeGame === "leaderboard") {
      loadLeaderboardClassrooms();
    }
  }, [activeGame, loadLeaderboardClassrooms]);

  useEffect(() => {
    if (activeGame !== "leaderboard" || !session || !selectedClassroomId) {
      return;
    }
    let active = true;
    setLbLoading(true);
    api
      .getClassroomLeaderboard(selectedClassroomId)
      .then((data) => {
        if (active) {
          setLeaderboard(data);
          setLbError(null);
        }
      })
      .catch((err: Error) => {
        if (active) setLbError(err.message);
      })
      .finally(() => {
        if (active) setLbLoading(false);
      });
    return () => {
      active = false;
    };
  }, [activeGame, session, selectedClassroomId]);

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

  const handleJoinClassForLeaderboard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setLbError(null);
    try {
      const joined = await api.joinClassroom(joinCode.trim());
      setJoinCode("");
      await loadLeaderboardClassrooms();
      setSelectedClassroomId(joined.id);
    } catch (err) {
      setLbError(err instanceof Error ? err.message : "Không thể tham gia lớp.");
    }
  };

  return (
    <div className={focusPlaying ? "space-y-3 md:space-y-6" : "space-y-4 sm:space-y-6"}>
      {/* Arcade Hero Banner */}
      <section
        className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 p-5 text-white shadow-lg sm:p-7 ${
          focusPlaying ? "hidden md:block" : ""
        }`}
      >
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
              Đấu Trường Trò Chơi KHTN 6–9
            </h1>
            <p className="max-w-2xl text-sm text-amber-50">
              Vừa chơi vừa chinh phục 920 thuật ngữ IPA (16 Units) cùng từ vựng SGK KHTN Khối 6, 7, 8, 9,
              công thức Hóa học chuẩn IUPAC (TT 32/2018), dây chuyền quy trình KHTN, sưu tầm 16 huy hiệu 3D SciDex và đua Top Bảng Vàng Lớp!
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
      <div className={`${focusPlaying ? "hidden md:flex" : "flex"} flex-wrap gap-2`}>
        {(
          [
            { id: "lightning" as const, label: "Chớp Nhoáng 60s", icon: Zap },
            { id: "iupac" as const, label: "Phòng Pha Chế IUPAC", icon: FlaskConical },
            { id: "sequence" as const, label: "Tháp Sắp Xếp", icon: ListOrdered },
            { id: "scidex" as const, label: "Sổ Tay SciDex 16", icon: Sparkles },
            { id: "leaderboard" as const, label: "Bảng Vàng Lớp", icon: Trophy },
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

      {/* Active Mode Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeGame}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeGame === "lightning" && (
            <LightningMatchGame
              session={session}
              grade={grade}
              initialUnitNo={unitOverride}
              onRewardRecorded={refreshGamification}
              onPlayingChange={setFocusPlaying}
            />
          )}

          {activeGame === "iupac" && (
            <IupacLabGame
              session={session}
              grade={grade}
              onRewardRecorded={refreshGamification}
            />
          )}

          {activeGame === "sequence" && (
            <SequenceLabGame
              session={session}
              grade={grade}
              onRewardRecorded={refreshGamification}
            />
          )}

          {activeGame === "scidex" && (
            <SciDexAlbumView
              gamification={gamification}
              onPlayUnitLightning={(unitNo) => {
                setUnitOverride(unitNo);
                setActiveGame("lightning");
              }}
              onOpenStudyPackUnit={onOpenStudyPackUnit}
            />
          )}

          {activeGame === "leaderboard" && (
            <div className="space-y-4 rounded-3xl border border-indigo-200 bg-white/95 p-5 shadow-sm sm:p-6">
              {!session ? (
                <div className="py-8 text-center">
                  <Trophy className="mx-auto h-10 w-10 text-amber-500" />
                  <h2 className="mt-2 text-lg font-extrabold text-slate-900">
                    Đăng nhập để xem Bảng Vàng Thi Đua Lớp học KHTN 6–9
                  </h2>
                  <p className="mt-1 text-xs text-slate-600">
                    Bảng xếp hạng được cô lập riêng theo từng lớp học &amp; trường để đảm bảo an toàn dữ liệu học sinh THCS.
                  </p>
                  <button
                    type="button"
                    disabled={loggingInDemo}
                    onClick={() => void handleQuickStudentLogin()}
                    className="btn-tactile mt-4 inline-flex items-center gap-2 rounded-2xl border-indigo-900 bg-indigo-600 px-5 py-2.5 text-sm font-extrabold text-white shadow"
                  >
                    <UserCheck className="h-4 w-4" />
                    {loggingInDemo ? "Đang đăng nhập..." : "Dùng thử Học sinh An (THCS Cầu Giấy B)"}
                  </button>
                </div>
              ) : (
                <>
                  {classrooms.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <span className="text-xs font-extrabold uppercase text-slate-500">
                        Chọn lớp đang tham gia
                      </span>
                      <select
                        value={selectedClassroomId}
                        onChange={(e) => setSelectedClassroomId(e.target.value)}
                        className="rounded-xl border border-indigo-200 bg-indigo-50/50 px-3 py-1.5 text-sm font-bold text-slate-900"
                      >
                        {classrooms.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.join_code})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {classrooms.length === 0 && !lbError && (
                    <form
                      onSubmit={(e) => void handleJoinClassForLeaderboard(e)}
                      className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50/60 p-4 sm:flex-row sm:items-center"
                    >
                      <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800">
                        <KeyRound className="h-4 w-4 text-indigo-600" />
                        Bạn chưa vào lớp nào. Nhập mã lớp (vd: KHTN6-CGB6 / KHTN7-CGB7 / KHTN8-CGB8 / KHTN9-CGB9):
                      </div>
                      <input
                        type="text"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        placeholder="KHTN8-CGB8"
                        className="flex-1 rounded-xl border border-sky-200 bg-white px-3 py-1.5 text-sm uppercase"
                      />
                      <button
                        type="submit"
                        className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-extrabold text-white"
                      >
                        Vào lớp
                      </button>
                    </form>
                  )}

                  {lbError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                      {lbError}
                    </div>
                  )}

                  <ClassroomLeaderboardPanel
                    leaderboard={leaderboard}
                    currentUserId={session.user.id}
                    loading={lbLoading}
                  />
                </>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

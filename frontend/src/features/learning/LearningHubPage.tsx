import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, ClipboardCheck, Flame, GitBranch, Layers, Target, Trophy, UserCheck } from "lucide-react";

import { api, saveAuthTokens } from "../../api/client";
import type { AuthSession, GamificationSummary, GradeLevel } from "../../api/types";
import { ScienceAmbientParticles } from "../../components/motion/MotionPrimitives";
import { playClickSound } from "../../utils/soundFx";
import { StudentAssignmentsPanel } from "../lms/StudentAssignmentsPanel";
import { FlashcardSRSView } from "./FlashcardSRSView";
import { MindmapView } from "./MindmapView";
import { PracticeQuizView } from "./PracticeQuizView";

export type LearningSubTab = "srs" | "mindmap" | "quiz" | "assignments";

interface Props {
  session: AuthSession | null;
  grade?: GradeLevel;
  onSessionChange: (session: AuthSession) => void;
  initialTab?: LearningSubTab;
  initialLessonNo?: number;
  onLaunchGameChallenge?: (
    game: "lightning" | "iupac" | "sequence",
    unitNo?: number
  ) => void;
}

export function LearningHubPage({
  session,
  grade = 8,
  onSessionChange,
  initialTab = "srs",
  initialLessonNo,
  onLaunchGameChallenge,
}: Props) {
  const defaultLesson = initialLessonNo ?? (grade === 8 ? 8 : 1);
  const [subTab, setSubTab] = useState<LearningSubTab>(initialTab);
  const [gamification, setGamification] = useState<GamificationSummary | null>(null);
  const [loggingInDemo, setLoggingInDemo] = useState(false);

  useEffect(() => {
    setSubTab(initialTab);
  }, [initialTab]);

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
      const nextSession = await api.login({
        email: "an.hs8@demo.scilingo.vn",
        password: "Student123!",
      });
      saveAuthTokens(nextSession.access_token, nextSession.refresh_token);
      onSessionChange(nextSession);
    } finally {
      setLoggingInDemo(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Gamification Strip */}
      {session && gamification ? (
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-fuchsia-500 to-orange-500 p-6 text-white shadow-lg">
          <ScienceAmbientParticles />
          <div className="relative flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <div className="text-xs font-bold text-amber-100">
                Hồ sơ Học tập · {session.user.full_name} · Trường THCS Cầu Giấy B
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-lg font-extrabold">
                  <Flame className="h-5 w-5 text-amber-300" />
                  {gamification.current_streak} ngày Streak
                </span>
                <span className="inline-flex items-center gap-1.5 text-lg font-extrabold">
                  <Trophy className="h-5 w-5 text-emerald-300" />
                  Level {gamification.level} ({gamification.total_xp} XP)
                </span>
                <span className="text-xs font-semibold text-white/90">
                  Đã thuộc vững: {gamification.cards_mastered} thẻ
                </span>
              </div>

              {/* Liquid XP Progress to next level */}
              <div className="mt-3 max-w-md space-y-1">
                <div className="flex items-center justify-between text-[11px] font-bold text-amber-100">
                  <span>Tiến độ Level {gamification.level + 1}</span>
                  <span>{gamification.total_xp % 100} / 100 XP</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/25">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(6, gamification.total_xp % 100)}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                    className="xp-liquid-bar h-full rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-emerald-300"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {gamification.badges.length > 0 ? (
                gamification.badges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold text-amber-100 backdrop-blur-sm"
                  >
                    <Award className="h-3.5 w-3.5" />
                    {badge}
                  </span>
                ))
              ) : (
                <span className="text-xs text-white/90">
                  Ôn 1 thẻ Flashcard để mở khóa huy hiệu đầu tiên!
                </span>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-bold text-amber-950">
              Đăng nhập để lưu lịch ôn tập SRS, điểm Quiz 10%–50% và Streak
            </h2>
            <p className="mt-0.5 text-xs text-amber-800">
              Bạn vẫn có thể xem Mindmap Song ngữ ngay, hoặc bấm đăng nhập nhanh bằng tài khoản Học sinh demo (Khối 6–9).
            </p>
          </div>
          <button
            type="button"
            disabled={loggingInDemo}
            onClick={() => void handleQuickStudentLogin()}
            className="btn-tactile inline-flex shrink-0 items-center gap-2 rounded-xl border-teal-900 bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            <UserCheck className="h-4 w-4" />
            {loggingInDemo ? "Đang đăng nhập..." : "Dùng thử ngay (Học sinh An)"}
          </button>
        </section>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { id: "srs", label: "Flashcard SRS", icon: Layers },
            { id: "mindmap", label: "Mindmap Song ngữ", icon: GitBranch },
            { id: "quiz", label: "Luyện Quiz 10% / 50% / 100%", icon: Target },
            { id: "assignments", label: "Bài tập Lớp học", icon: ClipboardCheck },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = subTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                playClickSound();
                setSubTab(item.id);
              }}
              className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-colors ${
                active
                  ? "text-white"
                  : "border border-slate-200 bg-white text-slate-700 hover:bg-sky-50"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="learning-subtab-pill"
                  transition={{ type: "spring", stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 shadow-sm"
                />
              )}
              <Icon className="relative z-10 h-4 w-4" />
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
        <span className="ml-auto inline-flex items-center rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-extrabold text-indigo-800">
          KHTN {grade}
        </span>
      </div>

      {/* Sub-view */}
      {subTab === "srs" &&
        (session ? (
          <FlashcardSRSView
            grade={grade}
            lessonNo={initialLessonNo}
            onProgressUpdated={refreshGamification}
          />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Vui lòng nhấn <strong>Dùng thử ngay (Học sinh An)</strong> ở phía trên để bắt đầu phiên Flashcard SRS.
          </div>
        ))}

      {subTab === "mindmap" && <MindmapView grade={grade} initialLessonNo={defaultLesson} />}

      {subTab === "quiz" &&
        (session ? (
          <PracticeQuizView
            grade={grade}
            initialLessonNo={defaultLesson}
            onProgressUpdated={refreshGamification}
          />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Vui lòng nhấn <strong>Dùng thử ngay (Học sinh An)</strong> ở phía trên để làm bài Quiz 10%–50% và lưu điểm.
          </div>
        ))}

      {subTab === "assignments" &&
        (session ? (
          <StudentAssignmentsPanel onLaunchGameChallenge={onLaunchGameChallenge} />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Vui lòng nhấn <strong>Dùng thử ngay (Học sinh An)</strong> ở phía trên để vào lớp học bằng mã tham gia và nộp bài kiểm tra do giáo viên giao.
          </div>
        ))}
    </div>
  );
}

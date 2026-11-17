import { useCallback, useEffect, useState } from "react";
import { Award, ClipboardCheck, Flame, GitBranch, Layers, Target, Trophy, UserCheck } from "lucide-react";

import { api, saveAuthTokens } from "../../api/client";
import type { AuthSession, GamificationSummary } from "../../api/types";
import { StudentAssignmentsPanel } from "../lms/StudentAssignmentsPanel";
import { FlashcardSRSView } from "./FlashcardSRSView";
import { MindmapView } from "./MindmapView";
import { PracticeQuizView } from "./PracticeQuizView";

export type LearningSubTab = "srs" | "mindmap" | "quiz" | "assignments";

interface Props {
  session: AuthSession | null;
  onSessionChange: (session: AuthSession) => void;
  initialTab?: LearningSubTab;
  initialLessonNo?: number;
}

export function LearningHubPage({
  session,
  onSessionChange,
  initialTab = "srs",
  initialLessonNo,
}: Props) {
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
        <section className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-700 to-slate-900 p-5 text-white shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs font-medium text-teal-100">
                Hồ sơ Học tập · {session.user.full_name}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5 text-lg font-extrabold">
                  <Flame className="h-5 w-5 text-amber-400" />
                  {gamification.current_streak} ngày Streak
                </span>
                <span className="inline-flex items-center gap-1.5 text-lg font-extrabold">
                  <Trophy className="h-5 w-5 text-emerald-300" />
                  Level {gamification.level} ({gamification.total_xp} XP)
                </span>
                <span className="text-xs text-teal-100">
                  Đã thuộc vững: {gamification.cards_mastered} thẻ
                </span>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {gamification.badges.length > 0 ? (
                gamification.badges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-amber-200"
                  >
                    <Award className="h-3.5 w-3.5" />
                    {badge}
                  </span>
                ))
              ) : (
                <span className="text-xs text-teal-100">
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
              Bạn vẫn có thể xem Mindmap Song ngữ ngay, hoặc bấm đăng nhập nhanh bằng tài khoản Học sinh lớp 8 demo.
            </p>
          </div>
          <button
            type="button"
            disabled={loggingInDemo}
            onClick={() => void handleQuickStudentLogin()}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            <UserCheck className="h-4 w-4" />
            {loggingInDemo ? "Đang đăng nhập..." : "Dùng thử ngay (Học sinh An)"}
          </button>
        </section>
      )}

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setSubTab("srs")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            subTab === "srs"
              ? "bg-teal-700 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Layers className="h-4 w-4" />
          Flashcard SRS
        </button>

        <button
          type="button"
          onClick={() => setSubTab("mindmap")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            subTab === "mindmap"
              ? "bg-teal-700 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <GitBranch className="h-4 w-4" />
          Mindmap Song ngữ
        </button>

        <button
          type="button"
          onClick={() => setSubTab("quiz")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            subTab === "quiz"
              ? "bg-teal-700 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Target className="h-4 w-4" />
          Luyện Quiz 10% / 50% / 100%
        </button>

        <button
          type="button"
          onClick={() => setSubTab("assignments")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
            subTab === "assignments"
              ? "bg-teal-700 text-white shadow-sm"
              : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
          Bài tập Lớp học
        </button>
      </div>

      {/* Sub-view */}
      {subTab === "srs" &&
        (session ? (
          <FlashcardSRSView
            lessonNo={initialLessonNo}
            onProgressUpdated={refreshGamification}
          />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Vui lòng nhấn <strong>Dùng thử ngay (Học sinh An)</strong> ở phía trên để bắt đầu phiên Flashcard SRS.
          </div>
        ))}

      {subTab === "mindmap" && <MindmapView initialLessonNo={initialLessonNo ?? 8} />}

      {subTab === "quiz" &&
        (session ? (
          <PracticeQuizView
            initialLessonNo={initialLessonNo ?? 8}
            onProgressUpdated={refreshGamification}
          />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Vui lòng nhấn <strong>Dùng thử ngay (Học sinh An)</strong> ở phía trên để làm bài Quiz 10%–50% và lưu điểm.
          </div>
        ))}

      {subTab === "assignments" &&
        (session ? (
          <StudentAssignmentsPanel />
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Vui lòng nhấn <strong>Dùng thử ngay (Học sinh An)</strong> ở phía trên để vào lớp học bằng mã tham gia và nộp bài kiểm tra do giáo viên giao.
          </div>
        ))}
    </div>
  );
}

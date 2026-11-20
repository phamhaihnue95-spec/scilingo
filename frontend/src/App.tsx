import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import {
  Atom,
  BookOpen,
  BookText,
  Gamepad2,
  GraduationCap,
  Library,
  Sparkles,
  UserCircle2,
  Volume2,
  VolumeX,
} from "lucide-react";

import { api, clearAuthTokens, getStoredAccessToken } from "./api/client";
import type { AuthSession, GradeLevel } from "./api/types";
import { PageTransitionWrapper } from "./components/motion/MotionPrimitives";
import { AccountPage } from "./features/auth/AuthModalAndAccount";
import { CurriculumMapPage } from "./features/curriculum/CurriculumMapPage";
import { GlossaryAndRulesPage } from "./features/curriculum/GlossaryAndRulesPage";
import { LessonDetailPage } from "./features/curriculum/LessonDetailPage";
import { type ArenaTab, GameArenaPage } from "./features/games/GameArenaPage";
import { LearningHubPage, type LearningSubTab } from "./features/learning/LearningHubPage";
import { TeacherStudioPage } from "./features/lms/TeacherStudioPage";
import { StudyPack16Page } from "./features/study_pack/StudyPack16Page";
import {
  VALID_GRADES,
  getSavedGrade,
  normalizeGrade,
  saveGrade,
} from "./utils/grades";
import {
  SOUND_CHANGE_EVENT,
  isSoundEnabled,
  playClickSound,
  setSoundEnabled,
} from "./utils/soundFx";

type View =
  | { kind: "map" }
  | { kind: "lesson"; lessonNo: number; grade?: GradeLevel }
  | { kind: "study_pack"; initialUnitNo?: number }
  | { kind: "games"; initialGame?: ArenaTab; initialUnitNo?: number }
  | { kind: "learning"; tab: LearningSubTab; lessonNo?: number }
  | { kind: "teacher" }
  | { kind: "glossary" }
  | { kind: "account" };

export function App() {
  const [view, setView] = useState<View>({ kind: "map" });
  const [session, setSession] = useState<AuthSession | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<GradeLevel>(() => getSavedGrade());
  const [soundOn, setSoundOn] = useState<boolean>(() => isSoundEnabled());

  const handleGradeChange = (nextGrade: GradeLevel) => {
    playClickSound();
    setSelectedGrade(nextGrade);
    saveGrade(nextGrade);
  };

  useEffect(() => {
    const syncSound = () => setSoundOn(isSoundEnabled());
    window.addEventListener(SOUND_CHANGE_EVENT, syncSound);
    return () => window.removeEventListener(SOUND_CHANGE_EVENT, syncSound);
  }, []);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (!token) return;
    Promise.all([api.getMe(), api.getEntitlements()])
      .then(([user, ent]) => {
        setSession({
          access_token: token,
          refresh_token: localStorage.getItem("scilingo_refresh_token") ?? "",
          token_type: "bearer",
          user,
          tenant: ent.tenant,
        });
        if (user.role === "student" && user.grade_level) {
          const synced = normalizeGrade(user.grade_level, 8);
          setSelectedGrade(synced);
          saveGrade(synced);
        }
      })
      .catch(() => {
        clearAuthTokens();
      });
  }, []);

  const openLesson = (lessonNo: number, targetGrade?: GradeLevel) => {
    playClickSound();
    const resolvedGrade = targetGrade ?? selectedGrade;
    if (resolvedGrade !== selectedGrade) {
      setSelectedGrade(resolvedGrade);
      saveGrade(resolvedGrade);
    }
    setView({ kind: "lesson", lessonNo, grade: resolvedGrade });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const launchLearning = (tab: LearningSubTab, lessonNo: number, targetGrade?: GradeLevel) => {
    playClickSound();
    const resolvedGrade = targetGrade ?? selectedGrade;
    if (resolvedGrade !== selectedGrade) {
      setSelectedGrade(resolvedGrade);
      saveGrade(resolvedGrade);
    }
    setView({ kind: "learning", tab, lessonNo });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundEnabled(next);
    setSoundOn(next);
    if (next) {
      playClickSound();
    }
  };

  const navItems: Array<{
    id: string;
    active: boolean;
    onClick: () => void;
    icon: typeof BookOpen;
    label: string;
    pillClass?: string;
    hideLabelClass?: string;
  }> = [
    {
      id: "map",
      active: view.kind === "map" || view.kind === "lesson",
      onClick: () => {
        playClickSound();
        setView({ kind: "map" });
      },
      icon: BookOpen,
      label: `KHTN ${selectedGrade}`,
      hideLabelClass: "hidden md:inline",
    },
    {
      id: "study_pack",
      active: view.kind === "study_pack",
      onClick: () => {
        playClickSound();
        setView({ kind: "study_pack" });
      },
      icon: Library,
      label: "Bộ Đề 16 Units",
      pillClass: "from-fuchsia-600 to-indigo-600",
      hideLabelClass: "hidden md:inline",
    },
    {
      id: "games",
      active: view.kind === "games",
      onClick: () => {
        playClickSound();
        setView({ kind: "games" });
      },
      icon: Gamepad2,
      label: "Trò chơi KHTN",
      pillClass: "from-amber-500 via-orange-500 to-rose-500",
      hideLabelClass: "hidden md:inline",
    },
    {
      id: "learning",
      active: view.kind === "learning",
      onClick: () => {
        playClickSound();
        setView({ kind: "learning", tab: "srs" });
      },
      icon: Sparkles,
      label: "Học tập & SRS",
      hideLabelClass: "hidden md:inline",
    },
    {
      id: "glossary",
      active: view.kind === "glossary",
      onClick: () => {
        playClickSound();
        setView({ kind: "glossary" });
      },
      icon: BookText,
      label: "Từ điển & IUPAC",
      hideLabelClass: "hidden md:inline",
    },
    {
      id: "teacher",
      active: view.kind === "teacher",
      onClick: () => {
        playClickSound();
        setView({ kind: "teacher" });
      },
      icon: GraduationCap,
      label: "Teacher Studio",
      hideLabelClass: "hidden md:inline",
    },
    {
      id: "account",
      active: view.kind === "account",
      onClick: () => {
        playClickSound();
        setView({ kind: "account" });
      },
      icon: UserCircle2,
      label: session ? session.user.full_name : "Đăng nhập",
      hideLabelClass: "hidden sm:inline",
    },
  ];

  const viewKey =
    view.kind === "lesson"
      ? `lesson-${view.grade ?? selectedGrade}-${view.lessonNo}`
      : view.kind;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col text-slate-900">
        {/* Top Navigation */}
        <header className="sticky top-0 z-20 border-b border-sky-100 bg-white/85 shadow-sm backdrop-blur-md">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2 sm:px-6 sm:py-3">
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setView({ kind: "map" });
              }}
              className="flex items-center gap-2.5 text-left"
            >
              <motion.div
                whileHover={{ rotate: 180, scale: 1.06 }}
                whileTap={{ scale: 0.94 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-sky-500 to-emerald-400 text-white shadow-md"
              >
                <Atom className="h-5 w-5" />
              </motion.div>
              <div>
                <div className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                  SciLingo <span className="text-indigo-600">KHTN 6–9</span>
                </div>
                <div className="hidden text-[11px] font-semibold text-sky-700 sm:block">
                  Trường THCS Cầu Giấy B · GV Phạm Thị Hải
                </div>
              </div>
            </button>

            <nav className="flex flex-wrap items-center gap-1 sm:gap-1.5">
              {/* Compact Multi-Grade Pill Switcher (K6..K9) */}
              <div
                className="mr-1 inline-flex items-center rounded-xl border border-indigo-100 bg-indigo-50/70 p-0.5"
                aria-label="Chọn khối lớp KHTN"
              >
                {VALID_GRADES.map((g) => {
                  const active = selectedGrade === g;
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleGradeChange(g)}
                      className={`relative rounded-lg px-2 py-1 text-xs font-extrabold transition-colors ${
                        active ? "text-white" : "text-indigo-700 hover:text-indigo-950"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="global-grade-pill"
                          transition={{ type: "spring", stiffness: 450, damping: 32 }}
                          className="absolute inset-0 rounded-lg bg-gradient-to-r from-indigo-600 to-sky-500 shadow-sm"
                        />
                      )}
                      <span className="relative z-10">K{g}</span>
                    </button>
                  );
                })}
              </div>

              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    className={`relative inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition-colors ${
                      item.active
                        ? "text-white"
                        : "text-slate-700 hover:bg-sky-50"
                    }`}
                  >
                    {item.active && (
                      <motion.span
                        layoutId="main-nav-pill"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        className={`absolute inset-0 rounded-xl bg-gradient-to-r shadow-sm ${
                          item.pillClass ?? "from-indigo-600 to-sky-500"
                        }`}
                      />
                    )}
                    <Icon className="relative z-10 h-4 w-4" />
                    <span className={`relative z-10 ${item.hideLabelClass ?? ""}`}>
                      {item.label}
                    </span>
                  </button>
                );
              })}

              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={toggleSound}
                title={`Âm thanh hiệu ứng: ${soundOn ? "Bật" : "Tắt"}`}
                aria-label={`Âm thanh hiệu ứng: ${soundOn ? "Bật" : "Tắt"}`}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-bold transition ${
                  soundOn
                    ? "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                    : "border-slate-200 bg-slate-100 text-slate-400 hover:text-slate-600"
                }`}
              >
                {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </motion.button>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto w-full max-w-6xl flex-1 px-3 py-3 sm:px-6 sm:py-8">
          <AnimatePresence mode="wait">
            <PageTransitionWrapper key={viewKey}>
              {view.kind === "map" && (
                <CurriculumMapPage
                  session={session}
                  grade={selectedGrade}
                  onGradeChange={handleGradeChange}
                  onSelectLesson={openLesson}
                  onOpenStudyPack={() => {
                    playClickSound();
                    setView({ kind: "study_pack" });
                  }}
                  onOpenGames={(initialGame) => {
                    playClickSound();
                    setView({ kind: "games", initialGame });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              )}
              {view.kind === "study_pack" && (
                <StudyPack16Page
                  session={session}
                  grade={selectedGrade}
                  initialUnitNo={view.initialUnitNo}
                  onSelectLesson={openLesson}
                  onLaunchLightningUnit={(unitNo) => {
                    playClickSound();
                    setView({ kind: "games", initialGame: "lightning", initialUnitNo: unitNo });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              )}
              {view.kind === "games" && (
                <GameArenaPage
                  session={session}
                  grade={selectedGrade}
                  onSessionChange={setSession}
                  initialGame={view.initialGame}
                  initialUnitNo={view.initialUnitNo}
                  onOpenStudyPackUnit={(unitNo) => {
                    playClickSound();
                    setView({ kind: "study_pack", initialUnitNo: unitNo });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              )}
              {view.kind === "lesson" && (
                <LessonDetailPage
                  grade={view.grade ?? selectedGrade}
                  lessonNo={view.lessonNo}
                  onBack={() => setView({ kind: "map" })}
                  onNavigateLesson={openLesson}
                  onLaunchLearning={launchLearning}
                />
              )}
              {view.kind === "learning" && (
                <LearningHubPage
                  session={session}
                  grade={selectedGrade}
                  onSessionChange={setSession}
                  initialTab={view.tab}
                  initialLessonNo={view.lessonNo}
                  onLaunchGameChallenge={(game, unitNo) => {
                    playClickSound();
                    setView({ kind: "games", initialGame: game, initialUnitNo: unitNo });
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              )}
              {view.kind === "teacher" && (
                <TeacherStudioPage
                  session={session}
                  grade={selectedGrade}
                  onSessionChange={setSession}
                />
              )}
              {view.kind === "glossary" && (
                <GlossaryAndRulesPage grade={selectedGrade} onSelectLesson={openLesson} />
              )}
              {view.kind === "account" && (
                <AccountPage session={session} onSessionChange={setSession} />
              )}
            </PageTransitionWrapper>
          </AnimatePresence>
        </main>

        <footer className="border-t border-sky-100 bg-white/75 py-4 text-center text-xs text-slate-600">
          <div className="mx-auto max-w-6xl px-4">
            <span className="font-bold text-indigo-700">Trường THCS Cầu Giấy B</span> · Giáo viên phụ
            trách: <span className="font-bold text-slate-800">Phạm Thị Hải</span> · Nền tảng SciLingo
            KHTN 6–9 (Chuẩn IUPAC / SI &amp; Thông tư 94/2026/TT-BGDĐT)
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}

export default App;

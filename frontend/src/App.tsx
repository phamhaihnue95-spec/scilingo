import { useEffect, useState } from "react";
import {
  Atom,
  BookOpen,
  BookText,
  GraduationCap,
  Library,
  Sparkles,
  UserCircle2,
} from "lucide-react";

import { api, clearAuthTokens, getStoredAccessToken } from "./api/client";
import type { AuthSession } from "./api/types";
import { AccountPage } from "./features/auth/AuthModalAndAccount";
import { CurriculumMapPage } from "./features/curriculum/CurriculumMapPage";
import { GlossaryAndRulesPage } from "./features/curriculum/GlossaryAndRulesPage";
import { LessonDetailPage } from "./features/curriculum/LessonDetailPage";
import { LearningHubPage, type LearningSubTab } from "./features/learning/LearningHubPage";
import { TeacherStudioPage } from "./features/lms/TeacherStudioPage";
import { StudyPack16Page } from "./features/study_pack/StudyPack16Page";

type View =
  | { kind: "map" }
  | { kind: "lesson"; lessonNo: number }
  | { kind: "study_pack" }
  | { kind: "learning"; tab: LearningSubTab; lessonNo?: number }
  | { kind: "teacher" }
  | { kind: "glossary" }
  | { kind: "account" };

export function App() {
  const [view, setView] = useState<View>({ kind: "map" });
  const [session, setSession] = useState<AuthSession | null>(null);

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
      })
      .catch(() => {
        clearAuthTokens();
      });
  }, []);

  const openLesson = (lessonNo: number) => {
    setView({ kind: "lesson", lessonNo });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const launchLearning = (tab: LearningSubTab, lessonNo: number) => {
    setView({ kind: "learning", tab, lessonNo });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="flex min-h-screen flex-col text-slate-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-20 border-b border-sky-100 bg-white/85 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setView({ kind: "map" })}
            className="flex items-center gap-2.5 text-left"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 via-sky-500 to-emerald-400 text-white shadow-md">
              <Atom className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                SciLingo <span className="text-indigo-600">KHTN 8</span>
              </div>
              <div className="hidden text-[11px] font-semibold text-sky-700 sm:block">
                Trường THCS Cầu Giấy B · GV Phạm Thị Hải
              </div>
            </div>
          </button>

          <nav className="flex flex-wrap items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={() => setView({ kind: "map" })}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition ${
                view.kind === "map" || view.kind === "lesson"
                  ? "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-sm"
                  : "text-slate-700 hover:bg-sky-50"
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden md:inline">Bản đồ 47 bài</span>
            </button>

            <button
              type="button"
              onClick={() => setView({ kind: "study_pack" })}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition ${
                view.kind === "study_pack"
                  ? "bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-fuchsia-50"
              }`}
            >
              <Library className="h-4 w-4" />
              <span className="hidden md:inline">Bộ Đề 16 Units</span>
            </button>

            <button
              type="button"
              onClick={() => setView({ kind: "learning", tab: "srs" })}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition ${
                view.kind === "learning"
                  ? "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-sm"
                  : "text-slate-700 hover:bg-sky-50"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden md:inline">Học tập & SRS</span>
            </button>

            <button
              type="button"
              onClick={() => setView({ kind: "glossary" })}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition ${
                view.kind === "glossary"
                  ? "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-sm"
                  : "text-slate-700 hover:bg-sky-50"
              }`}
            >
              <BookText className="h-4 w-4" />
              <span className="hidden md:inline">Từ điển & IUPAC</span>
            </button>

            <button
              type="button"
              onClick={() => setView({ kind: "teacher" })}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition ${
                view.kind === "teacher"
                  ? "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-sm"
                  : "text-slate-700 hover:bg-sky-50"
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              <span className="hidden md:inline">Teacher Studio</span>
            </button>

            <button
              type="button"
              onClick={() => setView({ kind: "account" })}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold transition ${
                view.kind === "account"
                  ? "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-sm"
                  : "text-slate-700 hover:bg-sky-50"
              }`}
            >
              <UserCircle2 className="h-4 w-4" />
              <span className="hidden sm:inline">
                {session ? session.user.full_name : "Đăng nhập"}
              </span>
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        {view.kind === "map" && (
          <CurriculumMapPage
            onSelectLesson={openLesson}
            onOpenStudyPack={() => setView({ kind: "study_pack" })}
          />
        )}
        {view.kind === "study_pack" && <StudyPack16Page onSelectLesson={openLesson} />}
        {view.kind === "lesson" && (
          <LessonDetailPage
            lessonNo={view.lessonNo}
            onBack={() => setView({ kind: "map" })}
            onNavigateLesson={openLesson}
            onLaunchLearning={launchLearning}
          />
        )}
        {view.kind === "learning" && (
          <LearningHubPage
            session={session}
            onSessionChange={setSession}
            initialTab={view.tab}
            initialLessonNo={view.lessonNo}
          />
        )}
        {view.kind === "teacher" && (
          <TeacherStudioPage session={session} onSessionChange={setSession} />
        )}
        {view.kind === "glossary" && <GlossaryAndRulesPage onSelectLesson={openLesson} />}
        {view.kind === "account" && (
          <AccountPage session={session} onSessionChange={setSession} />
        )}
      </main>

      <footer className="border-t border-sky-100 bg-white/75 py-4 text-center text-xs text-slate-600">
        <div className="mx-auto max-w-6xl px-4">
          <span className="font-bold text-indigo-700">Trường THCS Cầu Giấy B</span> · Giáo viên phụ
          trách: <span className="font-bold text-slate-800">Phạm Thị Hải</span> · Nền tảng SciLingo
          KHTN 8 (Chuẩn IUPAC / SI &amp; Thông tư 94/2026/TT-BGDĐT)
        </div>
      </footer>
    </div>
  );
}

export default App;

import { useEffect, useState } from "react";
import { Atom, BookOpen, BookText, Sparkles, UserCircle2 } from "lucide-react";

import { api, clearAuthTokens, getStoredAccessToken } from "./api/client";
import type { AuthSession } from "./api/types";
import { AccountPage } from "./features/auth/AuthModalAndAccount";
import { CurriculumMapPage } from "./features/curriculum/CurriculumMapPage";
import { GlossaryAndRulesPage } from "./features/curriculum/GlossaryAndRulesPage";
import { LessonDetailPage } from "./features/curriculum/LessonDetailPage";
import { LearningHubPage, type LearningSubTab } from "./features/learning/LearningHubPage";

type View =
  | { kind: "map" }
  | { kind: "lesson"; lessonNo: number }
  | { kind: "learning"; tab: LearningSubTab; lessonNo?: number }
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navigation */}
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => setView({ kind: "map" })}
            className="flex items-center gap-2.5 text-left"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-white shadow-sm">
              <Atom className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-extrabold tracking-tight text-slate-900 sm:text-base">
                SciLingo <span className="text-teal-700">KHTN 8</span>
              </div>
              <div className="hidden text-[11px] font-medium text-slate-500 sm:block">
                Kết nối tri thức · Chuẩn IUPAC / SI & TT 94/2026
              </div>
            </div>
          </button>

          <nav className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => setView({ kind: "map" })}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                view.kind === "map" || view.kind === "lesson"
                  ? "bg-teal-50 text-teal-800"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Bản đồ 47 bài</span>
            </button>

            <button
              type="button"
              onClick={() => setView({ kind: "learning", tab: "srs" })}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                view.kind === "learning"
                  ? "bg-teal-50 text-teal-800"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Học tập & SRS</span>
            </button>

            <button
              type="button"
              onClick={() => setView({ kind: "glossary" })}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                view.kind === "glossary"
                  ? "bg-teal-50 text-teal-800"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <BookText className="h-4 w-4" />
              <span className="hidden sm:inline">Từ điển & IUPAC</span>
            </button>

            <button
              type="button"
              onClick={() => setView({ kind: "account" })}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                view.kind === "account"
                  ? "bg-teal-50 text-teal-800"
                  : "text-slate-600 hover:bg-slate-100"
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
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {view.kind === "map" && <CurriculumMapPage onSelectLesson={openLesson} />}
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
        {view.kind === "glossary" && <GlossaryAndRulesPage onSelectLesson={openLesson} />}
        {view.kind === "account" && (
          <AccountPage session={session} onSessionChange={setSession} />
        )}
      </main>
    </div>
  );
}

export default App;

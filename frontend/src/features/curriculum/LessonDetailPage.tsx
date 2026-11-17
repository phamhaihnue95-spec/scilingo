import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  GitBranch,
  Layers,
  Link2,
  Target,
  Volume2,
} from "lucide-react";

import { api } from "../../api/client";
import type { LessonDetail } from "../../api/types";
import { speakEnglishTerm } from "../../utils/speech";
import type { LearningSubTab } from "../learning/LearningHubPage";
import { DisciplineBadge } from "./DisciplineBadge";

interface Props {
  lessonNo: number;
  onBack: () => void;
  onNavigateLesson: (lessonNo: number) => void;
  onLaunchLearning: (tab: LearningSubTab, lessonNo: number) => void;
}

export function LessonDetailPage({
  lessonNo,
  onBack,
  onNavigateLesson,
  onLaunchLearning,
}: Props) {
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [hideVietnamese, setHideVietnamese] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api
      .getLesson(lessonNo)
      .then((data) => {
        if (!active) return;
        setLesson(data);
        setError(null);
      })
      .catch((err: Error) => {
        if (!active) return;
        setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [lessonNo]);

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        Đang tải nội dung Bài {lessonNo}...
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="space-y-4 rounded-xl border border-rose-200 bg-rose-50 p-6">
        <p className="text-sm text-rose-700">{error ?? "Không tìm thấy bài học."}</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại Bản đồ 47 bài
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Bản đồ 47 bài
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={lesson.lesson_no <= 1}
            onClick={() => onNavigateLesson(lesson.lesson_no - 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <ArrowLeft className="h-4 w-4" />
            Bài {Math.max(1, lesson.lesson_no - 1)}
          </button>
          <button
            type="button"
            disabled={lesson.lesson_no >= 47}
            onClick={() => onNavigateLesson(lesson.lesson_no + 1)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            Bài {Math.min(47, lesson.lesson_no + 1)}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Lesson Header */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold text-teal-700">{lesson.chapter_title_vi}</span>
          <span>·</span>
          <span>{lesson.chapter_title_en}</span>
        </div>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Bài {lesson.lesson_no}. {lesson.title_vi}
            </h1>
            <p className="mt-1 text-base font-medium text-teal-700">{lesson.title_en}</p>
          </div>
          <DisciplineBadge discipline={lesson.discipline} />
        </div>

        {/* Unit 2 Quick Actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onLaunchLearning("srs", lesson.lesson_no)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-800"
          >
            <Layers className="h-3.5 w-3.5" />
            Ôn Flashcard SRS bài này
          </button>
          <button
            type="button"
            onClick={() => onLaunchLearning("mindmap", lesson.lesson_no)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-300 bg-teal-50 px-3.5 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100"
          >
            <GitBranch className="h-3.5 w-3.5" />
            Xem Mindmap Song ngữ
          </button>
          <button
            type="button"
            onClick={() => onLaunchLearning("quiz", lesson.lesson_no)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100"
          >
            <Target className="h-3.5 w-3.5" />
            Làm Quiz 10% / 50% EN
          </button>
        </div>

        {/* Cross-disciplinary Integration Block (CV 5208) */}
        {lesson.integration_links.length > 0 && (
          <div className="mt-5 rounded-xl border border-teal-200 bg-teal-50/70 p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-teal-800">
              <Link2 className="h-4 w-4" />
              Kết nối Tích hợp Liên phân môn (Công văn 5208/BGDĐT-GDPT)
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {lesson.integration_links.map((link) => (
                <button
                  key={link.target_lesson_no}
                  type="button"
                  onClick={() => onNavigateLesson(link.target_lesson_no)}
                  className="flex flex-col gap-1 rounded-lg border border-teal-200 bg-white p-3 text-left transition hover:border-teal-500"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-teal-800">
                      → Bài {link.target_lesson_no}: {link.target_title_vi}
                    </span>
                    <DisciplineBadge discipline={link.target_discipline} />
                  </div>
                  <p className="text-xs text-slate-600">{link.note_vi}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Bilingual Term Cards */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">
            Thẻ Thuật ngữ Chuẩn ({lesson.terms.length} từ)
          </h2>

          <button
            type="button"
            onClick={() => setHideVietnamese((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {hideVietnamese ? (
              <>
                <Eye className="h-4 w-4 text-teal-700" />
                Hiện nghĩa Tiếng Việt
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4 text-amber-600" />
                Che nghĩa Tiếng Việt (Tự kiểm tra)
              </>
            )}
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {lesson.terms.map((term) => (
            <article
              key={term.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-300"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{term.term_en}</h3>
                    {term.ipa && (
                      <p className="formula-pill mt-0.5 text-xs text-slate-500">{term.ipa}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => speakEnglishTerm(term.term_en, term.audio_url)}
                    title="Nghe phát âm tiếng Anh"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 transition hover:bg-teal-100"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="rounded-lg bg-slate-50 px-3 py-2">
                  {hideVietnamese ? (
                    <span className="text-sm italic text-slate-400">
                      (Đã che nghĩa tiếng Việt — nhẩm nghĩa rồi bấm Hiện để kiểm tra)
                    </span>
                  ) : (
                    <span className="text-sm font-semibold text-slate-800">{term.term_vi}</span>
                  )}
                </div>

                {term.formula_or_symbol && (
                  <div className="inline-block rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-900 formula-pill">
                    {term.formula_or_symbol}
                  </div>
                )}
              </div>

              {(term.iupac_note || term.is_13_exception_element) && (
                <div className="mt-3 flex items-start gap-2 border-t border-slate-100 pt-3 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                  <span>
                    {term.is_13_exception_element && (
                      <strong>Thuộc nhóm 13 nguyên tố ngoại lệ IUPAC. </strong>
                    )}
                    {term.iupac_note}
                  </span>
                </div>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

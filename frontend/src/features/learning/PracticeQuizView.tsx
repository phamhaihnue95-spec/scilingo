import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Award, CheckCircle2, Play, RotateCcw, XCircle } from "lucide-react";

import { api } from "../../api/client";
import type { PracticeMode, PracticeResult, PracticeSession } from "../../api/types";
import {
  AnimatedScoreCounter,
  FloatingXPBurst,
} from "../../components/motion/MotionPrimitives";
import { fireVictoryCelebration } from "../../utils/confetti";
import {
  playCelebrationSound,
  playClickSound,
  playSuccessSound,
} from "../../utils/soundFx";

interface Props {
  initialLessonNo?: number;
  onProgressUpdated: () => void;
}

const MODES: Array<{ id: PracticeMode; title: string; subtitle: string; badge: string }> = [
  {
    id: "quiz_10",
    title: "Chế độ 10% Tiếng Anh",
    subtitle: "1/10 câu bằng tiếng Anh — Chuẩn khởi đầu Thông tư 94/2026",
    badge: "1.0 đ EN",
  },
  {
    id: "quiz_50",
    title: "Chế độ 50% Tiếng Anh",
    subtitle: "5/10 câu bằng tiếng Anh — Chuẩn nâng cao Thông tư 94/2026",
    badge: "5.0 đ EN",
  },
  {
    id: "quiz_100",
    title: "Thử thách 100% Tiếng Anh",
    subtitle: "Toàn bộ 10/10 câu hỏi hoàn toàn bằng tiếng Anh CLIL",
    badge: "10 đ EN",
  },
];

export function PracticeQuizView({ initialLessonNo = 8, onProgressUpdated }: Props) {
  const [lessonNo, setLessonNo] = useState(initialLessonNo);
  const [mode, setMode] = useState<PracticeMode>("quiz_10");
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [xpBurstKey, setXpBurstKey] = useState(0);
  const celebratedAttemptRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLessonNo(initialLessonNo);
  }, [initialLessonNo]);

  useEffect(() => {
    if (!result || celebratedAttemptRef.current === result.attempt_id) return;
    celebratedAttemptRef.current = result.attempt_id;
    if (result.xp_earned > 0) {
      setXpBurstKey((k) => k + 1);
    }
    if (result.score >= 7 || result.newly_unlocked_badges.length > 0) {
      fireVictoryCelebration();
      playCelebrationSound();
    } else {
      playSuccessSound(1);
    }
  }, [result]);

  const handleStart = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setAnswers({});
    try {
      const nextSession = await api.startPractice({
        lesson_no: lessonNo,
        mode,
        total_questions: 10,
      });
      setSession(nextSession);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể khởi tạo bài kiểm tra.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const payload = Object.entries(answers).map(([idx, selected]) => ({
        index: Number(idx),
        selected_index: selected,
      }));
      const graded = await api.submitPractice(session.attempt_id, payload);
      setResult(graded);
      onProgressUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể nộp bài.");
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6">
        <section className="relative rounded-3xl border border-indigo-200 bg-gradient-to-br from-white via-sky-50/60 to-emerald-50/70 p-6 shadow-md">
          <FloatingXPBurst
            burstKey={xpBurstKey}
            text={`+${result.xp_earned} XP`}
            subtext={result.score >= 8 ? "Xuất sắc!" : undefined}
            className="right-6 top-3"
          />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-extrabold uppercase text-indigo-700">
                Kết quả Luyện tập · Bài {result.lesson_no} ({Math.round(result.english_ratio * 100)}% EN)
              </div>
              <h2 className="mt-1 text-3xl font-extrabold text-slate-900">
                <AnimatedScoreCounter value={result.score} className="text-indigo-700" /> /{" "}
                {result.max_score} điểm
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Điểm Tiếng Việt: <strong>{result.vi_score}</strong> · Điểm Tiếng Anh:{" "}
                <strong className="text-indigo-800">{result.en_score}</strong> · Nhận{" "}
                <strong className="text-emerald-700">+{result.xp_earned} XP</strong>
              </p>
            </div>

            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                playClickSound();
                setSession(null);
                setResult(null);
              }}
              className="btn-tactile inline-flex items-center gap-2 rounded-xl border-indigo-800 bg-gradient-to-r from-indigo-600 to-sky-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-95"
            >
              <RotateCcw className="h-4 w-4" />
              Làm bài khác
            </motion.button>
          </div>

          {result.newly_unlocked_badges.length > 0 && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              <Award className="h-4 w-4" />
              Mở khóa huy hiệu mới: {result.newly_unlocked_badges.join(", ")}
            </div>
          )}
        </section>

        <div className="space-y-3">
          {result.feedback.map((item) => (
            <div
              key={item.index}
              className={`rounded-xl border p-4 ${
                item.is_correct
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-rose-200 bg-rose-50/40"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {item.is_correct ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-rose-600" />
                  )}
                  <span className="text-sm font-bold text-slate-900">
                    Câu {item.index + 1} ({item.language.toUpperCase()}): {item.prompt}
                  </span>
                </div>
                <span className="text-xs font-bold text-slate-700">
                  {item.points_earned}/{item.max_points} đ
                </span>
              </div>

              <div className="mt-2 pl-7 text-xs text-slate-700">
                <div>
                  Đáp án đúng:{" "}
                  <strong className="text-emerald-800">{item.options[item.correct_index]}</strong>
                  {!item.is_correct && item.selected_index !== null && (
                    <span className="ml-2 text-rose-700">
                      (Bạn chọn: {item.options[item.selected_index]})
                    </span>
                  )}
                </div>
                <p className="mt-1 text-slate-600">{item.explanation_vi}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (session) {
    const answeredCount = Object.keys(answers).length;
    const pctDone = Math.round((answeredCount / Math.max(1, session.total_questions)) * 100);
    return (
      <div className="space-y-5">
        <div className="space-y-2.5 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Bài {session.lesson_no}: {session.lesson_title_vi}
              </h2>
              <p className="text-xs text-slate-500">
                {session.english_questions_count}/{session.total_questions} câu tiếng Anh (
                {Math.round(session.english_ratio * 100)}% theo Thông tư 94/2026)
              </p>
            </div>
            <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-extrabold text-indigo-800">
              Đã trả lời: {answeredCount}/{session.total_questions}
            </div>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pctDone}%` }}
              transition={{ type: "spring", stiffness: 160, damping: 22 }}
              className="xp-liquid-bar h-full rounded-full bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-400"
            />
          </div>
        </div>

        <div className="space-y-4">
          {session.questions.map((q) => (
            <div
              key={q.index}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold uppercase ${
                    q.language === "en"
                      ? "bg-sky-100 text-sky-900"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  Câu {q.index + 1} · {q.language === "en" ? "English" : "Tiếng Việt"}
                </span>
                <span className="text-xs font-medium text-slate-400">{q.points} điểm</span>
              </div>

              <h3 className="mt-2.5 text-base font-semibold text-slate-900">{q.prompt}</h3>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {q.options.map((opt, optIdx) => {
                  const chosen = answers[q.index] === optIdx;
                  return (
                    <motion.button
                      key={`${q.index}-${optIdx}`}
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => {
                        playClickSound();
                        setAnswers((prev) => ({ ...prev, [q.index]: optIdx }));
                      }}
                      className={`rounded-xl border px-3.5 py-2.5 text-left text-sm transition ${
                        chosen
                          ? "border-indigo-600 bg-indigo-50 font-semibold text-indigo-900 shadow-sm"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-sky-50"
                      }`}
                    >
                      {opt}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSession(null)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700"
          >
            Hủy bài
          </button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            disabled={loading}
            onClick={() => void handleSubmit()}
            className="btn-tactile rounded-xl border-emerald-800 bg-gradient-to-r from-emerald-600 to-teal-500 px-6 py-2.5 text-sm font-extrabold text-white shadow hover:opacity-95 disabled:opacity-50"
          >
            {loading ? "Đang chấm điểm..." : "Nộp bài & Chấm điểm"}
          </motion.button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          Luyện tập & Kiểm tra Thích ứng (Chuẩn Thông tư 94/2026)
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Chọn bài học và nấc tỷ trọng câu hỏi tiếng Anh (10% · 50% · 100%) trên thang điểm 10.
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-bold uppercase text-slate-500">
          Chọn bài học KHTN 8
        </label>
        <select
          value={lessonNo}
          onChange={(e) => setLessonNo(Number(e.target.value))}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold"
        >
          {Array.from({ length: 47 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              Bài {n}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {MODES.map((m) => (
          <motion.button
            key={m.id}
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              playClickSound();
              setMode(m.id);
            }}
            className={`rounded-2xl border p-4 text-left transition ${
              mode === m.id
                ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20"
                : "border-slate-200 hover:border-indigo-400"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-lg bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-900">
                {m.badge}
              </span>
            </div>
            <div className="mt-2 font-bold text-slate-900">{m.title}</div>
            <p className="mt-1 text-xs text-slate-600">{m.subtitle}</p>
          </motion.button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      )}

      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        disabled={loading}
        onClick={() => void handleStart()}
        className="btn-tactile inline-flex w-full items-center justify-center gap-2 rounded-2xl border-indigo-800 bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-extrabold text-white shadow hover:opacity-95 disabled:opacity-50"
      >
        <Play className="h-4 w-4" />
        {loading ? "Đang tạo đề 10 câu..." : "Bắt đầu làm bài"}
      </motion.button>
    </div>
  );
}

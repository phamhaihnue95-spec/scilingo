import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Award, CheckCircle2, Flame, RotateCcw, Sparkles } from "lucide-react";

import { api } from "../../api/client";
import type { GradeLevel, SRSDueCard, SRSReviewResult } from "../../api/types";
import {
  FlipCard3D,
  FloatingXPBurst,
  SpeakButton,
} from "../../components/motion/MotionPrimitives";
import { fireSuccessSpark, fireVictoryCelebration } from "../../utils/confetti";
import { GRADE_LESSON_COUNTS } from "../../utils/grades";
import {
  playCelebrationSound,
  playClickSound,
  playSuccessSound,
  playWrongSound,
} from "../../utils/soundFx";
import { DisciplineBadge } from "../curriculum/DisciplineBadge";

interface Props {
  grade?: GradeLevel;
  lessonNo?: number;
  onProgressUpdated: () => void;
}

const RATING_BUTTONS = [
  { quality: 1, label: "Chưa nhớ", hint: "Ôn lại sau 10 phút", cls: "border-rose-300 border-b-rose-400 bg-rose-50 text-rose-800 hover:bg-rose-100" },
  { quality: 3, label: "Hơi khó", hint: "+10 XP", cls: "border-amber-300 border-b-amber-400 bg-amber-50 text-amber-800 hover:bg-amber-100" },
  { quality: 4, label: "Nhớ tốt", hint: "+10 XP", cls: "border-sky-300 border-b-sky-400 bg-sky-50 text-sky-900 hover:bg-sky-100" },
  { quality: 5, label: "Rất dễ", hint: "Giãn lịch dài hơn", cls: "border-emerald-300 border-b-emerald-400 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" },
];

export function FlashcardSRSView({ grade = 8, lessonNo, onProgressUpdated }: Props) {
  const maxLessons = GRADE_LESSON_COUNTS[grade];
  const [selectedLesson, setSelectedLesson] = useState<number | "">(
    lessonNo !== undefined && lessonNo <= maxLessons ? lessonNo : ""
  );
  const [cards, setCards] = useState<SRSDueCard[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [totalNew, setTotalNew] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [lastResult, setLastResult] = useState<SRSReviewResult | null>(null);
  const [combo, setCombo] = useState(0);
  const [lastDir, setLastDir] = useState<1 | -1>(1);
  const [burst, setBurst] = useState<{ id: number; text: string; subtext?: string }>({
    id: 0,
    text: "+10 XP",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = (targetLesson: number | "", targetGrade: GradeLevel) => {
    setLoading(true);
    api
      .getDueFlashcards({
        grade: targetGrade,
        lessonNo: targetLesson === "" ? undefined : targetLesson,
        limit: 15,
      })
      .then((res) => {
        setCards(res.cards);
        setTotalDue(res.total_due);
        setTotalNew(res.total_new);
        setFlipped(false);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setSelectedLesson(lessonNo !== undefined && lessonNo <= maxLessons ? lessonNo : "");
  }, [grade, lessonNo, maxLessons]);

  useEffect(() => {
    loadQueue(selectedLesson, grade);
  }, [selectedLesson, grade]);

  const currentCard = cards[0] ?? null;

  const handleRate = async (quality: number) => {
    if (!currentCard) return;
    setLastDir(quality >= 3 ? 1 : -1);
    const wasLastCard = cards.length === 1;
    try {
      const res = await api.reviewFlashcard({ term_id: currentCard.term_id, quality });
      setLastResult(res);
      if (quality >= 3) {
        const nextCombo = combo + 1;
        setCombo(nextCombo);
        playSuccessSound(nextCombo);
        setBurst((prev) => ({
          id: prev.id + 1,
          text: `+${res.xp_earned} XP`,
          subtext: nextCombo >= 3 ? `Combo x${nextCombo}!` : undefined,
        }));
        if (nextCombo >= 3) {
          fireSuccessSpark();
        }
      } else {
        setCombo(0);
        playWrongSound();
      }
      if (res.newly_unlocked_badges.length > 0 || wasLastCard) {
        fireVictoryCelebration();
        playCelebrationSound();
      }
      setCards((prev) => prev.slice(1));
      setFlipped(false);
      onProgressUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu kết quả ôn tập.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase text-slate-500">Phạm vi thẻ:</label>
          <select
            value={selectedLesson}
            onChange={(e) => {
              playClickSound();
              setSelectedLesson(e.target.value ? Number(e.target.value) : "");
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800"
          >
            <option value="">Toàn bộ {maxLessons} bài KHTN {grade}</option>
            {Array.from({ length: maxLessons }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Bài {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {combo >= 2 && (
            <motion.span
              key={combo}
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-2.5 py-1 font-extrabold text-white shadow-sm"
            >
              <Flame className="h-3.5 w-3.5 text-amber-200" />
              Combo x{combo}
            </motion.span>
          )}
          <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-800">
            Đến hạn: {totalDue}
          </span>
          <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-indigo-800">
            Thẻ mới: {totalNew}
          </span>
        </div>
      </div>

      {lastResult && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-emerald-600" />
            +{lastResult.xp_earned} XP · Hẹn ôn lại sau {lastResult.interval_days} ngày
            (Streak: {lastResult.current_streak} ngày)
          </span>
          {lastResult.newly_unlocked_badges.length > 0 && (
            <span className="inline-flex items-center gap-1 font-bold text-amber-800">
              <Award className="h-4 w-4" />
              Mở khóa huy hiệu: {lastResult.newly_unlocked_badges.join(", ")}
            </span>
          )}
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          Đang tải hàng đợi Flashcard SM-2...
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {!loading && !error && currentCard && (
        <div className="relative mx-auto max-w-2xl space-y-4">
          <FloatingXPBurst
            burstKey={burst.id}
            text={burst.text}
            subtext={burst.subtext}
            className="right-3 top-2"
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={currentCard.term_id}
              initial={{ opacity: 0, x: lastDir * 40, scale: 0.97 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: lastDir * -60, scale: 0.95 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <FlipCard3D
                flipped={flipped}
                onToggle={() => setFlipped((prev) => !prev)}
                front={
                  <div className="flex h-full flex-col justify-between">
                    <div className="flex items-center justify-between gap-2">
                      <DisciplineBadge discipline={currentCard.discipline} />
                      <span className="rounded-lg bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-slate-600 shadow-sm">
                        {currentCard.is_new
                          ? "Thẻ mới"
                          : `Đã lặp ${currentCard.repetitions} lần · EF ${currentCard.ease_factor}`}
                      </span>
                    </div>

                    <div className="my-6 text-center">
                      <h2 className="text-3xl font-extrabold text-slate-900 sm:text-4xl">
                        {currentCard.term_en}
                      </h2>
                      {currentCard.ipa && (
                        <p className="formula-pill mt-2 text-sm text-sky-700">{currentCard.ipa}</p>
                      )}
                      {currentCard.formula_or_symbol && (
                        <div className="formula-pill mt-3 inline-block rounded-lg bg-sky-100 px-3 py-1 text-sm font-bold text-sky-900">
                          {currentCard.formula_or_symbol}
                        </div>
                      )}
                      <div className="mt-4 flex justify-center">
                        <SpeakButton termEn={currentCard.term_en} label="Nghe phát âm" />
                      </div>
                    </div>

                    <p className="text-center text-xs font-medium text-indigo-600">
                      Nhấn vào thẻ để lật 3D xem nghĩa Tiếng Việt và ghi chú IUPAC/SI
                    </p>
                  </div>
                }
                back={
                  <div className="flex h-full flex-col items-center justify-center space-y-3 text-center">
                    <span className="rounded-full bg-white/25 px-3 py-0.5 text-xs font-bold text-white">
                      Nghĩa Tiếng Việt chuẩn KHTN {grade} (Bấm để lật lại)
                    </span>
                    <div className="text-3xl font-extrabold">{currentCard.term_vi}</div>
                    <div className="text-sm font-semibold text-emerald-50">
                      {currentCard.term_en}
                      {currentCard.ipa ? ` · ${currentCard.ipa}` : ""}
                      {currentCard.formula_or_symbol ? ` [${currentCard.formula_or_symbol}]` : ""}
                    </div>
                    {currentCard.iupac_note && (
                      <div className="mx-auto max-w-md rounded-2xl bg-white/20 px-4 py-2 text-xs text-amber-50 backdrop-blur-sm">
                        {currentCard.iupac_note}
                      </div>
                    )}
                  </div>
                }
              />
            </motion.div>
          </AnimatePresence>

          {flipped ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {RATING_BUTTONS.map((btn) => (
                <motion.button
                  key={btn.quality}
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={() => void handleRate(btn.quality)}
                  className={`btn-tactile rounded-2xl border px-3 py-3 text-center transition ${btn.cls}`}
                >
                  <div className="text-sm font-bold">{btn.label}</div>
                  <div className="mt-0.5 text-[11px] opacity-80">{btn.hint}</div>
                </motion.button>
              ))}
            </div>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setFlipped(true)}
              className="btn-tactile w-full rounded-2xl border-indigo-800 bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-extrabold text-white shadow hover:opacity-95"
            >
              Lật thẻ 3D xem đáp án
            </motion.button>
          )}
        </div>
      )}

      {!loading && !error && !currentCard && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h3 className="mt-3 text-lg font-bold text-slate-900">
            Bạn đã hoàn thành toàn bộ thẻ đến hạn!
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            Hãy chuyển sang Mindmap Song ngữ hoặc Quiz 10%–50% để củng cố kiến thức.
          </p>
          <button
            type="button"
            onClick={() => loadQueue(selectedLesson, grade)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-teal-800 shadow-sm hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" />
            Tải lại hàng đợi
          </button>
        </div>
      )}
    </div>
  );
}

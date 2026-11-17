import { useEffect, useState } from "react";
import { Award, CheckCircle2, RotateCcw, Sparkles, Volume2 } from "lucide-react";

import { api } from "../../api/client";
import type { SRSDueCard, SRSReviewResult } from "../../api/types";
import { speakEnglishTerm } from "../../utils/speech";
import { DisciplineBadge } from "../curriculum/DisciplineBadge";

interface Props {
  lessonNo?: number;
  onProgressUpdated: () => void;
}

const RATING_BUTTONS = [
  { quality: 1, label: "Chưa nhớ", hint: "Ôn lại sau 10 phút", cls: "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100" },
  { quality: 3, label: "Hơi khó", hint: "+10 XP", cls: "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100" },
  { quality: 4, label: "Nhớ tốt", hint: "+10 XP", cls: "border-teal-300 bg-teal-50 text-teal-800 hover:bg-teal-100" },
  { quality: 5, label: "Rất dễ", hint: "Giãn lịch dài hơn", cls: "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" },
];

export function FlashcardSRSView({ lessonNo, onProgressUpdated }: Props) {
  const [selectedLesson, setSelectedLesson] = useState<number | "">(lessonNo ?? "");
  const [cards, setCards] = useState<SRSDueCard[]>([]);
  const [totalDue, setTotalDue] = useState(0);
  const [totalNew, setTotalNew] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [lastResult, setLastResult] = useState<SRSReviewResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = (targetLesson: number | "") => {
    setLoading(true);
    api
      .getDueFlashcards({
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
    setSelectedLesson(lessonNo ?? "");
  }, [lessonNo]);

  useEffect(() => {
    loadQueue(selectedLesson);
  }, [selectedLesson]);

  const currentCard = cards[0] ?? null;

  const handleRate = async (quality: number) => {
    if (!currentCard) return;
    try {
      const res = await api.reviewFlashcard({ term_id: currentCard.term_id, quality });
      setLastResult(res);
      setCards((prev) => prev.slice(1));
      setFlipped(false);
      onProgressUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu kết quả ôn tập.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold uppercase text-slate-500">Phạm vi thẻ:</label>
          <select
            value={selectedLesson}
            onChange={(e) =>
              setSelectedLesson(e.target.value ? Number(e.target.value) : "")
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800"
          >
            <option value="">Toàn bộ 47 bài KHTN 8</option>
            {Array.from({ length: 47 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Bài {n}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="rounded-md bg-amber-50 px-2.5 py-1 text-amber-800">
            Đến hạn: {totalDue}
          </span>
          <span className="rounded-md bg-teal-50 px-2.5 py-1 text-teal-800">
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
        <div className="mx-auto max-w-2xl space-y-4">
          <div
            onClick={() => setFlipped((prev) => !prev)}
            className="cursor-pointer rounded-2xl border-2 border-teal-200 bg-white p-8 shadow-sm transition hover:border-teal-400"
          >
            <div className="flex items-center justify-between gap-2">
              <DisciplineBadge discipline={currentCard.discipline} />
              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                {currentCard.is_new
                  ? "Thẻ mới"
                  : `Đã lặp ${currentCard.repetitions} lần · EF ${currentCard.ease_factor}`}
              </span>
            </div>

            <div className="my-8 text-center">
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-3xl font-extrabold text-slate-900">{currentCard.term_en}</h2>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    speakEnglishTerm(currentCard.term_en);
                  }}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-teal-50 text-teal-700 hover:bg-teal-100"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </div>
              {currentCard.ipa && (
                <p className="formula-pill mt-2 text-sm text-slate-500">{currentCard.ipa}</p>
              )}
              {currentCard.formula_or_symbol && (
                <div className="formula-pill mt-3 inline-block rounded-lg bg-sky-50 px-3 py-1 text-sm font-bold text-sky-900">
                  {currentCard.formula_or_symbol}
                </div>
              )}

              {flipped ? (
                <div className="mt-6 space-y-2 border-t border-slate-100 pt-6">
                  <div className="text-xl font-bold text-teal-800">{currentCard.term_vi}</div>
                  {currentCard.iupac_note && (
                    <p className="text-xs text-amber-800">{currentCard.iupac_note}</p>
                  )}
                </div>
              ) : (
                <p className="mt-8 text-xs font-medium text-slate-400">
                  Nhấn vào thẻ để lật xem nghĩa Tiếng Việt và ghi chú IUPAC/SI
                </p>
              )}
            </div>
          </div>

          {flipped ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {RATING_BUTTONS.map((btn) => (
                <button
                  key={btn.quality}
                  type="button"
                  onClick={() => void handleRate(btn.quality)}
                  className={`rounded-xl border px-3 py-3 text-center transition ${btn.cls}`}
                >
                  <div className="text-sm font-bold">{btn.label}</div>
                  <div className="mt-0.5 text-[11px] opacity-80">{btn.hint}</div>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFlipped(true)}
              className="w-full rounded-xl bg-teal-700 py-3 text-sm font-bold text-white hover:bg-teal-800"
            >
              Lật thẻ xem đáp án
            </button>
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
            onClick={() => loadQueue(selectedLesson)}
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

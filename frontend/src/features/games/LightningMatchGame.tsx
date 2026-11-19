import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  CheckCircle2,
  Clock,
  Flame,
  Play,
  RotateCcw,
  Settings2,
  Trophy,
  Zap,
} from "lucide-react";

import { api } from "../../api/client";
import type {
  AuthSession,
  Discipline,
  GameRewardResult,
  StudyPackItem,
  StudyPackOverview,
} from "../../api/types";
import {
  AnimatedScoreCounter,
  FloatingXPBurst,
  SpeakButton,
} from "../../components/motion/MotionPrimitives";
import { fireSuccessSpark, fireVictoryCelebration } from "../../utils/confetti";
import { unlockLocalSciDexUnit } from "../../utils/scidex";
import {
  playCelebrationSound,
  playClickSound,
  playSuccessSound,
  playWrongSound,
} from "../../utils/soundFx";
import { speakEnglishTerm } from "../../utils/speech";

interface Props {
  session: AuthSession | null;
  initialUnitNo?: number;
  onRewardRecorded?: () => void;
}

type Phase = "lobby" | "playing" | "finished";
type Difficulty = "standard" | "pro";

const BEST_SCORE_KEY = "scilingo_lightning_best";

function readBestScore(): number {
  try {
    return Number(localStorage.getItem(BEST_SCORE_KEY) || "0") || 0;
  } catch {
    return 0;
  }
}

function saveBestScore(value: number): void {
  try {
    localStorage.setItem(BEST_SCORE_KEY, String(value));
  } catch {
    // Ignore storage errors
  }
}

function shuffledCopy<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function itemKey(item: StudyPackItem): string {
  return `${item.unit_no}-${item.order_no}`;
}

function getComboMultiplier(combo: number): number {
  if (combo >= 5) return 4;
  if (combo >= 4) return 3;
  if (combo >= 2) return 2;
  return 1;
}

function buildUnambiguousBoard(
  pool: StudyPackItem[],
  boardSize: number
): { left: StudyPackItem[]; right: StudyPackItem[] } {
  const candidates = shuffledCopy(pool);
  const picked: StudyPackItem[] = [];
  const seenEn = new Set<string>();
  const seenVi = new Set<string>();

  for (const item of candidates) {
    const enNorm = item.term_en.trim().toLowerCase();
    const viNorm = item.meaning_vi.trim().toLowerCase();
    if (seenEn.has(enNorm) || seenVi.has(viNorm)) continue;
    seenEn.add(enNorm);
    seenVi.add(viNorm);
    picked.push(item);
    if (picked.length >= boardSize) break;
  }

  return {
    left: shuffledCopy(picked),
    right: shuffledCopy(picked),
  };
}

export function LightningMatchGame({ session, initialUnitNo, onRewardRecorded }: Props) {
  const [overview, setOverview] = useState<StudyPackOverview | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<number | "all">(initialUnitNo ?? 1);
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [phase, setPhase] = useState<Phase>("lobby");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pool, setPool] = useState<StudyPackItem[]>([]);
  const [leftItems, setLeftItems] = useState<StudyPackItem[]>([]);
  const [rightItems, setRightItems] = useState<StudyPackItem[]>([]);
  const [matchedBoardKeys, setMatchedBoardKeys] = useState<Record<string, boolean>>({});

  const [pickedLeftKey, setPickedLeftKey] = useState<string | null>(null);
  const [pickedRightKey, setPickedRightKey] = useState<string | null>(null);
  const [shakePair, setShakePair] = useState<{ left: string; right: string } | null>(null);

  const [timeLeft, setTimeLeft] = useState(60);
  const [totalDuration, setTotalDuration] = useState(60);
  const [score, setScore] = useState(0);
  const [matchedTotal, setMatchedTotal] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [missedMap, setMissedMap] = useState<Record<string, StudyPackItem>>({});

  const [burst, setBurst] = useState<{ id: number; text: string; subtext?: string }>({
    id: 0,
    text: "+20",
  });
  const [bestScore, setBestScore] = useState<number>(() => readBestScore());
  const [isNewBest, setIsNewBest] = useState(false);
  const [rewardResult, setRewardResult] = useState<GameRewardResult | null>(null);

  const rewardSentRef = useRef(false);

  useEffect(() => {
    if (initialUnitNo !== undefined) {
      setSelectedUnit(initialUnitNo);
    }
  }, [initialUnitNo]);

  useEffect(() => {
    api
      .getStudyPackOverview()
      .then(setOverview)
      .catch((err: Error) => setError(err.message));
  }, []);

  const boardSize = difficulty === "pro" ? 6 : 5;
  const roundSeconds = difficulty === "pro" ? 45 : 60;

  const dealNextBoard = (sourcePool: StudyPackItem[], size: number) => {
    const { left, right } = buildUnambiguousBoard(sourcePool, size);
    setLeftItems(left);
    setRightItems(right);
    setMatchedBoardKeys({});
    setPickedLeftKey(null);
    setPickedRightKey(null);
  };

  const handleStartGame = async () => {
    playClickSound();
    setLoading(true);
    setError(null);
    try {
      let fetched: StudyPackItem[];
      if (selectedUnit === "all") {
        const res = await api.searchStudyPack({ limit: 200 });
        fetched = res.items;
      } else {
        const res = await api.getStudyPackUnit(selectedUnit);
        fetched = res.items;
      }
      if (fetched.length < 4) {
        throw new Error("Không đủ thuật ngữ để tạo bảng đấu.");
      }
      setPool(fetched);
      setScore(0);
      setMatchedTotal(0);
      setTotalAttempts(0);
      setCombo(0);
      setMaxCombo(0);
      setMissedMap({});
      setIsNewBest(false);
      setRewardResult(null);
      rewardSentRef.current = false;
      setTimeLeft(roundSeconds);
      setTotalDuration(roundSeconds);
      dealNextBoard(fetched, boardSize);
      setPhase("playing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể khởi động trò chơi.");
    } finally {
      setLoading(false);
    }
  };

  // Live countdown while playing
  useEffect(() => {
    if (phase !== "playing") return undefined;
    const timer = globalThis.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          globalThis.clearInterval(timer);
          setPhase("finished");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => globalThis.clearInterval(timer);
  }, [phase]);

  // Celebration, local best & persistent XP on game finish
  useEffect(() => {
    if (phase !== "finished" || rewardSentRef.current) return;
    rewardSentRef.current = true;

    if (matchedTotal >= 6) {
      fireVictoryCelebration();
      playCelebrationSound();
    } else {
      playSuccessSound(1);
    }

    if (score > bestScore) {
      saveBestScore(score);
      setBestScore(score);
      setIsNewBest(true);
    }

    if (selectedUnit !== "all" && matchedTotal >= 6) {
      unlockLocalSciDexUnit(selectedUnit);
    }

    if (!session || totalAttempts === 0) return;

    const unitDiscipline: Discipline =
      selectedUnit === "all"
        ? "physics"
        : (overview?.units.find((u) => u.unit_no === selectedUnit)?.discipline ?? "physics");

    api
      .recordGameReward({
        game_type: "lightning_match",
        correct_count: matchedTotal,
        total_attempts: Math.max(1, totalAttempts),
        max_combo: maxCombo,
        discipline: unitDiscipline,
        study_pack_unit_no: selectedUnit === "all" ? undefined : selectedUnit,
      })
      .then((res) => {
        setRewardResult(res);
        onRewardRecorded?.();
      })
      .catch(() => {
        // Silently ignore if auth session expired
      });
  }, [
    phase,
    matchedTotal,
    score,
    bestScore,
    session,
    totalAttempts,
    maxCombo,
    selectedUnit,
    overview,
    onRewardRecorded,
  ]);

  const evaluatePair = (leftKey: string, rightKey: string) => {
    const leftItem = leftItems.find((i) => itemKey(i) === leftKey);
    const rightItem = rightItems.find((i) => itemKey(i) === rightKey);
    if (!leftItem || !rightItem) return;

    setTotalAttempts((a) => a + 1);

    if (leftKey === rightKey) {
      const nextCombo = combo + 1;
      const mult = getComboMultiplier(nextCombo);
      const proMult = difficulty === "pro" ? 1.5 : 1;
      const pts = Math.round(20 * mult * proMult);

      const updatedMatched = { ...matchedBoardKeys, [leftKey]: true };
      const allCleared = leftItems.every((item) => updatedMatched[itemKey(item)]);

      setMatchedBoardKeys(updatedMatched);
      setPickedLeftKey(null);
      setPickedRightKey(null);
      setCombo(nextCombo);
      setMaxCombo((m) => Math.max(m, nextCombo));
      setMatchedTotal((c) => c + 1);

      playSuccessSound(nextCombo);
      if (nextCombo === 5) {
        fireSuccessSpark();
      }

      if (allCleared) {
        const bonus = 50;
        setScore((s) => s + pts + bonus);
        setTimeLeft((t) => t + 3);
        setBurst((b) => ({
          id: b.id + 1,
          text: `+${pts + bonus} Dọn bảng!`,
          subtext: "+3 giây",
        }));
        fireSuccessSpark();
        globalThis.setTimeout(() => {
          dealNextBoard(pool, boardSize);
        }, 260);
      } else {
        setScore((s) => s + pts);
        setBurst((b) => ({
          id: b.id + 1,
          text: `+${pts}`,
          subtext: nextCombo >= 5 ? "FEVER x4!" : mult > 1 ? `Combo x${mult}` : undefined,
        }));
      }
    } else {
      playWrongSound();
      setCombo(0);
      setPickedLeftKey(null);
      setPickedRightKey(null);
      setShakePair({ left: leftKey, right: rightKey });
      speakEnglishTerm(leftItem.term_en);
      setMissedMap((prev) => ({ ...prev, [leftKey]: leftItem }));
      globalThis.setTimeout(() => setShakePair(null), 420);
    }
  };

  const handleSelectLeft = (key: string) => {
    if (matchedBoardKeys[key] || shakePair) return;
    playClickSound();
    if (pickedLeftKey === key) {
      setPickedLeftKey(null);
      return;
    }
    if (pickedRightKey) {
      evaluatePair(key, pickedRightKey);
    } else {
      setPickedLeftKey(key);
    }
  };

  const handleSelectRight = (key: string) => {
    if (matchedBoardKeys[key] || shakePair) return;
    playClickSound();
    if (pickedRightKey === key) {
      setPickedRightKey(null);
      return;
    }
    if (pickedLeftKey) {
      evaluatePair(pickedLeftKey, key);
    } else {
      setPickedRightKey(key);
    }
  };

  const missedItems = useMemo(() => Object.values(missedMap), [missedMap]);
  const isFever = combo >= 5;
  const accuracy = totalAttempts > 0 ? Math.round((matchedTotal / totalAttempts) * 100) : 100;
  const timePct = Math.min(100, Math.round((timeLeft / Math.max(1, totalDuration)) * 100));

  if (phase === "lobby") {
    return (
      <div className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-sky-200 bg-white/95 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-0.5 text-xs font-extrabold text-amber-900">
              <Zap className="h-3.5 w-3.5 text-amber-600" />
              Mini-Game 1 · Kho 920 Thuật ngữ IPA
            </span>
            <h2 className="text-2xl font-extrabold text-slate-900">
              Chớp Nhoáng Nối Cặp 60s (Lightning Match)
            </h2>
            <p className="text-sm text-slate-600">
              Nối nhanh thuật ngữ Tiếng Anh (IPA) với nghĩa Tiếng Việt. Đạt chuỗi{" "}
              <strong className="text-rose-600">5 cặp đúng liên tiếp</strong> để kích hoạt{" "}
              <strong className="text-amber-700">FEVER MODE x4 điểm</strong>!
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 px-4 py-2.5 text-center">
            <div className="text-[11px] font-bold uppercase text-amber-700">Kỷ lục cá nhân</div>
            <div className="flex items-center justify-center gap-1 text-xl font-extrabold text-amber-950">
              <Trophy className="h-5 w-5 text-amber-500" />
              {bestScore}
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase text-slate-500">
              Chọn Chuyên đề (16 Units)
            </label>
            <select
              value={selectedUnit}
              onChange={(e) => {
                playClickSound();
                setSelectedUnit(e.target.value === "all" ? "all" : Number(e.target.value));
              }}
              className="w-full rounded-2xl border border-sky-200 bg-sky-50/40 px-3.5 py-2.5 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
            >
              <option value="all">Trộn ngẫu nhiên toàn bộ 16 Units</option>
              {overview?.units.map((u) => (
                <option key={u.unit_no} value={u.unit_no}>
                  Unit {u.unit_no}: {u.title_en} ({u.item_count} từ)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-extrabold uppercase text-slate-500">
              Chế độ Tốc độ
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "standard" as const, title: "Chuẩn 60s", hint: "5 cặp/bảng" },
                { id: "pro" as const, title: "Siêu tốc 45s", hint: "6 cặp · x1.5đ" },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    playClickSound();
                    setDifficulty(d.id);
                  }}
                  className={`rounded-2xl border px-3 py-2 text-left transition ${
                    difficulty === d.id
                      ? "border-indigo-600 bg-indigo-50 text-indigo-950 ring-2 ring-indigo-500/20"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="text-sm font-extrabold">{d.title}</div>
                  <div className="text-[11px] opacity-75">{d.hint}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-700">
            {error}
          </div>
        )}

        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          disabled={loading}
          onClick={() => void handleStartGame()}
          className="btn-tactile inline-flex w-full items-center justify-center gap-2 rounded-2xl border-amber-700 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 py-3.5 text-base font-extrabold text-white shadow-md hover:opacity-95 disabled:opacity-50"
        >
          <Play className="h-5 w-5" />
          {loading ? "Đang trộn bảng đấu..." : "Bắt Đầu Đấu Nối Cặp Ngay!"}
        </motion.button>
      </div>
    );
  }

  if (phase === "finished") {
    return (
      <div className="mx-auto max-w-3xl space-y-5 rounded-3xl border border-indigo-200 bg-white/95 p-6 shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase text-indigo-700">
                Tổng kết Chớp Nhoáng Nối Cặp
              </span>
              {isNewBest && (
                <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-2.5 py-0.5 text-[11px] font-extrabold text-white shadow-sm">
                  Kỷ lục mới!
                </span>
              )}
            </div>
            <div className="mt-1 text-4xl font-extrabold text-slate-900">
              <AnimatedScoreCounter value={score} decimals={0} className="text-indigo-700" />{" "}
              <span className="text-lg font-bold text-slate-500">điểm</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="rounded-2xl bg-emerald-50 px-3.5 py-2.5">
              <div className="text-lg font-extrabold text-emerald-700">{matchedTotal}</div>
              <div className="text-[11px] font-bold text-emerald-800">Cặp đúng</div>
            </div>
            <div className="rounded-2xl bg-sky-50 px-3.5 py-2.5">
              <div className="text-lg font-extrabold text-sky-700">{accuracy}%</div>
              <div className="text-[11px] font-bold text-sky-800">Chính xác</div>
            </div>
            <div className="rounded-2xl bg-orange-50 px-3.5 py-2.5">
              <div className="text-lg font-extrabold text-orange-600">x{maxCombo}</div>
              <div className="text-[11px] font-bold text-orange-800">Max Combo</div>
            </div>
          </div>
        </div>

        {rewardResult ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-sky-50 px-4 py-3 text-xs font-bold text-emerald-950">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Đã cộng +{rewardResult.xp_earned} XP (Tổng {rewardResult.total_xp} XP · Level{" "}
              {rewardResult.level} · Streak {rewardResult.current_streak} ngày)
            </span>
            {rewardResult.newly_unlocked_badges.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-amber-900">
                <Award className="h-3.5 w-3.5 text-amber-600" />
                Mở huy hiệu: {rewardResult.newly_unlocked_badges.join(", ")}
              </span>
            )}
          </div>
        ) : !session ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
            Mẹo: Bấm <strong>Dùng thử ngay (Học sinh An)</strong> ở phía trên để lưu điểm XP và
            mở khóa huy hiệu <strong>Tia Chớp Nối Cặp</strong>!
          </div>
        ) : null}

        {missedItems.length > 0 && (
          <div className="space-y-2.5">
            <h3 className="text-sm font-extrabold text-slate-800">
              Từ hay nhầm — Ôn nhanh tại chỗ ({missedItems.length} từ)
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {missedItems.map((item) => (
                <div
                  key={itemKey(item)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50/50 p-3"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-slate-900">
                      {item.term_en}
                    </div>
                    <div className="font-mono text-[11px] text-sky-700">{item.ipa}</div>
                    <div className="truncate text-xs font-medium text-slate-700">
                      {item.meaning_vi}
                    </div>
                  </div>
                  <SpeakButton termEn={item.term_en} className="shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => void handleStartGame()}
            className="btn-tactile inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-indigo-800 bg-gradient-to-r from-indigo-600 to-sky-500 py-3 text-sm font-extrabold text-white shadow hover:opacity-95"
          >
            <RotateCcw className="h-4 w-4" />
            Chơi lại ngay
          </motion.button>
          <button
            type="button"
            onClick={() => {
              playClickSound();
              setPhase("lobby");
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <Settings2 className="h-4 w-4" />
            Đổi Unit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative space-y-4 rounded-3xl border-2 bg-white/95 p-5 shadow-md transition-all ${
        isFever
          ? "border-amber-400 shadow-amber-200/70 ring-4 ring-amber-300/40"
          : "border-sky-200"
      }`}
    >
      <FloatingXPBurst
        burstKey={burst.id}
        text={burst.text}
        subtext={burst.subtext}
        className="right-6 top-4"
      />

      {/* HUD */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-extrabold ${
                timeLeft <= 8
                  ? "animate-pulse bg-rose-100 text-rose-700"
                  : timeLeft <= 15
                    ? "bg-amber-100 text-amber-800"
                    : "bg-sky-100 text-sky-900"
              }`}
            >
              <Clock className="h-4 w-4" />
              {timeLeft}s
            </span>

            <span className="rounded-xl bg-indigo-100 px-3 py-1.5 text-sm font-extrabold text-indigo-900">
              {score} điểm
            </span>

            <span className="rounded-xl bg-emerald-100 px-3 py-1.5 text-xs font-extrabold text-emerald-800">
              Đã ghép: {matchedTotal}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <motion.span
              key={combo}
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold shadow-sm ${
                isFever
                  ? "bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 text-white"
                  : combo >= 2
                    ? "bg-orange-100 text-orange-800"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              <Flame className="h-3.5 w-3.5" />
              {isFever ? `FEVER MODE x4! (${combo})` : `Combo x${getComboMultiplier(combo)} (${combo})`}
            </motion.span>

            <button
              type="button"
              onClick={() => setPhase("finished")}
              className="rounded-xl border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Kết thúc
            </button>
          </div>
        </div>

        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            style={{ width: `${timePct}%` }}
            className={`h-full rounded-full transition-all duration-500 ${
              timeLeft <= 8
                ? "bg-gradient-to-r from-rose-500 to-orange-500"
                : timeLeft <= 15
                  ? "bg-gradient-to-r from-amber-400 to-orange-500"
                  : "xp-liquid-bar bg-gradient-to-r from-sky-500 via-indigo-500 to-emerald-400"
            }`}
          />
        </div>
      </div>

      {/* 2-Column Match Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2.5">
          <div className="text-xs font-extrabold uppercase tracking-wide text-indigo-700">
            Thuật ngữ Tiếng Anh &amp; IPA
          </div>
          <AnimatePresence>
            {leftItems.map((item) => {
              const key = itemKey(item);
              const matched = Boolean(matchedBoardKeys[key]);
              const selected = pickedLeftKey === key;
              const isShaking = shakePair?.left === key;
              return (
                <motion.div
                  key={key}
                  layout
                  animate={
                    matched
                      ? { opacity: 0.25, scale: 0.96 }
                      : isShaking
                        ? { x: [0, -8, 8, -5, 5, 0] }
                        : { opacity: 1, scale: 1, x: 0 }
                  }
                  transition={{ duration: isShaking ? 0.35 : 0.18 }}
                  onClick={() => handleSelectLeft(key)}
                  className={`flex cursor-pointer items-center justify-between gap-2 rounded-2xl border-2 p-3 transition ${
                    matched
                      ? "pointer-events-none border-emerald-200 bg-emerald-50 text-emerald-700"
                      : isShaking
                        ? "border-rose-500 bg-rose-50"
                        : selected
                          ? "border-indigo-600 bg-indigo-50 shadow-md ring-2 ring-indigo-300/60"
                          : "border-slate-200 bg-white hover:border-sky-400 hover:bg-sky-50/40"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold text-slate-900">
                      {item.term_en}
                    </div>
                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-sky-700">
                      <span className="truncate">{item.ipa}</span>
                      <span className="rounded bg-slate-100 px-1 font-sans text-[10px] font-bold text-slate-600">
                        {item.pos}
                      </span>
                    </div>
                  </div>
                  {!matched && <SpeakButton termEn={item.term_en} className="h-8 w-8 shrink-0" />}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="space-y-2.5">
          <div className="text-xs font-extrabold uppercase tracking-wide text-emerald-700">
            Nghĩa Tiếng Việt
          </div>
          <AnimatePresence>
            {rightItems.map((item) => {
              const key = itemKey(item);
              const matched = Boolean(matchedBoardKeys[key]);
              const selected = pickedRightKey === key;
              const isShaking = shakePair?.right === key;
              return (
                <motion.button
                  key={key}
                  type="button"
                  layout
                  disabled={matched}
                  animate={
                    matched
                      ? { opacity: 0.25, scale: 0.96 }
                      : isShaking
                        ? { x: [0, -8, 8, -5, 5, 0] }
                        : { opacity: 1, scale: 1, x: 0 }
                  }
                  transition={{ duration: isShaking ? 0.35 : 0.18 }}
                  onClick={() => handleSelectRight(key)}
                  className={`flex min-h-[58px] w-full items-center justify-between gap-2 rounded-2xl border-2 px-4 py-3 text-left text-sm font-bold transition ${
                    matched
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : isShaking
                        ? "border-rose-500 bg-rose-50 text-rose-800"
                        : selected
                          ? "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-md ring-2 ring-emerald-300/60"
                          : "border-slate-200 bg-white text-slate-800 hover:border-emerald-400 hover:bg-emerald-50/40"
                  }`}
                >
                  <span>{item.meaning_vi}</span>
                  {matched && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

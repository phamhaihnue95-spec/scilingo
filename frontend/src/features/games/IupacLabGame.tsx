import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Flame,
  FlaskConical,
  Heart,
  HelpCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Swords,
  XCircle,
} from "lucide-react";

import { api } from "../../api/client";
import type {
  AuthSession,
  Discipline,
  GameRewardResult,
  GradeLevel,
  TermSummary,
  TerminologyRulebook,
} from "../../api/types";
import {
  AnimatedScoreCounter,
  FloatingXPBurst,
  SpeakButton,
} from "../../components/motion/MotionPrimitives";
import { fireSuccessSpark, fireVictoryCelebration } from "../../utils/confetti";
import {
  playCelebrationSound,
  playClickSound,
  playSuccessSound,
  playWrongSound,
} from "../../utils/soundFx";

interface Props {
  session: AuthSession | null;
  grade?: GradeLevel;
  onRewardRecorded?: () => void;
}

type LabMode = "linter_slash" | "formula_mixer";
type Phase = "ready" | "playing" | "finished";
type MixerFilter = "all" | "chemistry" | "physics";

interface SlashCard {
  id: string;
  text: string;
  contextLabel: string;
  discipline: Discipline;
  isValid: boolean;
  reason: string;
  recommendedFix?: string;
}

interface SlashHistoryEntry {
  card: SlashCard;
  playerSaidValid: boolean;
  correct: boolean;
}

interface FormulaRound {
  target: TermSummary;
  options: TermSummary[];
}

interface FormulaHistoryEntry {
  round: FormulaRound;
  picked: TermSummary;
  correct: boolean;
}

function shuffled<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const DEPRECATED_SAMPLE_PHRASES: Record<string, { text: string; context: string }> = {
  acid: {
    text: "Dung dịch axit sunfuric (H₂SO₄) làm đỏ giấy quỳ",
    context: "Hóa học · Bài 8",
  },
  base: {
    text: "Dung dịch bazơ (NaOH) làm quỳ tím hóa xanh",
    context: "Hóa học · Bài 9",
  },
  oxide: {
    text: "Phản ứng tạo thành oxit kim loại màu đen",
    context: "Hóa học · Bài 10",
  },
  hydrogen: {
    text: "Thu khí hiđro bằng cách dời nước",
    context: "Hóa học · Nguyên tố",
  },
  oxygen: {
    text: "Khí oxi cần thiết cho quá trình hô hấp",
    context: "Hóa học / Sinh học",
  },
  calcium: {
    text: "Nguyên tố canxi giúp xương chắc khỏe",
    context: "Hóa học · Danh pháp",
  },
  magnesium: {
    text: "Đốt cháy dải magiê trong không khí",
    context: "Hóa học · Danh pháp",
  },
  sulfate: {
    text: "Dung dịch đồng(II) sunfat có màu xanh lam",
    context: "Hóa học · Hợp chất muối",
  },
  chloride: {
    text: "Muối natri clorua (NaCl) dùng hằng ngày",
    context: "Hóa học · Hợp chất muối",
  },
  hydroxide: {
    text: "Phản ứng tạo kết tủa đồng(II) hiđroxit",
    context: "Hóa học · Base",
  },
  DNA: {
    text: "Vật chất di truyền ADN nằm trong nhân tế bào",
    context: "Sinh học · Di truyền",
  },
  RNA: {
    text: "Phân tử ARN tham gia truyền đạt thông tin",
    context: "Sinh học · Di truyền",
  },
  moment: {
    text: "Tính mô-men lực làm quay cánh tay đòn",
    context: "Vật lí · KHTN 8 Bài 18",
  },
  "ethylic alcohol (ethanol)": {
    text: "Lên men tinh bột thu được dung dịch rượu etylic (C₂H₅OH)",
    context: "Hóa học · KHTN 9 Bài 25",
  },
  "acetic acid (ethanoic acid)": {
    text: "Giấm ăn có chứa khoảng 2–5% axit axetic (CH₃COOH)",
    context: "Hóa học · KHTN 9 Bài 26",
  },
  "ethylene (ethene)": {
    text: "Khí etilen (C₂H₄) làm mất màu dung dịch nước bromine",
    context: "Hóa học · KHTN 9 Bài 23",
  },
  methane: {
    text: "Khí metan (CH₄) là thành phần chính của khí thiên nhiên",
    context: "Hóa học · KHTN 9 Bài 22",
  },
  glucose: {
    text: "Quả nho chín chứa nhiều đường glucozơ (C₆H₁₂O₆)",
    context: "Hóa học · KHTN 9 Bài 28",
  },
  saccharose: {
    text: "Đường mía có thành phần chính là saccarozơ (C₁₂H₂₂O₁₁)",
    context: "Hóa học · KHTN 9 Bài 28",
  },
  polymer: {
    text: "Nhựa PE và tinh bột đều là những hợp chất polime",
    context: "Hóa học · KHTN 9 Bài 31",
  },
};

function buildSlasherDeck(
  rulebook: TerminologyRulebook,
  terms: TermSummary[],
  grade: GradeLevel
): SlashCard[] {
  const invalidCards: SlashCard[] = [];
  const validCards: SlashCard[] = [];

  for (const rule of rulebook.deprecated_terms_to_flag) {
    const sample = DEPRECATED_SAMPLE_PHRASES[rule.recommended];
    if (!sample) continue;
    invalidCards.push({
      id: `dep-${rule.recommended}`,
      text: sample.text,
      contextLabel: sample.context,
      discipline:
        rule.discipline === "chemistry" || rule.discipline === "physics" || rule.discipline === "biology"
          ? rule.discipline
          : "chemistry",
      isValid: false,
      reason: rule.reason,
      recommendedFix: rule.recommended,
    });
  }

  // Compound traps even using the 13 exception elements
  const trapMap: Record<string, string> = {
    Au: "Hợp chất: muối vàng(III) clorua (AuCl₃)",
    Fe: "Hợp chất: dung dịch sắt(III) sunfat (Fe₂(SO₄)₃)",
    Na: "Hợp chất: dung dịch natri hiđroxit (NaOH)",
    Cu: "Hợp chất: tinh thể đồng(II) sunfat (CuSO₄)",
  };
  for (const el of rulebook.exception_13_elements) {
    if (trapMap[el.symbol]) {
      invalidCards.push({
        id: `trap-${el.symbol}`,
        text: trapMap[el.symbol],
        contextLabel: `Cảnh báo Ngoại lệ (${el.symbol})`,
        discipline: "chemistry",
        isValid: false,
        reason: `13 nguyên tố ngoại lệ chỉ dùng tiếng Việt ở dạng đơn chất ('${el.vi_elemental}'). Khi là hợp chất bắt buộc dùng IUPAC: ${el.compound_example_iupac}.`,
        recommendedFix: el.compound_example_iupac,
      });
    }

    if (el.allowed_elemental_contexts.length > 0) {
      const ctx = el.allowed_elemental_contexts[0];
      validCards.push({
        id: `elem-${el.symbol}`,
        text: `Đơn chất đời sống: "${ctx}" (${el.symbol} – ${el.iupac_en})`,
        contextLabel: "Ngoại lệ 13 Nguyên tố (Đơn chất)",
        discipline: "chemistry",
        isValid: true,
        reason: `Hợp lệ! '${el.vi_elemental}' (${el.iupac_en}) nằm trong 13 nguyên tố được phép gọi tiếng Việt khi nói về đơn chất / vật thể đời sống (TT 32/2018).`,
      });
    }

    validCards.push({
      id: `comp-${el.symbol}`,
      text: `Hợp chất chuẩn IUPAC: ${el.compound_example_iupac}`,
      contextLabel: "Danh pháp Hợp chất IUPAC",
      discipline: "chemistry",
      isValid: true,
      reason: `Chuẩn xác! Tên hợp chất viết hoàn toàn bằng tiếng Anh theo danh pháp IUPAC (${el.compound_example_iupac}).`,
    });
  }

  // Add verified curriculum terms with formulas / Bio / Physics SI
  const verifiedHighlights = terms
    .filter((t) => t.formula_or_symbol || ["DNA", "RNA", "Density", "Pressure", "Sulfuric acid"].includes(t.term_en))
    .slice(0, 8);
  for (const t of verifiedHighlights) {
    validCards.push({
      id: `term-${t.slug}`,
      text: `${t.term_en}${t.formula_or_symbol ? ` (${t.formula_or_symbol})` : ""} — ${t.term_vi}`,
      contextLabel: `Thuật ngữ chuẩn SGK KNTT ${grade}`,
      discipline: t.discipline,
      isValid: true,
      reason: `Đúng chuẩn KHTN ${grade} (Thông tư 32/2018 & hệ SI): ${t.term_en} — ${t.term_vi}.`,
    });
  }

  const pickedInvalid = shuffled(invalidCards).slice(0, 6);
  const pickedValid = shuffled(validCards).slice(0, 6);
  return shuffled([...pickedInvalid, ...pickedValid]);
}

function buildFormulaRounds(terms: TermSummary[], filter: MixerFilter): FormulaRound[] {
  const withFormula = terms.filter((t) => Boolean(t.formula_or_symbol?.trim()));
  const filteredPool =
    filter === "all" ? withFormula : withFormula.filter((t) => t.discipline === filter);
  const targets = shuffled(filteredPool).slice(0, 10);

  return targets.map((target) => {
    const distractorCandidates = shuffled(
      withFormula.filter(
        (cand) =>
          cand.id !== target.id &&
          cand.term_en.trim().toLowerCase() !== target.term_en.trim().toLowerCase() &&
          (cand.formula_or_symbol ?? "").trim().toLowerCase() !==
            (target.formula_or_symbol ?? "").trim().toLowerCase()
      )
    );

    const uniqueDistractors: TermSummary[] = [];
    const seenEn = new Set<string>([target.term_en.trim().toLowerCase()]);
    for (const cand of distractorCandidates) {
      const norm = cand.term_en.trim().toLowerCase();
      if (seenEn.has(norm)) continue;
      seenEn.add(norm);
      uniqueDistractors.push(cand);
      if (uniqueDistractors.length >= 3) break;
    }

    return {
      target,
      options: shuffled([target, ...uniqueDistractors]),
    };
  });
}

export function IupacLabGame({ session, grade = 8, onRewardRecorded }: Props) {
  const [labMode, setLabMode] = useState<LabMode>("linter_slash");
  const [rulebook, setRulebook] = useState<TerminologyRulebook | null>(null);
  const [terms, setTerms] = useState<TermSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>("ready");
  const [score, setScore] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [attemptsCount, setAttemptsCount] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [burst, setBurst] = useState<{ id: number; text: string; subtext?: string }>({
    id: 0,
    text: "+25",
  });
  const [rewardResult, setRewardResult] = useState<GameRewardResult | null>(null);
  const [showReview, setShowReview] = useState(false);

  // Mode A: Linter Slash state
  const [slashDeck, setSlashDeck] = useState<SlashCard[]>([]);
  const [slashIndex, setSlashIndex] = useState(0);
  const [hearts, setHearts] = useState(3);
  const [slashFeedback, setSlashFeedback] = useState<{
    correct: boolean;
    reason: string;
    fix?: string;
  } | null>(null);
  const [slashHistory, setSlashHistory] = useState<SlashHistoryEntry[]>([]);

  // Mode B: Formula Mixer state
  const [mixerFilter, setMixerFilter] = useState<MixerFilter>("all");
  const [formulaRounds, setFormulaRounds] = useState<FormulaRound[]>([]);
  const [formulaIndex, setFormulaIndex] = useState(0);
  const [showViClue, setShowViClue] = useState(false);
  const [pourFeedback, setPourFeedback] = useState<{
    pickedId: string;
    correct: boolean;
    target: TermSummary;
  } | null>(null);
  const [formulaHistory, setFormulaHistory] = useState<FormulaHistoryEntry[]>([]);

  const advanceTimerRef = useRef<number | null>(null);
  const rewardSentRef = useRef(false);

  useEffect(() => {
    if (advanceTimerRef.current !== null) {
      globalThis.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    setLoading(true);
    setPhase("ready");
    Promise.all([
      api.getIupacRules(),
      api.searchTerms({ grade, limit: 200 }),
      api.searchTerms({ limit: 200 }),
    ])
      .then(([rb, gradeRes, allRes]) => {
        setRulebook(rb);
        const merged = new Map<string, TermSummary>();
        for (const t of [...gradeRes.items, ...allRes.items]) {
          if (!merged.has(t.id)) {
            merged.set(t.id, t);
          }
        }
        setTerms(Array.from(merged.values()));
        setError(null);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));

    return () => {
      if (advanceTimerRef.current !== null) {
        globalThis.clearTimeout(advanceTimerRef.current);
      }
    };
  }, [grade]);

  const clearAdvanceTimer = () => {
    if (advanceTimerRef.current !== null) {
      globalThis.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
  };

  const finishRound = useCallback(
    (finalCorrect: number, finalAttempts: number, finalMaxCombo: number) => {
      clearAdvanceTimer();
      setPhase("finished");
      const acc = finalAttempts > 0 ? finalCorrect / finalAttempts : 0;
      if (acc >= 0.7) {
        fireVictoryCelebration();
        playCelebrationSound();
      } else {
        playSuccessSound(1);
      }

      if (!session || rewardSentRef.current || finalAttempts === 0) return;
      rewardSentRef.current = true;
      const disc: Discipline =
        labMode === "formula_mixer" && mixerFilter === "physics" ? "physics" : "chemistry";
      api
        .recordGameReward({
          game_type: "iupac_lab",
          correct_count: finalCorrect,
          total_attempts: finalAttempts,
          max_combo: finalMaxCombo,
          discipline: disc,
        })
        .then((res) => {
          setRewardResult(res);
          onRewardRecorded?.();
        })
        .catch(() => {
          // Ignore expired session
        });
    },
    [session, labMode, mixerFilter, onRewardRecorded]
  );

  const startRound = () => {
    clearAdvanceTimer();
    playClickSound();
    setScore(0);
    setCorrectCount(0);
    setAttemptsCount(0);
    setCombo(0);
    setMaxCombo(0);
    setRewardResult(null);
    setShowReview(false);
    rewardSentRef.current = false;

    if (labMode === "linter_slash") {
      if (!rulebook) return;
      setSlashDeck(buildSlasherDeck(rulebook, terms, grade));
      setSlashIndex(0);
      setHearts(3);
      setSlashFeedback(null);
      setSlashHistory([]);
    } else {
      const rounds = buildFormulaRounds(terms, mixerFilter);
      setFormulaRounds(rounds);
      setFormulaIndex(0);
      setPourFeedback(null);
      setFormulaHistory([]);
    }
    setPhase("playing");
  };

  const currentSlashCard = slashDeck[slashIndex] ?? null;

  const advanceSlash = useCallback(
    (nextIdx: number, nextHearts: number, nextCorrect: number, nextAttempts: number, nextMaxCombo: number) => {
      setSlashFeedback(null);
      if (nextHearts <= 0 || nextIdx >= slashDeck.length) {
        finishRound(nextCorrect, nextAttempts, nextMaxCombo);
      } else {
        setSlashIndex(nextIdx);
      }
    },
    [slashDeck.length, finishRound]
  );

  const handleSlashDecision = useCallback(
    (playerSaidValid: boolean) => {
      if (!currentSlashCard || slashFeedback) return;
      const isRight = currentSlashCard.isValid === playerSaidValid;
      const nextAttempts = attemptsCount + 1;
      const nextCorrect = isRight ? correctCount + 1 : correctCount;
      const nextCombo = isRight ? combo + 1 : 0;
      const nextMaxCombo = Math.max(maxCombo, nextCombo);
      const nextHearts = isRight ? hearts : Math.max(0, hearts - 1);

      setAttemptsCount(nextAttempts);
      setCorrectCount(nextCorrect);
      setCombo(nextCombo);
      setMaxCombo(nextMaxCombo);
      setHearts(nextHearts);
      setSlashHistory((prev) => [
        ...prev,
        { card: currentSlashCard, playerSaidValid, correct: isRight },
      ]);
      setSlashFeedback({
        correct: isRight,
        reason: currentSlashCard.reason,
        fix: currentSlashCard.recommendedFix,
      });

      if (isRight) {
        const pts = 25 + Math.min(nextCombo, 5) * 5;
        setScore((s) => s + pts);
        playSuccessSound(nextCombo);
        setBurst((b) => ({
          id: b.id + 1,
          text: `+${pts}`,
          subtext: nextCombo >= 3 ? `Combo x${nextCombo}!` : undefined,
        }));
        if (nextCombo === 4) fireSuccessSpark();
      } else {
        playWrongSound();
      }

      advanceTimerRef.current = globalThis.setTimeout(() => {
        advanceSlash(slashIndex + 1, nextHearts, nextCorrect, nextAttempts, nextMaxCombo);
      }, 1450);
    },
    [
      currentSlashCard,
      slashFeedback,
      attemptsCount,
      correctCount,
      combo,
      maxCombo,
      hearts,
      slashIndex,
      advanceSlash,
    ]
  );

  // Keyboard shortcuts for Mode A (ArrowLeft = Bắt lỗi, ArrowRight = Giữ lại)
  useEffect(() => {
    if (phase !== "playing" || labMode !== "linter_slash") return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handleSlashDecision(false);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleSlashDecision(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, labMode, handleSlashDecision]);

  const currentFormulaRound = formulaRounds[formulaIndex] ?? null;

  const handlePourOption = (picked: TermSummary) => {
    if (!currentFormulaRound || pourFeedback) return;
    const isRight = picked.id === currentFormulaRound.target.id;
    const nextAttempts = attemptsCount + 1;
    const nextCorrect = isRight ? correctCount + 1 : correctCount;
    const nextCombo = isRight ? combo + 1 : 0;
    const nextMaxCombo = Math.max(maxCombo, nextCombo);

    setAttemptsCount(nextAttempts);
    setCorrectCount(nextCorrect);
    setCombo(nextCombo);
    setMaxCombo(nextMaxCombo);
    setPourFeedback({ pickedId: picked.id, correct: isRight, target: currentFormulaRound.target });
    setFormulaHistory((prev) => [...prev, { round: currentFormulaRound, picked, correct: isRight }]);

    if (isRight) {
      const pts = 30 + Math.min(nextCombo, 5) * 5;
      setScore((s) => s + pts);
      playSuccessSound(nextCombo);
      setBurst((b) => ({
        id: b.id + 1,
        text: `+${pts} Pha chuẩn!`,
        subtext: nextCombo >= 3 ? `Combo x${nextCombo}!` : undefined,
      }));
      if (nextCombo === 4) fireSuccessSpark();
    } else {
      playWrongSound();
    }

    advanceTimerRef.current = globalThis.setTimeout(() => {
      setPourFeedback(null);
      if (formulaIndex + 1 >= formulaRounds.length) {
        finishRound(nextCorrect, nextAttempts, nextMaxCombo);
      } else {
        setFormulaIndex((i) => i + 1);
      }
    }, 1500);
  };

  const accuracyPct = useMemo(
    () => (attemptsCount > 0 ? Math.round((correctCount / attemptsCount) * 100) : 0),
    [correctCount, attemptsCount]
  );

  if (loading) {
    return (
      <div className="rounded-3xl border border-sky-100 bg-white/90 p-10 text-center text-sm text-slate-500">
        Đang chuẩn bị Phòng Thí Nghiệm IUPAC &amp; Công thức SI...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Sub-mode Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-200/80 bg-white/95 p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: "linter_slash", label: "Bắt Lỗi Phù Thủy (TT 32/2018)", icon: Swords },
              { id: "formula_mixer", label: "Phòng Pha Chế Công Thức", icon: FlaskConical },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = labMode === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  clearAdvanceTimer();
                  playClickSound();
                  setLabMode(item.id);
                  setPhase("ready");
                }}
                className={`relative inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition-colors sm:text-sm ${
                  active ? "text-white" : "text-slate-700 hover:bg-orange-50"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="iupac-mode-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 shadow-sm"
                  />
                )}
                <Icon className="relative z-10 h-4 w-4" />
                <span className="relative z-10">{item.label}</span>
              </button>
            );
          })}
        </div>

        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
          Chuẩn Hóa IUPAC · Sinh · Lí SI · KHTN 6–9 (Khối {grade})
        </span>
      </div>

      {/* READY LOBBY */}
      {phase === "ready" && (
        <div className="space-y-5 rounded-3xl border border-orange-200 bg-white/95 p-6 shadow-sm">
          {labMode === "linter_slash" ? (
            <>
              <div className="space-y-1.5">
                <h2 className="text-2xl font-extrabold text-slate-900">
                  Bắt Lỗi Phù Thủy (Terminology Linter Slash)
                </h2>
                <p className="text-sm text-slate-600">
                  Kiểm tra nhanh <strong>12 thẻ bài</strong>: bấm{" "}
                  <strong className="text-rose-600">Bắt lỗi! (←)</strong> nếu viết sai danh pháp cũ
                  (<em>axit, bazơ, oxit, ADN, hợp chất dùng tên Việt...</em>) hoặc{" "}
                  <strong className="text-emerald-700">Giữ lại! (→)</strong> nếu viết chuẩn IUPAC /
                  thuộc <strong>13 nguyên tố ngoại lệ ở dạng đơn chất</strong>. Bạn có{" "}
                  <strong className="text-rose-600">3 trái tim ❤️❤️❤️</strong>!
                </p>
              </div>
              <div className="grid gap-3 rounded-2xl bg-amber-50/70 p-4 text-xs text-amber-950 sm:grid-cols-2">
                <div>
                  <strong className="block text-rose-700">Bẫy hay gặp:</strong>
                  <span>
                    “Nhẫn vàng” (đơn chất) = <strong>Giữ lại</strong>, nhưng “muối vàng(III)
                    clorua” (hợp chất) = <strong>Bắt lỗi</strong> vì phải dùng <em>Gold(III) chloride</em>!
                  </span>
                </div>
                <div>
                  <strong className="block text-emerald-700">Phần thưởng Huy hiệu:</strong>
                  <span>
                    Đạt <strong>≥ 8 thẻ đúng</strong> và <strong>≥ 75% chính xác</strong> mở khóa{" "}
                    <strong>Hiệp Sĩ IUPAC</strong>!
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <h2 className="text-2xl font-extrabold text-slate-900">
                  Phòng Pha Chế Công Thức &amp; Đơn Vị SI
                </h2>
                <p className="text-sm text-slate-600">
                  Quan sát công thức hóa học hoặc ký hiệu vật lí hiện lên trong{" "}
                  <strong>bình thí nghiệm</strong> (<code>H₂SO₄</code>, <code>p = F / S (Pa)</code>
                  , <code>M = F · d (N·m)</code>...), sau đó rót đúng lọ thuốc thử tên tiếng Anh
                  chuẩn IUPAC / SI!
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "all" as const, label: "Tất cả (Hóa · Lí · Sinh)" },
                    { id: "chemistry" as const, label: "Hóa học (IUPAC)" },
                    { id: "physics" as const, label: "Vật lí (SI)" },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        playClickSound();
                        setMixerFilter(f.id);
                      }}
                      className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                        mixerFilter === f.id
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-sky-50"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={showViClue}
                    onChange={(e) => setShowViClue(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <Eye className="h-3.5 w-3.5 text-sky-600" />
                  Hiện gợi ý Tiếng Việt
                </label>
              </div>
            </>
          )}

          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={startRound}
            className="btn-tactile inline-flex w-full items-center justify-center gap-2 rounded-2xl border-rose-700 bg-gradient-to-r from-orange-500 via-rose-500 to-fuchsia-600 py-3.5 text-base font-extrabold text-white shadow-md hover:opacity-95"
          >
            <Play className="h-5 w-5" />
            {labMode === "linter_slash" ? "Vào Trận Bắt Lỗi IUPAC!" : "Bắt Đầu Pha Chế Công Thức!"}
          </motion.button>
        </div>
      )}

      {/* ACTIVE GAMEPLAY */}
      {phase === "playing" && (
        <div className="relative space-y-4 rounded-3xl border-2 border-orange-200 bg-white/95 p-5 shadow-md">
          <FloatingXPBurst
            burstKey={burst.id}
            text={burst.text}
            subtext={burst.subtext}
            className="right-6 top-3"
          />

          {/* HUD */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-indigo-100 px-3 py-1 text-sm font-extrabold text-indigo-900">
                {score} điểm
              </span>
              <span className="rounded-xl bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                {labMode === "linter_slash"
                  ? `Thẻ ${Math.min(slashIndex + 1, slashDeck.length)}/${slashDeck.length}`
                  : `Ống nghiệm ${Math.min(formulaIndex + 1, formulaRounds.length)}/${formulaRounds.length}`}
              </span>
              {combo >= 2 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 px-3 py-1 text-xs font-extrabold text-white shadow-sm">
                  <Flame className="h-3.5 w-3.5" />
                  Combo x{combo}
                </span>
              )}
            </div>

            {labMode === "linter_slash" && (
              <div className="flex items-center gap-1" aria-label={`Còn ${hearts} mạng`}>
                {[0, 1, 2].map((idx) => (
                  <Heart
                    key={idx}
                    className={`h-5 w-5 transition ${
                      idx < hearts ? "fill-rose-500 text-rose-500" : "text-slate-300"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* MODE A: LINTER SLASH */}
          {labMode === "linter_slash" && currentSlashCard && (
            <div className="space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSlashCard.id}
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={
                    slashFeedback && !slashFeedback.correct
                      ? { x: [0, -8, 8, -5, 5, 0], opacity: 1, y: 0, scale: 1 }
                      : { opacity: 1, y: 0, scale: 1, x: 0 }
                  }
                  exit={{ opacity: 0, y: -12, scale: 0.96 }}
                  transition={{ duration: 0.22 }}
                  className={`rounded-3xl border-2 p-6 text-center shadow-sm ${
                    slashFeedback
                      ? slashFeedback.correct
                        ? "border-emerald-400 bg-emerald-50/70"
                        : "border-rose-400 bg-rose-50/70"
                      : "border-indigo-200 bg-gradient-to-br from-indigo-50/60 via-white to-amber-50/60"
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-extrabold text-indigo-800">
                    <Sparkles className="h-3.5 w-3.5" />
                    {currentSlashCard.contextLabel}
                  </span>
                  <div className="mt-4 text-xl font-extrabold text-slate-900 sm:text-2xl">
                    {currentSlashCard.text}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Câu này tuân thủ đúng danh pháp GDPT 2018 (IUPAC / SI / 13 ngoại lệ) hay mắc lỗi
                    cũ?
                  </p>
                </motion.div>
              </AnimatePresence>

              {slashFeedback ? (
                <div
                  className={`flex flex-col gap-2 rounded-2xl border p-4 text-xs sm:flex-row sm:items-center sm:justify-between ${
                    slashFeedback.correct
                      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                      : "border-rose-300 bg-rose-50 text-rose-950"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {slashFeedback.correct ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
                    )}
                    <div>
                      <div className="font-extrabold">
                        {slashFeedback.correct ? "Chính xác!" : "Chưa đúng rồi!"}{" "}
                        {slashFeedback.fix && (
                          <span className="text-indigo-700">→ Chuẩn: {slashFeedback.fix}</span>
                        )}
                      </div>
                      <p className="mt-0.5">{slashFeedback.reason}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      advanceSlash(slashIndex + 1, hearts, correctCount, attemptsCount, maxCombo)
                    }
                    className="shrink-0 rounded-xl bg-white px-3 py-1.5 font-bold text-slate-800 shadow-sm hover:bg-slate-50"
                  >
                    Thẻ tiếp →
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleSlashDecision(false)}
                    className="btn-tactile flex items-center justify-center gap-2 rounded-2xl border border-rose-700 bg-gradient-to-r from-rose-500 to-orange-500 py-3.5 text-sm font-extrabold text-white shadow hover:opacity-95 sm:text-base"
                  >
                    <AlertTriangle className="h-5 w-5" />
                    Bắt Lỗi! (←)
                  </motion.button>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleSlashDecision(true)}
                    className="btn-tactile flex items-center justify-center gap-2 rounded-2xl border border-emerald-700 bg-gradient-to-r from-emerald-500 to-teal-500 py-3.5 text-sm font-extrabold text-white shadow hover:opacity-95 sm:text-base"
                  >
                    <ShieldCheck className="h-5 w-5" />
                    Giữ Lại! (→)
                  </motion.button>
                </div>
              )}
            </div>
          )}

          {/* MODE B: FORMULA MIXER */}
          {labMode === "formula_mixer" && currentFormulaRound && (
            <div className="space-y-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentFormulaRound.target.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={
                    pourFeedback && !pourFeedback.correct
                      ? { x: [0, -8, 8, -5, 5, 0], opacity: 1, scale: 1 }
                      : { opacity: 1, scale: 1, x: 0 }
                  }
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="relative overflow-hidden rounded-3xl border-2 border-sky-200 bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 p-6 text-center text-white shadow-inner"
                >
                  {/* Animated glowing reagent fill at bottom of lab chamber */}
                  <motion.div
                    initial={{ height: "18%" }}
                    animate={{
                      height: pourFeedback ? (pourFeedback.correct ? "85%" : "40%") : "35%",
                    }}
                    transition={{ type: "spring", stiffness: 160, damping: 18 }}
                    className={`pointer-events-none absolute inset-x-0 bottom-0 opacity-35 ${
                      pourFeedback
                        ? pourFeedback.correct
                          ? "bg-gradient-to-t from-emerald-400 to-cyan-300"
                          : "bg-gradient-to-t from-rose-500 to-orange-400"
                        : "bg-gradient-to-t from-sky-500 to-indigo-400"
                    }`}
                  />

                  <div className="relative space-y-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-0.5 text-xs font-bold text-sky-100">
                      <FlaskConical className="h-3.5 w-3.5 text-cyan-300" />
                      Công thức / Ký hiệu trong bình phản ứng
                    </span>
                    <div className="formula-pill text-3xl font-extrabold tracking-wide text-cyan-200 sm:text-4xl">
                      {currentFormulaRound.target.formula_or_symbol}
                    </div>
                    {showViClue && (
                      <div className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold text-amber-200">
                        <HelpCircle className="h-3.5 w-3.5" />
                        Gợi ý: {currentFormulaRound.target.term_vi}
                      </div>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="grid gap-3 sm:grid-cols-2">
                {currentFormulaRound.options.map((opt) => {
                  let cls =
                    "border-slate-200 border-b-slate-300 bg-white text-slate-900 hover:border-indigo-400 hover:bg-indigo-50/40";
                  if (pourFeedback) {
                    if (opt.id === currentFormulaRound.target.id) {
                      cls =
                        "border-emerald-500 border-b-emerald-600 bg-emerald-50 text-emerald-950 font-extrabold";
                    } else if (opt.id === pourFeedback.pickedId) {
                      cls = "border-rose-400 border-b-rose-500 bg-rose-50 text-rose-800";
                    }
                  }
                  return (
                    <motion.button
                      key={opt.id}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      disabled={Boolean(pourFeedback)}
                      onClick={() => handlePourOption(opt)}
                      className={`btn-tactile flex items-center justify-between gap-2 rounded-2xl border px-4 py-3.5 text-left text-sm font-bold transition ${cls}`}
                    >
                      <span>{opt.term_en}</span>
                      <FlaskConical className="h-4 w-4 shrink-0 opacity-60" />
                    </motion.button>
                  );
                })}
              </div>

              {pourFeedback && (
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5 text-xs ${
                    pourFeedback.correct
                      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                      : "border-rose-300 bg-rose-50 text-rose-950"
                  }`}
                >
                  <div>
                    <strong>{pourFeedback.target.term_en}</strong> [
                    {pourFeedback.target.formula_or_symbol}] ={" "}
                    <strong>{pourFeedback.target.term_vi}</strong>
                  </div>
                  <SpeakButton termEn={pourFeedback.target.term_en} label="Nghe phát âm" />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SUMMARY */}
      {phase === "finished" && (
        <div className="space-y-5 rounded-3xl border border-indigo-200 bg-white/95 p-6 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="text-xs font-extrabold uppercase text-indigo-700">
                Tổng kết {labMode === "linter_slash" ? "Bắt Lỗi Phù Thủy" : "Phòng Pha Chế Công Thức"}
              </div>
              <div className="mt-1 text-4xl font-extrabold text-slate-900">
                <AnimatedScoreCounter value={score} decimals={0} className="text-indigo-700" />{" "}
                <span className="text-lg font-bold text-slate-500">điểm</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 text-center">
              <div className="rounded-2xl bg-emerald-50 px-3.5 py-2.5">
                <div className="text-lg font-extrabold text-emerald-700">
                  {correctCount}/{attemptsCount}
                </div>
                <div className="text-[11px] font-bold text-emerald-800">Chuẩn xác</div>
              </div>
              <div className="rounded-2xl bg-sky-50 px-3.5 py-2.5">
                <div className="text-lg font-extrabold text-sky-700">{accuracyPct}%</div>
                <div className="text-[11px] font-bold text-sky-800">Tỉ lệ đúng</div>
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
                {rewardResult.level})
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
              Đăng nhập bằng tài khoản học sinh để lưu điểm XP và mở khóa huy hiệu{" "}
              <strong>Hiệp Sĩ IUPAC</strong>!
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setShowReview((p) => !p)}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-indigo-700 hover:underline"
          >
            {showReview ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showReview ? "Thu gọn nhật ký trận đấu" : "Xem giải thích chi tiết từng câu đã chơi"}
          </button>

          {showReview && (
            <div className="space-y-2">
              {labMode === "linter_slash"
                ? slashHistory.map((h) => (
                    <div
                      key={h.card.id}
                      className={`rounded-xl border p-3 text-xs ${
                        h.correct
                          ? "border-emerald-200 bg-emerald-50/50"
                          : "border-rose-200 bg-rose-50/50"
                      }`}
                    >
                      <div className="font-bold text-slate-900">
                        {h.correct ? "✓" : "✗"} {h.card.text} (
                        {h.card.isValid ? "Chuẩn TT32" : "Lỗi cần sửa"})
                      </div>
                      <p className="mt-0.5 text-slate-600">{h.card.reason}</p>
                    </div>
                  ))
                : formulaHistory.map((h) => (
                    <div
                      key={h.round.target.id}
                      className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-xs ${
                        h.correct
                          ? "border-emerald-200 bg-emerald-50/50"
                          : "border-rose-200 bg-rose-50/50"
                      }`}
                    >
                      <div>
                        <strong>
                          {h.correct ? "✓" : "✗"} {h.round.target.formula_or_symbol}
                        </strong>{" "}
                        → {h.round.target.term_en} ({h.round.target.term_vi})
                      </div>
                      <SpeakButton termEn={h.round.target.term_en} />
                    </div>
                  ))}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={startRound}
              className="btn-tactile inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border-rose-700 bg-gradient-to-r from-orange-500 to-rose-500 py-3 text-sm font-extrabold text-white shadow hover:opacity-95"
            >
              <RotateCcw className="h-4 w-4" />
              Chơi Lượt Mới
            </motion.button>
            <button
              type="button"
              onClick={() => {
                playClickSound();
                setPhase("ready");
              }}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Đổi Chế Độ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

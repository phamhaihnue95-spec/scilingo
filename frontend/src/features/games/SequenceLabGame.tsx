import { useEffect, useMemo, useRef, useState } from "react";
import { Reorder, motion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Award,
  CheckCircle2,
  Eye,
  Flame,
  GripVertical,
  ListOrdered,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react";

import { api } from "../../api/client";
import type { AuthSession, Discipline, GameRewardResult } from "../../api/types";
import {
  AnimatedScoreCounter,
  FloatingXPBurst,
  SpeakButton,
} from "../../components/motion/MotionPrimitives";
import { fireSuccessSpark, fireVictoryCelebration } from "../../utils/confetti";
import { playCelebrationSound, playClickSound, playSuccessSound, playWrongSound } from "../../utils/soundFx";

interface SequenceStep {
  id: string;
  labelEn: string;
  labelVi: string;
  hint?: string;
}

interface SequenceChallenge {
  id: string;
  titleVi: string;
  titleEn: string;
  discipline: Discipline;
  lessonRef: string;
  directionHint: string;
  explanationVi: string;
  steps: SequenceStep[];
}

type PackFilter = "all" | "bio_earth" | "chem_general";

const SEQUENCE_BANK: SequenceChallenge[] = [
  {
    id: "respiratory",
    titleVi: "Đường đi của không khí khi hít vào (Hệ hô hấp)",
    titleEn: "Air Pathway During Inhalation",
    discipline: "biology",
    lessonRef: "Bài 34 · Unit 9",
    directionHint: "Từ ngoài (1) đi sâu vào phổi (6)",
    explanationVi:
      "Không khí đi từ Nasal cavity -> Pharynx -> Larynx -> Trachea -> Bronchus và trao đổi khí tại Alveoli.",
    steps: [
      { id: "resp-1", labelEn: "Nasal cavity", labelVi: "Khoang mũi" },
      { id: "resp-2", labelEn: "Pharynx", labelVi: "Hầu (Họng)" },
      { id: "resp-3", labelEn: "Larynx", labelVi: "Thanh quản" },
      { id: "resp-4", labelEn: "Trachea", labelVi: "Khí quản" },
      { id: "resp-5", labelEn: "Bronchus", labelVi: "Phế quản" },
      { id: "resp-6", labelEn: "Alveoli", labelVi: "Phế nang" },
    ],
  },
  {
    id: "digestive",
    titleVi: "Thứ tự ống tiêu hóa ở người (Hệ tiêu hóa)",
    titleEn: "Human Digestive Tract Sequence",
    discipline: "biology",
    lessonRef: "Bài 32 · Unit 9",
    directionHint: "Từ nơi tiếp nhận thức ăn (1) đến cuối ống tiêu hóa (5)",
    explanationVi:
      "Thức ăn đi qua Mouth -> Esophagus -> Stomach -> Small intestine (hấp thụ chính) -> Large intestine.",
    steps: [
      { id: "dig-1", labelEn: "Mouth", labelVi: "Khoang miệng" },
      { id: "dig-2", labelEn: "Esophagus", labelVi: "Thực quản" },
      { id: "dig-3", labelEn: "Stomach", labelVi: "Dạ dày" },
      { id: "dig-4", labelEn: "Small intestine", labelVi: "Ruột non" },
      { id: "dig-5", labelEn: "Large intestine", labelVi: "Ruột già" },
    ],
  },
  {
    id: "food_chain",
    titleVi: "Chuỗi thức ăn trong hệ sinh thái đồng cỏ",
    titleEn: "Terrestrial Food Chain Trophic Levels",
    discipline: "biology",
    lessonRef: "Bài 44 · Unit 16",
    directionHint: "Từ sinh vật tự dưỡng đầu chuỗi (1) đến sinh vật phân giải (5)",
    explanationVi:
      "Năng lượng truyền từ Producer (Grass) -> Primary consumer -> Secondary consumer -> Tertiary consumer -> Decomposer (Bacteria).",
    steps: [
      { id: "fc-1", labelEn: "Producer (Grass)", labelVi: "Sinh vật sản xuất (Cỏ)" },
      { id: "fc-2", labelEn: "Primary consumer (Grasshopper)", labelVi: "Sinh vật tiêu thụ bậc 1 (Châu chấu)" },
      { id: "fc-3", labelEn: "Secondary consumer (Frog)", labelVi: "Sinh vật tiêu thụ bậc 2 (Ếch)" },
      { id: "fc-4", labelEn: "Tertiary consumer (Snake)", labelVi: "Sinh vật tiêu thụ bậc 3 (Rắn)" },
      { id: "fc-5", labelEn: "Decomposer (Bacteria)", labelVi: "Sinh vật phân giải (Vi khuẩn)" },
    ],
  },
  {
    id: "taxonomy",
    titleVi: "Thứ bậc phân loại sinh vật (từ lớn đến nhỏ)",
    titleEn: "Biological Taxonomy Hierarchy",
    discipline: "biology",
    lessonRef: "Unit 15 · Classification",
    directionHint: "Từ bậc phân loại rộng nhất (1) xuống hẹp nhất (7)",
    explanationVi:
      "7 bậc phân loại chuẩn quốc tế: Kingdom -> Phylum -> Class -> Order -> Family -> Genus -> Species.",
    steps: [
      { id: "tax-1", labelEn: "Kingdom", labelVi: "Giới" },
      { id: "tax-2", labelEn: "Phylum", labelVi: "Ngành" },
      { id: "tax-3", labelEn: "Class", labelVi: "Lớp" },
      { id: "tax-4", labelEn: "Order", labelVi: "Bộ" },
      { id: "tax-5", labelEn: "Family", labelVi: "Họ" },
      { id: "tax-6", labelEn: "Genus", labelVi: "Chi / Giống" },
      { id: "tax-7", labelEn: "Species", labelVi: "Loài" },
    ],
  },
  {
    id: "ph_scale",
    titleVi: "Thang đo pH tăng dần từ Acid mạnh sang Base mạnh (IUPAC)",
    titleEn: "Ascending pH Scale (Acid to Base)",
    discipline: "chemistry",
    lessonRef: "Bài 8–10 · Unit 2",
    directionHint: "Từ dung dịch có pH nhỏ nhất (1) đến pH lớn nhất (5)",
    explanationVi:
      "Theo chuẩn IUPAC: Hydrochloric acid (HCl, pH ≈ 1) < Lemon juice (pH ≈ 2.5) < Pure water (pH = 7) < Baking soda (NaHCO₃, pH ≈ 8.5) < Sodium hydroxide (NaOH, pH ≈ 13).",
    steps: [
      { id: "ph-1", labelEn: "Hydrochloric acid (HCl)", labelVi: "Acid mạnh · pH ≈ 1" },
      { id: "ph-2", labelEn: "Lemon juice", labelVi: "Acid yếu · pH ≈ 2.5" },
      { id: "ph-3", labelEn: "Pure water (H₂O)", labelVi: "Trung tính · pH = 7" },
      { id: "ph-4", labelEn: "Baking soda solution (NaHCO₃)", labelVi: "Base yếu · pH ≈ 8.5" },
      { id: "ph-5", labelEn: "Sodium hydroxide (NaOH)", labelVi: "Base mạnh · pH ≈ 13" },
    ],
  },
  {
    id: "body_org",
    titleVi: "Cấp độ tổ chức cơ thể đa bào (từ nhỏ đến lớn)",
    titleEn: "Levels of Biological Organization",
    discipline: "biology",
    lessonRef: "Bài 30 · Unit 8",
    directionHint: "Từ đơn vị cơ bản nhất (1) đến cơ thể hoàn chỉnh (5)",
    explanationVi:
      "Nhiều Cell giống nhau tạo thành Tissue -> kết hợp thành Organ -> Organ system -> hoàn chỉnh thành Organism.",
    steps: [
      { id: "bo-1", labelEn: "Cell", labelVi: "Tế bào" },
      { id: "bo-2", labelEn: "Tissue", labelVi: "Mô" },
      { id: "bo-3", labelEn: "Organ", labelVi: "Cơ quan" },
      { id: "bo-4", labelEn: "Organ system", labelVi: "Hệ cơ quan" },
      { id: "bo-5", labelEn: "Organism", labelVi: "Cơ thể hoàn chỉnh" },
    ],
  },
  {
    id: "solar_system",
    titleVi: "Các hành tinh Hệ Mặt Trời (từ trong ra ngoài)",
    titleEn: "Planets from the Sun Outward",
    discipline: "physics",
    lessonRef: "Unit 1 · Astronomy",
    directionHint: "Từ hành tinh gần Mặt Trời nhất (1) ra xa nhất (6)",
    explanationVi:
      "Thứ tự 6 hành tinh đầu tiên tính từ Mặt Trời: Mercury, Venus, Earth, Mars, Jupiter, Saturn.",
    steps: [
      { id: "sol-1", labelEn: "Mercury", labelVi: "Sao Thủy" },
      { id: "sol-2", labelEn: "Venus", labelVi: "Sao Kim" },
      { id: "sol-3", labelEn: "Earth", labelVi: "Trái Đất" },
      { id: "sol-4", labelEn: "Mars", labelVi: "Sao Hỏa" },
      { id: "sol-5", labelEn: "Jupiter", labelVi: "Sao Mộc" },
      { id: "sol-6", labelEn: "Saturn", labelVi: "Sao Thổ" },
    ],
  },
  {
    id: "reaction_flow",
    titleVi: "Diễn biến bản chất của Phản ứng Hóa học",
    titleEn: "Stages of a Chemical Reaction",
    discipline: "chemistry",
    lessonRef: "Bài 2–4 · Unit 3",
    directionHint: "Từ chất ban đầu (1) đến chất mới tạo thành (4)",
    explanationVi:
      "Trong phản ứng hóa học: Reactants -> Bond breaking -> Rearrangement of atoms -> hình thành Products mới.",
    steps: [
      { id: "rx-1", labelEn: "Reactants", labelVi: "Chất tham gia phản ứng ban đầu" },
      { id: "rx-2", labelEn: "Bond breaking", labelVi: "Phá vỡ liên kết cũ giữa các nguyên tử" },
      { id: "rx-3", labelEn: "Rearrangement of atoms", labelVi: "Sắp xếp lại liên kết các nguyên tử" },
      { id: "rx-4", labelEn: "Products", labelVi: "Tạo thành chất sản phẩm mới" },
    ],
  },
];

function shuffleDeranged(steps: SequenceStep[]): SequenceStep[] {
  const copy = [...steps];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  const alreadySolved = copy.every((item, idx) => item.id === steps[idx].id);
  if (alreadySolved && copy.length >= 2) {
    [copy[0], copy[1]] = [copy[1], copy[0]];
  }
  return copy;
}

interface Props {
  session: AuthSession | null;
  onRewardRecorded?: () => void;
}

export function SequenceLabGame({ session, onRewardRecorded }: Props) {
  const [pack, setPack] = useState<PackFilter>("all");
  const [phase, setPhase] = useState<"setup" | "playing" | "finished">("setup");
  const [rounds, setRounds] = useState<SequenceChallenge[]>([]);
  const [roundIdx, setRoundIdx] = useState(0);
  const [items, setItems] = useState<SequenceStep[]>([]);
  const [checkedStatus, setCheckedStatus] = useState<boolean[] | null>(null);
  const [roundSolved, setRoundSolved] = useState(false);
  const [revealedSolution, setRevealedSolution] = useState(false);

  const [score, setScore] = useState(0);
  const [correctRounds, setCorrectRounds] = useState(0);
  const [totalChecks, setTotalChecks] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [triesThisRound, setTriesThisRound] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const [burstLabel, setBurstLabel] = useState("+35");
  const [rewardResult, setRewardResult] = useState<GameRewardResult | null>(null);
  const rewardSentRef = useRef(false);

  const filteredPool = useMemo(() => {
    if (pack === "bio_earth") {
      return SEQUENCE_BANK.filter((s) => s.discipline === "biology");
    }
    if (pack === "chem_general") {
      return SEQUENCE_BANK.filter((s) => s.discipline !== "biology");
    }
    return SEQUENCE_BANK;
  }, [pack]);

  const currentRound = rounds[roundIdx] ?? null;

  const setupRoundState = (challenge: SequenceChallenge) => {
    setItems(shuffleDeranged(challenge.steps));
    setCheckedStatus(null);
    setRoundSolved(false);
    setRevealedSolution(false);
    setTriesThisRound(0);
  };

  const handleStart = () => {
    playClickSound();
    const copy = [...filteredPool];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    const chosen = copy.slice(0, Math.min(6, copy.length));
    setRounds(chosen);
    setRoundIdx(0);
    setScore(0);
    setCorrectRounds(0);
    setTotalChecks(0);
    setCombo(0);
    setMaxCombo(0);
    setRewardResult(null);
    rewardSentRef.current = false;
    if (chosen[0]) {
      setupRoundState(chosen[0]);
    }
    setPhase("playing");
  };

  const moveItem = (fromIdx: number, direction: -1 | 1) => {
    if (roundSolved) return;
    const toIdx = fromIdx + direction;
    if (toIdx < 0 || toIdx >= items.length) return;
    playClickSound();
    const next = [...items];
    [next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
    setItems(next);
    setCheckedStatus(null);
  };

  const handleCheck = () => {
    if (!currentRound || roundSolved) return;
    setTotalChecks((c) => c + 1);
    const attemptNo = triesThisRound + 1;
    setTriesThisRound(attemptNo);

    const statusList = items.map((item, idx) => item.id === currentRound.steps[idx]?.id);
    setCheckedStatus(statusList);

    if (statusList.every(Boolean)) {
      const nextCombo = attemptNo === 1 ? combo + 1 : 1;
      const earned = Math.max(15, 40 - (attemptNo - 1) * 10 + (nextCombo >= 3 ? 15 : 0));
      setCombo(nextCombo);
      setMaxCombo((m) => Math.max(m, nextCombo));
      setCorrectRounds((n) => n + 1);
      setScore((s) => s + earned);
      setRoundSolved(true);
      setBurstLabel(`+${earned}đ`);
      setBurstKey((k) => k + 1);
      playSuccessSound(nextCombo);
      fireSuccessSpark();
    } else {
      setCombo(0);
      playWrongSound();
    }
  };

  const handleRevealAndUnlockNext = () => {
    if (!currentRound) return;
    playClickSound();
    setItems([...currentRound.steps]);
    setCheckedStatus(currentRound.steps.map(() => true));
    setRevealedSolution(true);
    setRoundSolved(true);
    setCombo(0);
  };

  const handleNextRound = () => {
    playClickSound();
    const nextIdx = roundIdx + 1;
    if (nextIdx >= rounds.length) {
      setPhase("finished");
      return;
    }
    setRoundIdx(nextIdx);
    setupRoundState(rounds[nextIdx]);
  };

  useEffect(() => {
    if (phase !== "finished" || rewardSentRef.current) return;
    rewardSentRef.current = true;

    if (correctRounds >= 4) {
      fireVictoryCelebration();
      playCelebrationSound();
    } else {
      playSuccessSound(1);
    }

    if (!session) return;

    api
      .recordGameReward({
        game_type: "sequence_lab",
        correct_count: correctRounds,
        total_attempts: Math.max(correctRounds, totalChecks, 1),
        max_combo: maxCombo,
        discipline: pack === "chem_general" ? "chemistry" : "biology",
      })
      .then((res) => {
        setRewardResult(res);
        onRewardRecorded?.();
      })
      .catch(() => {
        // Offline or network hiccup keeps game result visible without crash
      });
  }, [phase, correctRounds, totalChecks, maxCombo, pack, session, onRewardRecorded]);

  return (
    <div className="space-y-5">
      {/* SETUP */}
      {phase === "setup" && (
        <section className="rounded-3xl border border-emerald-200 bg-white/95 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-900">
                <ListOrdered className="h-3.5 w-3.5" />
                <span>Mini-Game 3 · Tháp Sắp Xếp Dây Chuyền KHTN 8</span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">
                Kéo thả sắp xếp đúng trật tự quy trình Khoa học!
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Xếp các thẻ thuật ngữ từ trên xuống dưới theo đúng trình tự hệ hô hấp, ống tiêu hóa,
                chuỗi thức ăn, 7 bậc phân loại, thang pH Acid–Base chuẩn IUPAC hay thứ tự hành tinh.
                Kéo thả bằng chuột/tay hoặc bấm nút mũi tên Lên/Xuống siêu mượt!
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 text-center sm:min-w-[230px]">
              <div className="text-xs font-bold uppercase text-emerald-800">Huy hiệu mở khóa</div>
              <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-extrabold text-emerald-700 shadow-sm">
                <Award className="h-4 w-4 text-amber-500" />
                Bậc Thầy Hệ Thống
              </div>
              <p className="mt-1 text-[11px] font-medium text-emerald-700">
                Hoàn thành ≥ 5 vòng với độ chính xác ≥ 75%
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {(
              [
                {
                  id: "all" as const,
                  title: "Tổng hợp Tích hợp (6 vòng)",
                  desc: "Gồm Sinh học, Hóa học IUPAC & Thiên văn học",
                },
                {
                  id: "bio_earth" as const,
                  title: "Chuyên sâu Sinh học (5 vòng)",
                  desc: "Hô hấp, Tiêu hóa, Chuỗi thức ăn, Tế bào & Phân loại",
                },
                {
                  id: "chem_general" as const,
                  title: "Hóa học IUPAC & Hệ Mặt Trời",
                  desc: "Thang pH Acid-Base, Phản ứng hóa học & Hành tinh",
                },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  playClickSound();
                  setPack(opt.id);
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  pack === opt.id
                    ? "border-emerald-600 bg-emerald-50 ring-2 ring-emerald-200"
                    : "border-slate-200 bg-slate-50/70 hover:bg-emerald-50/40"
                }`}
              >
                <div className="text-sm font-extrabold text-slate-900">{opt.title}</div>
                <div className="mt-1 text-xs text-slate-600">{opt.desc}</div>
              </button>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={handleStart}
              className="btn-tactile inline-flex items-center gap-2 rounded-2xl border-emerald-900 bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 px-6 py-3 text-base font-extrabold text-white shadow-lg"
            >
              <Sparkles className="h-5 w-5" />
              Bắt đầu Tháp Sắp Xếp
            </motion.button>
          </div>
        </section>
      )}

      {/* PLAYING */}
      {phase === "playing" && currentRound && (
        <section className="relative space-y-5 rounded-3xl border border-emerald-200 bg-white/95 p-5 shadow-md sm:p-6">
          <FloatingXPBurst burstKey={burstKey} text={burstLabel} subtext="Chuẩn xác!" />

          {/* HUD */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-4 text-sm font-extrabold">
              <span className="rounded-lg bg-white/15 px-2.5 py-1 text-xs">
                Vòng {roundIdx + 1} / {rounds.length}
              </span>
              <span className="inline-flex items-center gap-1 text-amber-300">
                <Trophy className="h-4 w-4" />
                {score} điểm
              </span>
              {combo >= 2 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-0.5 text-xs">
                  <Flame className="h-3.5 w-3.5" />
                  Combo x{combo}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setPhase("finished")}
              className="rounded-lg bg-white/15 px-3 py-1 text-xs font-bold hover:bg-white/25"
            >
              Kết thúc sớm
            </button>
          </div>

          {/* Round Prompt */}
          <div className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-emerald-50 to-sky-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold uppercase text-teal-800">
              <span>{currentRound.lessonRef}</span>
              <span className="rounded-full bg-white px-2.5 py-0.5 text-emerald-700 shadow-sm">
                {currentRound.directionHint}
              </span>
            </div>
            <h3 className="mt-1.5 text-lg font-extrabold text-slate-900">
              {currentRound.titleVi}
            </h3>
            <p className="text-xs font-semibold text-slate-500">{currentRound.titleEn}</p>
          </div>

          {/* Draggable + Accessible Reorder List */}
          <Reorder.Group
            axis="y"
            values={items}
            onReorder={(next) => {
              if (!roundSolved) {
                setItems(next);
                setCheckedStatus(null);
              }
            }}
            className="space-y-2.5"
          >
            {items.map((item, idx) => {
              const status = checkedStatus ? checkedStatus[idx] : null;
              let rowStyle =
                "border-slate-200 bg-white hover:border-indigo-400 hover:bg-sky-50/30";
              if (status === true) {
                rowStyle = "border-emerald-400 bg-emerald-50/90 text-emerald-950";
              } else if (status === false) {
                rowStyle = "border-rose-400 bg-rose-50/90 text-rose-950";
              }

              return (
                <Reorder.Item
                  key={item.id}
                  value={item}
                  dragListener={!roundSolved}
                  whileDrag={{ scale: 1.02, boxShadow: "0 12px 24px -8px rgba(15,23,42,0.18)" }}
                  className={`flex items-center justify-between gap-3 rounded-2xl border-2 px-3.5 py-3 shadow-sm transition-colors ${
                    roundSolved ? "cursor-default" : "cursor-grab active:cursor-grabbing"
                  } ${rowStyle}`}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {!roundSolved && (
                      <GripVertical className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                        status === true
                          ? "bg-emerald-600 text-white"
                          : status === false
                            ? "bg-rose-600 text-white"
                            : "bg-indigo-100 text-indigo-800"
                      }`}
                    >
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-extrabold text-slate-900">
                        {item.labelEn}
                      </div>
                      <div className="truncate text-xs font-medium text-slate-600">
                        {item.labelVi}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {status === true && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
                    {status === false && <XCircle className="h-5 w-5 text-rose-600" />}
                    <SpeakButton termEn={item.labelEn} />
                    {!roundSolved && (
                      <div className="flex flex-col gap-0.5 sm:flex-row">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveItem(idx, -1)}
                          aria-label={`Đưa ${item.labelEn} lên`}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-1 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-30"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === items.length - 1}
                          onClick={() => moveItem(idx, 1)}
                          aria-label={`Đưa ${item.labelEn} xuống`}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-1 text-slate-600 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-30"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>

          {/* Explanation & Actions */}
          {roundSolved && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`rounded-2xl border p-4 text-sm ${
                revealedSolution
                  ? "border-sky-200 bg-sky-50 text-sky-950"
                  : "border-emerald-200 bg-emerald-50 text-emerald-950"
              }`}
            >
              <div className="font-extrabold">
                {revealedSolution
                  ? "Đáp án trình tự chuẩn KHTN 8:"
                  : "Hoàn hảo! Dây chuyền khoa học chính xác!"}
              </div>
              <p className="mt-1 text-xs leading-relaxed">{currentRound.explanationVi}</p>
            </motion.div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            {!roundSolved ? (
              <>
                {triesThisRound >= 1 ? (
                  <button
                    type="button"
                    onClick={handleRevealAndUnlockNext}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    Xem đáp án chuẩn &amp; qua vòng
                  </button>
                ) : (
                  <span className="text-xs font-medium text-slate-500">
                    Mẹo: Kéo các thẻ hoặc bấm mũi tên Lên/Xuống để sắp xếp đúng thứ tự 1 →{" "}
                    {items.length}.
                  </span>
                )}

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={handleCheck}
                  className="btn-tactile inline-flex items-center gap-2 rounded-2xl border-emerald-900 bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-extrabold text-white shadow"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Kiểm tra dây chuyền!
                </motion.button>
              </>
            ) : (
              <div className="ml-auto">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.96 }}
                  onClick={handleNextRound}
                  className="btn-tactile inline-flex items-center gap-2 rounded-2xl border-indigo-900 bg-gradient-to-r from-indigo-600 to-sky-500 px-6 py-2.5 text-sm font-extrabold text-white shadow"
                >
                  <span>{roundIdx + 1 >= rounds.length ? "Xem Tổng Kết" : "Vòng Tiếp Theo"}</span>
                  <ArrowRight className="h-4 w-4" />
                </motion.button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* FINISHED */}
      {phase === "finished" && (
        <section className="space-y-5 rounded-3xl border border-emerald-200 bg-white/95 p-6 text-center shadow-md sm:p-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
            <Trophy className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-slate-900">
              Hoàn thành Tháp Sắp Xếp Dây Chuyền!
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Bạn đã ghép chuẩn{" "}
              <strong>
                {correctRounds}/{rounds.length}
              </strong>{" "}
              quy trình khoa học · Combo tối đa <strong>x{maxCombo}</strong>.
            </p>
          </div>

          <div className="mx-auto grid max-w-md grid-cols-2 gap-3">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-bold uppercase text-emerald-800">Điểm Tháp Sắp Xếp</div>
              <div className="mt-1 text-3xl font-black text-emerald-700">
                <AnimatedScoreCounter value={score} />
              </div>
            </div>
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <div className="text-xs font-bold uppercase text-indigo-800">Số vòng chuẩn</div>
              <div className="mt-1 text-3xl font-black text-indigo-700">
                {correctRounds}/{rounds.length}
              </div>
            </div>
          </div>

          {rewardResult ? (
            <div className="mx-auto max-w-xl rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-left text-sm text-emerald-950">
              <div className="font-extrabold">
                Đã cộng +{rewardResult.xp_earned} XP vào hồ sơ học tập (Tổng: {rewardResult.total_xp}{" "}
                XP · Lv.{rewardResult.level})
              </div>
              {rewardResult.newly_unlocked_badges.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {rewardResult.newly_unlocked_badges.map((b) => (
                    <span
                      key={b}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-0.5 text-xs font-extrabold text-amber-700 shadow-sm"
                    >
                      <Award className="h-3.5 w-3.5 text-amber-500" />
                      Mở khóa: {b}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : (
            !session && (
              <div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                Đăng nhập nhanh tài khoản Học sinh ở banner phía trên để lưu XP và mở khóa huy hiệu{" "}
                <strong>Bậc Thầy Hệ Thống</strong> nhé!
              </div>
            )
          )}

          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={handleStart}
              className="btn-tactile inline-flex items-center gap-2 rounded-2xl border-emerald-900 bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-extrabold text-white shadow"
            >
              <RotateCcw className="h-4 w-4" />
              Chơi lại bộ này
            </motion.button>
            <button
              type="button"
              onClick={() => setPhase("setup")}
              className="rounded-2xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Đổi chủ đề
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

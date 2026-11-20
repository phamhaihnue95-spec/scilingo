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
import type { AuthSession, Discipline, GameRewardResult, GradeLevel } from "../../api/types";
import {
  AnimatedScoreCounter,
  FloatingXPBurst,
  SpeakButton,
} from "../../components/motion/MotionPrimitives";
import { Icon3D, LottieSticker } from "../../components/visuals/ScienceVisuals";
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
  grade: GradeLevel;
  titleVi: string;
  titleEn: string;
  discipline: Discipline;
  lessonRef: string;
  directionHint: string;
  explanationVi: string;
  steps: SequenceStep[];
}

type PackFilter = "all" | "current_grade" | "bio_earth" | "chem_general";

const SEQUENCE_BANK: SequenceChallenge[] = [
  {
    id: "respiratory",
    grade: 8,
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
    grade: 8,
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
    grade: 8,
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
    grade: 6,
    titleVi: "Thứ bậc phân loại sinh vật (từ lớn đến nhỏ)",
    titleEn: "Biological Taxonomy Hierarchy",
    discipline: "biology",
    lessonRef: "KHTN 6 · Bài 22 & Unit 15",
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
    grade: 8,
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
    grade: 8,
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
    grade: 8,
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
    grade: 8,
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
  {
    id: "microscope_steps",
    grade: 6,
    titleVi: "Các bước sử dụng kính hiển vi quang học",
    titleEn: "Using an Optical Microscope",
    discipline: "biology",
    lessonRef: "KHTN 6 · Bài 3 & 18",
    directionHint: "Từ bước đặt tiêu bản (1) đến chỉnh nét chi tiết (5)",
    explanationVi:
      "Quy trình chuẩn an toàn: Place specimen on stage -> Select lowest objective lens -> Look from side & lower tube -> Adjust coarse focus knob -> Adjust fine focus knob.",
    steps: [
      { id: "mic-1", labelEn: "Place specimen on stage", labelVi: "Đặt tiêu bản lên bàn kính" },
      { id: "mic-2", labelEn: "Select lowest objective lens", labelVi: "Chọn vật kính có độ phóng đại nhỏ nhất" },
      { id: "mic-3", labelEn: "Look from side & lower tube", labelVi: "Nhìn từ ngoài hạ vật kính sát tiêu bản" },
      { id: "mic-4", labelEn: "Adjust coarse focus knob", labelVi: "Vặn ốc to (ốc sơ cấp) tìm ảnh" },
      { id: "mic-5", labelEn: "Adjust fine focus knob", labelVi: "Vặn ốc nhỏ (ốc vi cấp) chỉnh ảnh nét" },
    ],
  },
  {
    id: "matter_states_heat",
    grade: 6,
    titleVi: "Sự chuyển thể của nước khi tăng dần nhiệt độ",
    titleEn: "States of Matter Transition When Heating",
    discipline: "physics",
    lessonRef: "KHTN 6 · Bài 8",
    directionHint: "Từ trạng thái lạnh nhất (1) đến hơi nóng nhất (5)",
    explanationVi:
      "Khi gia nhiệt liên tục: Solid (Ice) -> Melting (0°C) -> Liquid (Water) -> Evaporation / Boiling (100°C) -> Gas (Water vapor).",
    steps: [
      { id: "st-1", labelEn: "Solid (Ice)", labelVi: "Thể rắn (Nước đá)" },
      { id: "st-2", labelEn: "Melting", labelVi: "Sự nóng chảy" },
      { id: "st-3", labelEn: "Liquid (Water)", labelVi: "Thể lỏng (Nước)" },
      { id: "st-4", labelEn: "Evaporation / Boiling", labelVi: "Sự bay hơi / Sự sôi" },
      { id: "st-5", labelEn: "Gas (Water vapor)", labelVi: "Thể khí (Hơi nước)" },
    ],
  },
  {
    id: "five_kingdoms",
    grade: 6,
    titleVi: "Năm giới sinh vật theo mức độ tiến hóa",
    titleEn: "Five Kingdoms of Living Organisms",
    discipline: "biology",
    lessonRef: "KHTN 6 · Bài 22",
    directionHint: "Từ cơ thể nhân sơ đơn giản nhất (1) đến động vật đa bào (5)",
    explanationVi:
      "Hệ thống 5 giới: Monera (Khởi sinh, nhân sơ) -> Protista (Nguyên sinh) -> Fungi (Nấm) -> Plantae (Thực vật) -> Animalia (Động vật).",
    steps: [
      { id: "fk-1", labelEn: "Monera (Bacteria)", labelVi: "Giới Khởi sinh (Nhân sơ)" },
      { id: "fk-2", labelEn: "Protista", labelVi: "Giới Nguyên sinh" },
      { id: "fk-3", labelEn: "Fungi", labelVi: "Giới Nấm" },
      { id: "fk-4", labelEn: "Plantae", labelVi: "Giới Thực vật" },
      { id: "fk-5", labelEn: "Animalia", labelVi: "Giới Động vật" },
    ],
  },
  {
    id: "matter_hierarchy_7",
    grade: 7,
    titleVi: "Cấu tạo vật chất từ hạt cơ bản đến hỗn hợp",
    titleEn: "Hierarchy of Matter (Micro to Macro)",
    discipline: "chemistry",
    lessonRef: "KHTN 7 · Bài 2–5",
    directionHint: "Từ hạt vi mô nhỏ nhất (1) đến hệ nhiều chất trộn lẫn (5)",
    explanationVi:
      "Proton, neutron, electron tạo nên Atom -> liên kết tạo Molecule -> hợp thành Pure substance -> trộn lẫn thành Mixture.",
    steps: [
      { id: "mh-1", labelEn: "Subatomic particles (p, n, e)", labelVi: "Hạt hạ nguyên tử (p, n, e)" },
      { id: "mh-2", labelEn: "Atom", labelVi: "Nguyên tử" },
      { id: "mh-3", labelEn: "Molecule", labelVi: "Phân tử" },
      { id: "mh-4", labelEn: "Pure substance", labelVi: "Đơn chất / Hợp chất tinh khiết" },
      { id: "mh-5", labelEn: "Mixture", labelVi: "Hỗn hợp nhiều chất" },
    ],
  },
  {
    id: "plant_water_transport",
    grade: 7,
    titleVi: "Con đường vận chuyển nước ở thực vật",
    titleEn: "Water Transport Pathway in Plants",
    discipline: "biology",
    lessonRef: "KHTN 7 · Bài 30",
    directionHint: "Từ đất (1) qua thân lên lá thoát ra ngoài (5)",
    explanationVi:
      "Nước di chuyển theo dòng: Soil water -> Root hair cell -> Xylem vessel (mạch gỗ) -> Leaf mesophyll -> Transpiration via stomata.",
    steps: [
      { id: "pw-1", labelEn: "Soil water", labelVi: "Nước trong đất" },
      { id: "pw-2", labelEn: "Root hair cell", labelVi: "Tế bào lông hút ở rễ" },
      { id: "pw-3", labelEn: "Xylem vessel", labelVi: "Mạch gỗ trong thân" },
      { id: "pw-4", labelEn: "Leaf mesophyll", labelVi: "Thịt lá (tế bào lá)" },
      { id: "pw-5", labelEn: "Transpiration via stomata", labelVi: "Thoát hơi nước qua khí khổng" },
    ],
  },
  {
    id: "metal_reactivity_9",
    grade: 9,
    titleVi: "Dãy hoạt động hóa học của kim loại (IUPAC)",
    titleEn: "Reactivity Series of Metals (Strongest to Weakest)",
    discipline: "chemistry",
    lessonRef: "KHTN 9 · Bài 19",
    directionHint: "Từ kim loại hoạt động mạnh nhất (1) đến yếu nhất (7)",
    explanationVi:
      "Chiều giảm dần mức độ hoạt động hóa học: Potassium (K) > Magnesium (Mg) > Aluminium (Al) > Zinc (Zn) > Iron (Fe) > Copper (Cu) > Silver (Ag).",
    steps: [
      { id: "mr-1", labelEn: "Potassium (K)", labelVi: "Kali (Mạnh nhất)" },
      { id: "mr-2", labelEn: "Magnesium (Mg)", labelVi: "Magnesium" },
      { id: "mr-3", labelEn: "Aluminium (Al)", labelVi: "Nhôm" },
      { id: "mr-4", labelEn: "Zinc (Zn)", labelVi: "Kẽm" },
      { id: "mr-5", labelEn: "Iron (Fe)", labelVi: "Sắt" },
      { id: "mr-6", labelEn: "Copper (Cu)", labelVi: "Đồng (Không đẩy H₂ khỏi acid loãng)" },
      { id: "mr-7", labelEn: "Silver (Ag)", labelVi: "Bạc (Hoạt động rất yếu)" },
    ],
  },
  {
    id: "central_dogma_9",
    grade: 9,
    titleVi: "Truyền đạt thông tin di truyền (Từ DNA tới Tính trạng)",
    titleEn: "Central Dogma of Molecular Biology",
    discipline: "biology",
    lessonRef: "KHTN 9 · Bài 37–38",
    directionHint: "Từ phân tử DNA mang gene (1) tới biểu hiện bên ngoài (5)",
    explanationVi:
      "Dòng thông tin di truyền chuẩn: DNA (Gene) -> Transcription (mRNA) -> Translation (Ribosome) -> Polypeptide / Protein -> Phenotype (Trait).",
    steps: [
      { id: "cd-1", labelEn: "DNA (Gene)", labelVi: "Phân tử DNA (Đoạn gene gốc)" },
      { id: "cd-2", labelEn: "Transcription (mRNA)", labelVi: "Phiên mã tổng hợp mRNA" },
      { id: "cd-3", labelEn: "Translation (Ribosome)", labelVi: "Dịch mã tại Ribosome" },
      { id: "cd-4", labelEn: "Polypeptide / Protein", labelVi: "Chuỗi polypeptide / Protein" },
      { id: "cd-5", labelEn: "Phenotype (Trait)", labelVi: "Biểu hiện thành tính trạng" },
    ],
  },
  {
    id: "visible_spectrum_9",
    grade: 9,
    titleVi: "Phổ ánh sáng nhìn thấy (từ bước sóng dài đến ngắn)",
    titleEn: "Visible Light Spectrum Wavelength Order",
    discipline: "physics",
    lessonRef: "KHTN 9 · Bài 6",
    directionHint: "Từ tia bị khúc xạ ít nhất / bước sóng dài (1) đến ngắn nhất (6)",
    explanationVi:
      "Dải tán sắc qua lăng kính từ đỏ đến tím: Red -> Orange -> Yellow -> Green -> Blue -> Violet.",
    steps: [
      { id: "vs-1", labelEn: "Red", labelVi: "Ánh sáng Đỏ (Bước sóng dài nhất)" },
      { id: "vs-2", labelEn: "Orange", labelVi: "Ánh sáng Cam" },
      { id: "vs-3", labelEn: "Yellow", labelVi: "Ánh sáng Vàng" },
      { id: "vs-4", labelEn: "Green", labelVi: "Ánh sáng Lục" },
      { id: "vs-5", labelEn: "Blue", labelVi: "Ánh sáng Lam" },
      { id: "vs-6", labelEn: "Violet", labelVi: "Ánh sáng Tím (Lệch nhiều nhất)" },
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
  grade?: GradeLevel;
  onRewardRecorded?: () => void;
}

export function SequenceLabGame({ session, grade = 8, onRewardRecorded }: Props) {
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
    if (pack === "current_grade") {
      return SEQUENCE_BANK.filter((s) => s.grade === grade);
    }
    if (pack === "bio_earth") {
      return SEQUENCE_BANK.filter((s) => s.discipline === "biology");
    }
    if (pack === "chem_general") {
      return SEQUENCE_BANK.filter((s) => s.discipline !== "biology");
    }
    return SEQUENCE_BANK;
  }, [pack, grade]);

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

    if (correctRounds >= 4 || (rounds.length > 0 && correctRounds >= rounds.length)) {
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
  }, [phase, correctRounds, rounds.length, totalChecks, maxCombo, pack, session, onRewardRecorded]);

  return (
    <div className="space-y-5">
      {/* SETUP */}
      {phase === "setup" && (
        <section className="rounded-3xl border border-emerald-200 bg-white/95 p-6 shadow-sm sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-extrabold text-emerald-900">
                <ListOrdered className="h-3.5 w-3.5" />
                <span>Mini-Game 3 · Tháp Sắp Xếp Dây Chuyền KHTN 6–9</span>
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900">
                Kéo thả sắp xếp đúng trật tự quy trình Khoa học!
              </h2>
              <p className="text-sm leading-relaxed text-slate-600">
                Xếp các thẻ thuật ngữ từ trên xuống dưới theo đúng trình tự hệ hô hấp, ống tiêu hóa,
                chuỗi thức ăn, 5 giới &amp; phân loại, thang pH Acid–Base chuẩn IUPAC, dãy hoạt động
                kim loại, truyền thông tin DNA → Protein hay phổ ánh sáng. Kéo thả hoặc bấm Lên/Xuống!
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-4 text-center sm:min-w-[230px]">
              <div className="mb-2 flex items-center justify-center gap-2">
                <Icon3D name="microscope" size={30} float />
                <Icon3D name="dna" size={30} />
                <Icon3D name="ringed_planet" size={30} float />
              </div>
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

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                {
                  id: "current_grade" as const,
                  title: `Theo Khối đang chọn: KHTN ${grade}`,
                  desc: "Quy trình & dây chuyền đặc trưng trong SGK khối lớp này",
                },
                {
                  id: "all" as const,
                  title: "Tổng hợp THCS 6–9 (6 vòng)",
                  desc: "Trộn ngẫu nhiên 16 chuỗi Sinh · Hóa IUPAC · Vật lí 6–9",
                },
                {
                  id: "bio_earth" as const,
                  title: "Chuyên sâu Sinh học",
                  desc: "Kính hiển vi, Hô hấp, Tiêu hóa, DNA → Protein & Sinh thái",
                },
                {
                  id: "chem_general" as const,
                  title: "Hóa học IUPAC & Vật lí",
                  desc: "Chuyển thể, Thang pH, Kim loại, Quang phổ & Hệ Mặt Trời",
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
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-indigo-800">
                  Lớp {currentRound.grade}
                </span>
                <span>{currentRound.lessonRef}</span>
              </div>
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
                  ? `Đáp án trình tự chuẩn KHTN ${currentRound.grade}:`
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
          <div className="mx-auto flex justify-center">
            <LottieSticker name="party" fallbackIcon="party_popper" size={76} />
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

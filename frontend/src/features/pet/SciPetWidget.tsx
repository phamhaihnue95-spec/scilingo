import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Bell,
  BellOff,
  Check,
  ChevronDown,
  Crown,
  Heart,
  Lock,
  Minus,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";

import { api } from "../../api/client";
import type {
  AuthSession,
  GradeLevel,
  PetHabitat,
  PetSpecies,
  PetTreatType,
  StudentPetState,
} from "../../api/types";
import { Icon3D, type Icon3DName } from "../../components/visuals/ScienceVisuals";
import { PET_CELEBRATE_EVENT, PET_FOCUS_EVENT, type PetCelebrateDetail } from "../../utils/petEvents";
import { playClickSound, playPetFeedSound, playPetPurrSound } from "../../utils/soundFx";
import { ACCESSORY_ICON_MAP, HABITAT_BG_CLASS, SciPetAvatar } from "./SciPetAvatar";

interface Props {
  session: AuthSession | null;
  grade: GradeLevel;
}

type DrawerTab = "care" | "evolve" | "wardrobe";

interface GuestPetStore {
  species: PetSpecies;
  nickname: string;
  xp: number;
  fedCount: number;
  pettedCount: number;
  equippedAccessory: string | null;
  equippedHabitat: PetHabitat;
  lastFedAt: string | null;
}

const GUEST_STORAGE_KEY = "scilingo_guest_pet_v1";
const COLLAPSED_STORAGE_KEY = "scilingo_pet_collapsed";
const MUTE_BUBBLE_KEY = "scilingo_pet_mute_bubble";

const SPECIES_CARDS: Array<{
  id: PetSpecies;
  nameVi: string;
  defaultNick: string;
  icon: Icon3DName;
  affinity: string;
  desc: string;
}> = [
  {
    id: "owl",
    nameVi: "Cú Quang Học",
    defaultNick: "Lumo",
    icon: "owl",
    affinity: "Vật lí SI",
    desc: "Sáng mắt trong đêm, mê Ánh sáng, Điện học & Vũ trụ.",
  },
  {
    id: "fox",
    nameVi: "Cáo Nguyên Tử",
    defaultNick: "Atom",
    icon: "fox",
    affinity: "Hóa học IUPAC",
    desc: "Nhanh nhẹn pha chế phản ứng & thuộc làu danh pháp TT 32.",
  },
  {
    id: "cat",
    nameVi: "Mèo Sinh Quyển",
    defaultNick: "Neko",
    icon: "cat_face",
    affinity: "Sinh học DNA",
    desc: "Ấm áp dễ thương, khám phá Tế bào, DNA & Hệ sinh thái.",
  },
];

const TREAT_OPTIONS: Array<{
  id: PetTreatType;
  labelVi: string;
  formula: string;
  icon: Icon3DName;
  cls: string;
}> = [
  {
    id: "h2o",
    labelVi: "Giọt H₂O",
    formula: "Pure water",
    icon: "droplet",
    cls: "border-sky-200 bg-sky-50/80 text-sky-900 hover:border-sky-400 hover:bg-sky-100/70",
  },
  {
    id: "glucose",
    labelVi: "Kẹo Glucose",
    formula: "C₆H₁₂O₆",
    icon: "candy",
    cls: "border-rose-200 bg-rose-50/80 text-rose-900 hover:border-rose-400 hover:bg-rose-100/70",
  },
  {
    id: "photon",
    labelVi: "Hạt Photon",
    formula: "h·f Light",
    icon: "high_voltage",
    cls: "border-amber-200 bg-amber-50/80 text-amber-900 hover:border-amber-400 hover:bg-amber-100/70",
  },
];

const EVOLUTION_MILESTONES: Array<{ stage: number; minLevel: number; labelVi: string; preview: string }> = [
  { stage: 1, minLevel: 1, labelVi: "Trứng Năng Lượng", preview: "Ấp năng lượng từ bài đầu tiên" },
  { stage: 2, minLevel: 2, labelVi: "Bé Sơ Sinh", preview: "Nở thành thú cưng chuyển động" },
  { stage: 3, minLevel: 4, labelVi: "Thực Tập Sinh Lab", preview: "Mang kính bảo hộ phòng thí nghiệm" },
  { stage: 4, minLevel: 7, labelVi: "Nhà Thám Hiểm KHTN", preview: "Vòng quỹ đạo nguyên tử xoay quanh" },
  { stage: 5, minLevel: 10, labelVi: "Giáo Sư Huyền Thoại", preview: "Vương miện vàng & hào quang" },
];

const GRADE_MICRO_TIPS: Record<GradeLevel, string[]> = {
  6: [
    "Khối 6: Độ dài chuẩn SI đo bằng meter (m), khối lượng bằng kilogram (kg)!",
    "Tổ chức cơ thể đa bào: Cell -> Tissue -> Organ -> Organ system -> Organism.",
  ],
  7: [
    "Khối 7: Nguyên tử gồm hạt nhân (proton +, neutron 0) và lớp vỏ electron (-)!",
    "Thực vật quang hợp hấp thụ CO₂ + H₂O để tạo Glucose và khí Oxygen.",
  ],
  8: [
    "Khối 8 IUPAC: Dùng Hydrochloric acid, Sodium hydroxide — không dùng axit hay hiđroxit!",
    "Áp suất p = F / S đo bằng đơn vị Pascal (Pa = N/m²) nhé!",
  ],
  9: [
    "Khối 9 Hữu cơ IUPAC: ethanol, acetic acid, methane, ethylene, glucose!",
    "Dòng thông tin di truyền chuẩn: DNA -> mRNA -> Polypeptide -> Protein.",
  ],
};

function getStageMeta(level: number): {
  stage: number;
  labelVi: string;
  labelEn: string;
  nextEvoLevel: number | null;
} {
  if (level >= 10) return { stage: 5, labelVi: "Giáo Sư Huyền Thoại", labelEn: "Legendary Professor", nextEvoLevel: null };
  if (level >= 7) return { stage: 4, labelVi: "Nhà Thám Hiểm KHTN", labelEn: "Science Explorer", nextEvoLevel: 10 };
  if (level >= 4) return { stage: 3, labelVi: "Thực Tập Sinh Lab", labelEn: "Lab Apprentice", nextEvoLevel: 7 };
  if (level >= 2) return { stage: 2, labelVi: "Bé Sơ Sinh", labelEn: "Hatchling", nextEvoLevel: 4 };
  return { stage: 1, labelVi: "Trứng Năng Lượng", labelEn: "Energy Egg", nextEvoLevel: 2 };
}

function readGuestStore(): GuestPetStore {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GuestPetStore>;
      return {
        species: parsed.species === "fox" || parsed.species === "cat" ? parsed.species : "owl",
        nickname: parsed.nickname || "Lumo",
        xp: Math.max(0, Number(parsed.xp || 0)),
        fedCount: Math.max(0, Number(parsed.fedCount || 0)),
        pettedCount: Math.max(0, Number(parsed.pettedCount || 0)),
        equippedAccessory: parsed.equippedAccessory ?? null,
        equippedHabitat:
          parsed.equippedHabitat === "forest" ||
          parsed.equippedHabitat === "cosmos" ||
          parsed.equippedHabitat === "atom"
            ? parsed.equippedHabitat
            : "lab",
        lastFedAt: parsed.lastFedAt ?? null,
      };
    }
  } catch {
    // Ignore invalid storage
  }
  return {
    species: "owl",
    nickname: "Lumo",
    xp: 0,
    fedCount: 0,
    pettedCount: 0,
    equippedAccessory: null,
    equippedHabitat: "lab",
    lastFedAt: null,
  };
}

function saveGuestStore(store: GuestPetStore): void {
  try {
    localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota issues
  }
}

function buildGuestPetState(store: GuestPetStore): StudentPetState {
  const level = Math.floor(store.xp / 100) + 1;
  const xpToNext = level * 100 - store.xp;
  const stageMeta = getStageMeta(level);
  const speciesInfo = SPECIES_CARDS.find((c) => c.id === store.species) ?? SPECIES_CARDS[0];

  const totalTreats = 2 + Math.floor(store.xp / 25);
  const availableTreats = Math.max(0, totalTreats - store.fedCount);
  const energy = Math.min(100, 65 + (store.lastFedAt ? 20 : 0) + Math.min(15, store.pettedCount * 3));
  const mood = energy >= 85 ? "ecstatic" : energy >= 55 ? "happy" : "sleepy";

  const accessoriesCatalog = [
    { id: "goggles", name_vi: "Kính bảo hộ Lab", icon: "goggles", unlock_hint_vi: "Đạt Level 2 hoặc ≥ 50 XP", unlocked: level >= 2 || store.xp >= 50 },
    { id: "test_tube", name_vi: "Ống nghiệm IUPAC", icon: "test_tube", unlock_hint_vi: "Đạt Level 2 hoặc chơi Hóa IUPAC", unlocked: level >= 2 },
    { id: "magnet", name_vi: "Nam châm Vật lí", icon: "magnet", unlock_hint_vi: "Đạt Level 2 hoặc chơi Vật lí", unlocked: level >= 2 },
    { id: "seedling", name_vi: "Mầm cây Sinh học", icon: "seedling", unlock_hint_vi: "Đạt Level 2 hoặc chơi Sinh học", unlocked: level >= 2 },
    { id: "fire", name_vi: "Ngọn lửa Streak", icon: "fire", unlock_hint_vi: "Đăng nhập & giữ Streak ≥ 3 ngày", unlocked: level >= 3 },
    { id: "graduation_cap", name_vi: "Mũ Học giả CLIL", icon: "graduation_cap", unlock_hint_vi: "Đạt Level 4 (Thực Tập Sinh)", unlocked: level >= 4 },
    { id: "dna", name_vi: "Vòng xoắn DNA", icon: "dna", unlock_hint_vi: "Đạt Level 5", unlocked: level >= 5 },
    { id: "crown", name_vi: "Vương miện Quán quân", icon: "crown", unlock_hint_vi: "Đạt Level 7", unlocked: level >= 7 },
  ];
  const habitatsCatalog = [
    { id: "lab", name_vi: "Bàn Thí Nghiệm", icon: "alembic", unlock_hint_vi: "Mở khóa mặc định ngay từ đầu", unlocked: true },
    { id: "forest", name_vi: "Rừng Sinh Quyển", icon: "herb", unlock_hint_vi: "Đạt Level 2", unlocked: level >= 2 },
    { id: "cosmos", name_vi: "Quỹ Đạo Vũ Trụ", icon: "ringed_planet", unlock_hint_vi: "Đạt Level 3", unlocked: level >= 3 },
    { id: "atom", name_vi: "Lõi Nguyên Tử", icon: "atom", unlock_hint_vi: "Đạt Level 5", unlocked: level >= 5 },
  ];

  const unlockedAcc = accessoriesCatalog.filter((a) => a.unlocked).map((a) => a.id);
  const unlockedHab = habitatsCatalog.filter((h) => h.unlocked).map((h) => h.id);

  return {
    student_id: "guest",
    species: store.species,
    species_name_vi: speciesInfo.nameVi,
    nickname: store.nickname,
    level,
    total_xp: store.xp,
    current_streak: 0,
    stage: stageMeta.stage,
    stage_label_vi: stageMeta.labelVi,
    stage_label_en: stageMeta.labelEn,
    next_evolution_level: stageMeta.nextEvoLevel,
    xp_to_next_level: xpToNext,
    energy,
    mood,
    treat_points_available: availableTreats,
    total_treats_earned: totalTreats,
    fed_count: store.fedCount,
    petted_count: store.pettedCount,
    equipped_accessory:
      store.equippedAccessory && unlockedAcc.includes(store.equippedAccessory)
        ? store.equippedAccessory
        : null,
    equipped_habitat: unlockedHab.includes(store.equippedHabitat)
      ? store.equippedHabitat
      : "lab",
    unlocked_accessories: unlockedAcc,
    unlocked_habitats: unlockedHab,
    accessories_catalog: accessoriesCatalog,
    habitats_catalog: habitatsCatalog,
    last_fed_at: store.lastFedAt,
  };
}

export function SciPetWidget({ session, grade }: Props) {
  const reduced = useReducedMotion();
  const [guestStore, setGuestStore] = useState<GuestPetStore>(() => readGuestStore());
  const [authPet, setAuthPet] = useState<StudentPetState | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("care");
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [bubbleMuted, setBubbleMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MUTE_BUBBLE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [focusHidden, setFocusHidden] = useState(false);

  const [celebrating, setCelebrating] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [bubble, setBubble] = useState<{ vi: string; en?: string } | null>(null);
  const [reaction, setReaction] = useState<{ vi: string; en: string }>({
    vi: "Chào cậu! Bấm xoa đầu hoặc cho tớ ăn Hạt Năng Lượng để lớn nhanh cùng KHTN nhé!",
    en: "Hi there! Pet or feed me Science Treats as we level up together!",
  });

  const [nicknameInput, setNicknameInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [patBurstKey, setPatBurstKey] = useState(0);

  const idleTimerRef = useRef<number | null>(null);
  const bubbleTimerRef = useRef<number | null>(null);
  const celebTimerRef = useRef<number | null>(null);

  const pet: StudentPetState = session
    ? (authPet ?? buildGuestPetState(guestStore))
    : buildGuestPetState(guestStore);

  const resetIdleTimer = useCallback(() => {
    setSleeping(false);
    if (idleTimerRef.current !== null) {
      globalThis.clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = globalThis.setTimeout(() => {
      setSleeping(true);
    }, 45000);
  }, []);

  const showBubbleMessage = useCallback((vi: string, en?: string, durationMs = 5200) => {
    setBubble({ vi, en });
    if (bubbleTimerRef.current !== null) {
      globalThis.clearTimeout(bubbleTimerRef.current);
    }
    bubbleTimerRef.current = globalThis.setTimeout(() => {
      setBubble(null);
    }, durationMs);
  }, []);

  const triggerCelebration = useCallback(
    (vi: string, en?: string) => {
      resetIdleTimer();
      setCelebrating(true);
      showBubbleMessage(vi, en, 5600);
      if (celebTimerRef.current !== null) {
        globalThis.clearTimeout(celebTimerRef.current);
      }
      celebTimerRef.current = globalThis.setTimeout(() => {
        setCelebrating(false);
      }, 3600);
    },
    [resetIdleTimer, showBubbleMessage]
  );

  // Initial load + auth session sync
  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimerRef.current !== null) globalThis.clearTimeout(idleTimerRef.current);
      if (bubbleTimerRef.current !== null) globalThis.clearTimeout(bubbleTimerRef.current);
      if (celebTimerRef.current !== null) globalThis.clearTimeout(celebTimerRef.current);
    };
  }, [resetIdleTimer]);

  const refreshAuthPet = useCallback(() => {
    if (!session) {
      setAuthPet(null);
      return;
    }
    api
      .getMyPet()
      .then((data) => {
        setAuthPet(data);
        setNicknameInput(data.nickname);
      })
      .catch(() => {
        // Keep cached pet if offline
      });
  }, [session]);

  useEffect(() => {
    refreshAuthPet();
    if (!session) {
      setNicknameInput(guestStore.nickname);
    }
  }, [refreshAuthPet, session, guestStore.nickname]);

  // Listen to global learning celebrations & focus-mode hide events
  useEffect(() => {
    const onCelebrate = (evt: Event) => {
      const detail = (evt as CustomEvent<PetCelebrateDetail>).detail ?? { source: "quiz" };
      const msg =
        detail.messageVi ??
        `Tuyệt vời! Nhận +${detail.xpEarned ?? 10} XP — thú cưng đang ăn mừng cùng cậu!`;
      triggerCelebration(msg, "Awesome progress!");

      if (session) {
        refreshAuthPet();
      } else if (detail.xpEarned && detail.xpEarned > 0) {
        setGuestStore((prev) => {
          const next = { ...prev, xp: prev.xp + (detail.xpEarned ?? 0) };
          saveGuestStore(next);
          return next;
        });
      }
    };

    const onFocusMode = (evt: Event) => {
      const hidden = Boolean((evt as CustomEvent<boolean>).detail);
      setFocusHidden(hidden);
      if (hidden) {
        setDrawerOpen(false);
      }
    };

    window.addEventListener(PET_CELEBRATE_EVENT, onCelebrate);
    window.addEventListener(PET_FOCUS_EVENT, onFocusMode);
    return () => {
      window.removeEventListener(PET_CELEBRATE_EVENT, onCelebrate);
      window.removeEventListener(PET_FOCUS_EVENT, onFocusMode);
    };
  }, [session, refreshAuthPet, triggerCelebration]);

  // Subtle bilingual micro-tip when grade changes (only if bubble unmuted)
  const prevGradeRef = useRef<GradeLevel>(grade);
  useEffect(() => {
    if (prevGradeRef.current !== grade) {
      prevGradeRef.current = grade;
      if (!bubbleMuted && !focusHidden && !collapsed) {
        const tips = GRADE_MICRO_TIPS[grade];
        showBubbleMessage(tips[0], undefined, 4800);
      }
    }
  }, [grade, bubbleMuted, focusHidden, collapsed, showBubbleMessage]);

  const toggleCollapsed = () => {
    playClickSound();
    resetIdleTimer();
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const toggleBubbleMute = () => {
    playClickSound();
    setBubbleMuted((prev) => {
      const next = !prev;
      if (next) setBubble(null);
      try {
        localStorage.setItem(MUTE_BUBBLE_KEY, next ? "1" : "0");
      } catch {
        // Ignore storage error
      }
      return next;
    });
  };

  const handlePat = async () => {
    resetIdleTimer();
    playPetPurrSound();
    setPatBurstKey((k) => k + 1);
    setErrorMsg(null);

    if (session) {
      setBusy(true);
      try {
        const res = await api.petMyPet();
        setAuthPet(res.pet);
        setReaction({ vi: res.reaction_vi, en: res.reaction_en });
        triggerCelebration(res.reaction_vi, res.reaction_en);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Không thể tương tác với SciPet.");
      } finally {
        setBusy(false);
      }
      return;
    }

    const updatedStore: GuestPetStore = {
      ...guestStore,
      pettedCount: guestStore.pettedCount + 1,
    };
    setGuestStore(updatedStore);
    saveGuestStore(updatedStore);
    const vi = `${updatedStore.nickname} rất thích được cậu xoa đầu! Cùng học KHTN ${grade} nha!`;
    const en = `${updatedStore.nickname} loves head pats! Let's conquer Grade ${grade} Science!`;
    setReaction({ vi, en });
    triggerCelebration(vi, en);
  };

  const handleFeed = async (treat: PetTreatType) => {
    resetIdleTimer();
    setErrorMsg(null);
    if (pet.treat_points_available <= 0) {
      setErrorMsg("Bạn đã dùng hết Hạt Năng Lượng. Ôn Flashcard/Quiz để nhận thêm nhé!");
      return;
    }

    playPetFeedSound();
    if (session) {
      setBusy(true);
      try {
        const res = await api.feedMyPet(treat);
        setAuthPet(res.pet);
        setReaction({ vi: res.reaction_vi, en: res.reaction_en });
        triggerCelebration(res.reaction_vi, res.reaction_en);
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Không thể cho thú cưng ăn.");
      } finally {
        setBusy(false);
      }
      return;
    }

    const nextStore: GuestPetStore = {
      ...guestStore,
      fedCount: guestStore.fedCount + 1,
      lastFedAt: new Date().toISOString(),
    };
    setGuestStore(nextStore);
    saveGuestStore(nextStore);
    const treatLabel = TREAT_OPTIONS.find((t) => t.id === treat)?.labelVi ?? treat;
    const vi = `Măm măm! ${nextStore.nickname} vừa thưởng thức ${treatLabel} ngon lành!`;
    const en = `Yum! ${nextStore.nickname} enjoyed a ${treat.toUpperCase()} science snack!`;
    setReaction({ vi, en });
    triggerCelebration(vi, en);
  };

  const handleUpdatePet = async (patch: {
    species?: PetSpecies;
    nickname?: string;
    equipped_accessory?: string | null;
    clear_accessory?: boolean;
    equipped_habitat?: PetHabitat;
  }) => {
    resetIdleTimer();
    playClickSound();
    setErrorMsg(null);

    if (session) {
      setBusy(true);
      try {
        const updated = await api.updateMyPet(patch);
        setAuthPet(updated);
        setNicknameInput(updated.nickname);
        triggerCelebration(
          `Đã cập nhật cho ${updated.nickname} (${updated.species_name_vi})!`,
          "SciPet updated!"
        );
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Không thể cập nhật thú cưng.");
      } finally {
        setBusy(false);
      }
      return;
    }

    setGuestStore((prev) => {
      const next: GuestPetStore = { ...prev };
      if (patch.species) {
        const defaults = new Set(SPECIES_CARDS.map((c) => c.defaultNick));
        if (!patch.nickname && defaults.has(prev.nickname)) {
          next.nickname = SPECIES_CARDS.find((c) => c.id === patch.species)?.defaultNick ?? "Lumo";
        }
        next.species = patch.species;
      }
      if (patch.nickname !== undefined) {
        next.nickname = patch.nickname.trim().slice(0, 24) || prev.nickname;
      }
      if (patch.clear_accessory) {
        next.equippedAccessory = null;
      } else if (patch.equipped_accessory !== undefined) {
        next.equippedAccessory = patch.equipped_accessory;
      }
      if (patch.equipped_habitat) {
        next.equippedHabitat = patch.equipped_habitat;
      }
      saveGuestStore(next);
      setNicknameInput(next.nickname);
      return next;
    });
  };

  if (focusHidden) {
    return null;
  }

  const xpIntoLevel = pet.total_xp % 100;

  return (
    <div className="pointer-events-none fixed bottom-3 right-3 z-40 flex flex-col items-end gap-2 sm:bottom-5 sm:right-5">
      <AnimatePresence>
        {drawerOpen && (
          <motion.section
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.95 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 360, damping: 28 }}
            className="pointer-events-auto flex max-h-[82vh] w-[calc(100vw-24px)] max-w-[410px] flex-col overflow-hidden rounded-3xl border-2 border-indigo-200 bg-white shadow-2xl"
            aria-label="Nhà của SciPet"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-indigo-600 via-sky-500 to-teal-500 px-4 py-3 text-white">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>SciPet Đồng Hành · KHTN 6–9</span>
                </div>
                <h2 className="truncate text-base font-extrabold">
                  {pet.nickname} · {pet.species_name_vi}
                </h2>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={toggleBubbleMute}
                  title={bubbleMuted ? "Bật bong bóng nhắc học" : "Tắt bong bóng nhắc học"}
                  aria-label={bubbleMuted ? "Bật bong bóng nhắc học" : "Tắt bong bóng nhắc học"}
                  className="rounded-xl bg-white/20 p-1.5 text-white hover:bg-white/30"
                >
                  {bubbleMuted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Thu gọn Nhà của SciPet"
                  className="rounded-xl bg-white/20 p-1.5 text-white hover:bg-white/30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Interactive Habitat Stage */}
            <div className={`relative border-b px-4 py-3.5 ${HABITAT_BG_CLASS[pet.equipped_habitat]}`}>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handlePat()}
                  title="Bấm để xoa đầu thú cưng!"
                  className="group relative shrink-0 rounded-full focus:outline-none"
                >
                  <SciPetAvatar
                    species={pet.species}
                    stage={pet.stage}
                    mood={pet.mood}
                    accessory={pet.equipped_accessory}
                    habitat={pet.equipped_habitat}
                    size="lg"
                    celebrating={celebrating}
                    sleeping={sleeping}
                  />
                  <AnimatePresence>
                    {patBurstKey > 0 && (
                      <motion.span
                        key={patBurstKey}
                        initial={{ opacity: 1, y: 0, scale: 0.7 }}
                        animate={{ opacity: 0, y: -28, scale: 1.25 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.75 }}
                        className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white shadow"
                      >
                        +1 ❤️
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-extrabold text-indigo-800 shadow-sm">
                      Lv.{pet.level} · Giai đoạn {pet.stage}/5
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${
                        pet.equipped_habitat === "cosmos"
                          ? "bg-white/20 text-amber-200"
                          : "bg-white/85 text-slate-700"
                      }`}
                    >
                      {pet.stage_label_vi}
                    </span>
                  </div>

                  {/* Energy bar */}
                  <div>
                    <div
                      className={`flex justify-between text-[11px] font-bold ${
                        pet.equipped_habitat === "cosmos" ? "text-sky-100" : "text-slate-700"
                      }`}
                    >
                      <span>Năng lượng ({pet.mood === "ecstatic" ? "Hào hứng" : pet.mood === "happy" ? "Vui vẻ" : "Ngủ gật"})</span>
                      <span>{pet.energy}%</span>
                    </div>
                    <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-black/15">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-300"
                        style={{ width: `${pet.energy}%` }}
                      />
                    </div>
                  </div>

                  {/* XP / Evolution bar */}
                  <div>
                    <div
                      className={`flex justify-between text-[11px] font-bold ${
                        pet.equipped_habitat === "cosmos" ? "text-amber-100" : "text-slate-700"
                      }`}
                    >
                      <span>{pet.total_xp} XP</span>
                      <span>
                        {pet.next_evolution_level
                          ? `Tiến hóa ở Lv.${pet.next_evolution_level}`
                          : "Đạt cấp tối đa!"}
                      </span>
                    </div>
                    <div className="mt-0.5 h-2 w-full overflow-hidden rounded-full bg-black/15">
                      <div
                        className="xp-liquid-bar h-full rounded-full bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 transition-all duration-300"
                        style={{ width: `${Math.max(8, xpIntoLevel)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bilingual reaction strip */}
              <div className="mt-3 rounded-2xl border border-white/60 bg-white/90 px-3 py-2 text-xs shadow-sm backdrop-blur-sm">
                <div className="font-bold text-slate-800">{reaction.vi}</div>
                <div className="mt-0.5 italic text-sky-800">{reaction.en}</div>
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="grid grid-cols-3 gap-1 border-b border-slate-100 bg-slate-50/70 p-1.5 text-xs font-extrabold">
              {(
                [
                  { id: "care" as const, label: "Chăm sóc" },
                  { id: "evolve" as const, label: "Tiến hóa & Loài" },
                  { id: "wardrobe" as const, label: "Tủ đồ & Đảo" },
                ] as const
              ).map((t) => {
                const active = drawerTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      playClickSound();
                      setDrawerTab(t.id);
                    }}
                    className={`relative rounded-xl py-1.5 transition-colors ${
                      active ? "text-white" : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="scipet-drawer-tab"
                        transition={{ type: "spring", stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-600 to-sky-500 shadow-sm"
                      />
                    )}
                    <span className="relative z-10">{t.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Scrollable Drawer Body */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              {errorMsg && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  {errorMsg}
                </div>
              )}

              {/* TAB 1: CARE & FEED */}
              {drawerTab === "care" && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 rounded-2xl border border-pink-200 bg-pink-50/60 p-3">
                    <div>
                      <div className="text-xs font-extrabold text-pink-900">
                        Âu yếm &amp; Khích lệ ({pet.petted_count} lần)
                      </div>
                      <div className="text-[11px] text-pink-700">
                        Chạm nhẹ để pet vui vẻ nhận thêm +8 năng lượng
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handlePat()}
                      className="btn-tactile inline-flex shrink-0 items-center gap-1.5 rounded-xl border-rose-700 bg-gradient-to-r from-rose-500 to-pink-500 px-3.5 py-2 text-xs font-extrabold text-white shadow disabled:opacity-50"
                    >
                      <Heart className="h-3.5 w-3.5 fill-white" />
                      Xoa đầu
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase text-slate-600">
                        Cho ăn Hạt Năng Lượng Khoa học
                      </span>
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-extrabold text-amber-900">
                        Còn {pet.treat_points_available} hạt
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {TREAT_OPTIONS.map((treat) => (
                        <button
                          key={treat.id}
                          type="button"
                          disabled={busy || pet.treat_points_available <= 0}
                          onClick={() => void handleFeed(treat.id)}
                          className={`flex flex-col items-center rounded-2xl border p-2.5 text-center transition disabled:opacity-45 ${treat.cls}`}
                        >
                          <Icon3D name={treat.icon} size={28} />
                          <span className="mt-1 text-xs font-extrabold">{treat.labelVi}</span>
                          <span className="formula-pill text-[10px] opacity-80">{treat.formula}</span>
                        </button>
                      ))}
                    </div>

                    <p className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                      Mẹo nhận thêm Hạt: Hoàn thành Flashcard SRS hoặc mỗi <strong>+25 XP</strong>{" "}
                      Quiz/Mini-Game sẽ tặng 1 Hạt Năng Lượng! ({pet.nickname} không bao giờ bị ốm hay mất cấp khi bạn nghỉ học).
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 2: SPECIES & EVOLUTION */}
              {drawerTab === "evolve" && (
                <div className="space-y-4">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (nicknameInput.trim()) {
                        void handleUpdatePet({ nickname: nicknameInput.trim() });
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <div className="relative flex-1">
                      <Pencil className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type="text"
                        maxLength={24}
                        value={nicknameInput}
                        onChange={(e) => setNicknameInput(e.target.value)}
                        placeholder="Đặt tên cho SciPet..."
                        className="w-full rounded-xl border border-slate-300 py-1.5 pl-8 pr-3 text-xs font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={busy || !nicknameInput.trim()}
                      className="rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-extrabold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      Lưu tên
                    </button>
                  </form>

                  <div className="space-y-2">
                    <div className="text-xs font-extrabold uppercase text-slate-500">
                      Chọn dòng Thú Khoa học (3 loài)
                    </div>
                    <div className="space-y-2">
                      {SPECIES_CARDS.map((sp) => {
                        const chosen = pet.species === sp.id;
                        return (
                          <button
                            key={sp.id}
                            type="button"
                            disabled={busy}
                            onClick={() => void handleUpdatePet({ species: sp.id })}
                            className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition ${
                              chosen
                                ? "border-indigo-500 bg-indigo-50/70 ring-2 ring-indigo-200"
                                : "border-slate-200 bg-white hover:border-sky-300"
                            }`}
                          >
                            <Icon3D name={sp.icon} size={34} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-extrabold text-slate-900">
                                  {sp.nameVi}
                                </span>
                                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-bold text-sky-800">
                                  {sp.affinity}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-slate-600">{sp.desc}</p>
                            </div>
                            {chosen && <Check className="h-4 w-4 shrink-0 text-indigo-600" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-extrabold uppercase text-slate-500">
                      Lộ trình 5 Cấp Tiến Hóa theo Level
                    </div>
                    <div className="space-y-1.5">
                      {EVOLUTION_MILESTONES.map((m) => {
                        const reached = pet.level >= m.minLevel;
                        const isCurrent = pet.stage === m.stage;
                        return (
                          <div
                            key={m.stage}
                            className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs ${
                              isCurrent
                                ? "border-amber-400 bg-amber-50/80 font-bold text-amber-950"
                                : reached
                                  ? "border-emerald-200 bg-emerald-50/50 text-emerald-900"
                                  : "border-slate-200 bg-slate-50/70 text-slate-500"
                            }`}
                          >
                            <div>
                              <div>
                                GĐ {m.stage}: {m.labelVi}
                              </div>
                              <div className="text-[10px] font-normal opacity-85">{m.preview}</div>
                            </div>
                            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black shadow-sm">
                              {reached ? `✓ Lv.${m.minLevel}+` : `Lv.${m.minLevel}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: WARDROBE & HABITATS */}
              {drawerTab === "wardrobe" && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold uppercase text-slate-500">
                        Phụ kiện Khoa học ({pet.unlocked_accessories.length}/{pet.accessories_catalog.length})
                      </span>
                      {pet.equipped_accessory && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleUpdatePet({ clear_accessory: true })}
                          className="text-[11px] font-bold text-rose-600 hover:underline"
                        >
                          Tháo phụ kiện
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {pet.accessories_catalog.map((acc) => {
                        const equipped = pet.equipped_accessory === acc.id;
                        const iconName = ACCESSORY_ICON_MAP[acc.id] ?? "sparkles";
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            disabled={busy || !acc.unlocked}
                            onClick={() =>
                              void handleUpdatePet(
                                equipped
                                  ? { clear_accessory: true }
                                  : { equipped_accessory: acc.id }
                              )
                            }
                            className={`flex items-start gap-2 rounded-2xl border p-2.5 text-left transition ${
                              equipped
                                ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200"
                                : acc.unlocked
                                  ? "border-slate-200 bg-white hover:border-indigo-300"
                                  : "cursor-not-allowed border-slate-200 bg-slate-100/75 opacity-70"
                            }`}
                          >
                            <Icon3D
                              name={iconName}
                              size={26}
                              className={acc.unlocked ? "" : "opacity-50 grayscale"}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-extrabold text-slate-900">
                                {acc.name_vi}
                              </div>
                              <div className="mt-0.5 text-[10px] leading-tight text-slate-500">
                                {equipped
                                  ? "Đang đeo (bấm để tháo)"
                                  : acc.unlocked
                                    ? "Đã mở khóa — Bấm để đeo"
                                    : acc.unlock_hint_vi}
                              </div>
                            </div>
                            {!acc.unlocked && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-extrabold uppercase text-slate-500">
                      Không gian Đảo Sống ({pet.unlocked_habitats.length}/{pet.habitats_catalog.length})
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {pet.habitats_catalog.map((hab) => {
                        const equipped = pet.equipped_habitat === hab.id;
                        const iconName = (hab.icon as Icon3DName) || "alembic";
                        return (
                          <button
                            key={hab.id}
                            type="button"
                            disabled={busy || !hab.unlocked}
                            onClick={() =>
                              void handleUpdatePet({ equipped_habitat: hab.id as PetHabitat })
                            }
                            className={`flex items-start gap-2 rounded-2xl border p-2.5 text-left transition ${
                              equipped
                                ? "border-teal-500 bg-teal-50 ring-2 ring-teal-200"
                                : hab.unlocked
                                  ? "border-slate-200 bg-white hover:border-teal-300"
                                  : "cursor-not-allowed border-slate-200 bg-slate-100/75 opacity-70"
                            }`}
                          >
                            <Icon3D
                              name={iconName}
                              size={26}
                              className={hab.unlocked ? "" : "opacity-50 grayscale"}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-extrabold text-slate-900">
                                {hab.name_vi}
                              </div>
                              <div className="mt-0.5 text-[10px] leading-tight text-slate-500">
                                {equipped ? "Đang chọn" : hab.unlocked ? "Bấm để đổi" : hab.unlock_hint_vi}
                              </div>
                            </div>
                            {!hab.unlocked && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {!session && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-900">
                  <Crown className="mr-1 inline h-3.5 w-3.5 text-amber-600" />
                  Đang nuôi thử ở chế độ Khách. Đăng nhập tài khoản học sinh để đồng bộ SciPet và hiện
                  cùng tên trên <strong>Bảng Vàng Thi Đua Lớp</strong>!
                </div>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Auto-fading Bilingual Speech Bubble */}
      <AnimatePresence>
        {!drawerOpen && !collapsed && !bubbleMuted && bubble && (
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.94 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6 }}
            className="pointer-events-auto relative max-w-[250px] rounded-2xl border border-indigo-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md"
          >
            <button
              type="button"
              onClick={() => setBubble(null)}
              aria-label="Đóng tin nhắn thú cưng"
              className="absolute right-1.5 top-1.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="pr-4 font-bold leading-snug text-slate-800">{bubble.vi}</div>
            {bubble.en && (
              <div className="mt-0.5 pr-3 text-[11px] italic text-sky-700">{bubble.en}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Corner Dock: Collapsed Mini-Pill OR Expanded Habitat Island */}
      {collapsed && !drawerOpen ? (
        <motion.button
          type="button"
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => {
            toggleCollapsed();
            setDrawerOpen(true);
          }}
          aria-label="Mở SciPet"
          title={`${pet.nickname} (Lv.${pet.level}) — Bấm để mở`}
          className="pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-indigo-300 bg-white/95 shadow-xl backdrop-blur-md"
        >
          <SciPetAvatar
            species={pet.species}
            stage={pet.stage}
            accessory={pet.equipped_accessory}
            habitat={pet.equipped_habitat}
            size="xs"
            animated={false}
          />
          <span className="absolute -bottom-1 -right-1 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-black text-white shadow">
            {pet.level}
          </span>
        </motion.button>
      ) : (
        !drawerOpen && (
          <motion.div
            initial={reduced ? undefined : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="pointer-events-auto flex flex-col items-center rounded-3xl border-2 border-indigo-200/90 bg-white/92 p-2 shadow-xl backdrop-blur-md"
          >
            <div className="mb-1 flex w-full items-center justify-between gap-2 px-1">
              <span className="max-w-[68px] truncate text-[10px] font-extrabold text-indigo-800">
                {pet.nickname} · L{pet.level}
              </span>
              <button
                type="button"
                onClick={toggleCollapsed}
                title="Thu nhỏ xuống góc"
                aria-label="Thu nhỏ SciPet xuống góc"
                className="rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Minus className="h-3 w-3" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                playClickSound();
                resetIdleTimer();
                setDrawerOpen(true);
              }}
              aria-label={`Mở Nhà của ${pet.nickname}`}
              className="group relative rounded-full p-0.5 transition hover:scale-105 focus:outline-none"
            >
              <SciPetAvatar
                species={pet.species}
                stage={pet.stage}
                mood={pet.mood}
                accessory={pet.equipped_accessory}
                habitat={pet.equipped_habitat}
                size="md"
                celebrating={celebrating}
                sleeping={sleeping}
              />
            </button>

            <div className="mt-1.5 flex w-full items-center justify-between gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handlePat()}
                title="Xoa đầu SciPet"
                className="inline-flex flex-1 items-center justify-center gap-0.5 rounded-xl bg-rose-50 px-1.5 py-1 text-[10px] font-extrabold text-rose-600 hover:bg-rose-100"
              >
                <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                <span>Yêu</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  playClickSound();
                  setDrawerTab("care");
                  setDrawerOpen(true);
                }}
                title={`Có ${pet.treat_points_available} Hạt Năng Lượng`}
                className="inline-flex items-center gap-0.5 rounded-xl bg-amber-50 px-1.5 py-1 text-[10px] font-extrabold text-amber-800 hover:bg-amber-100"
              >
                <span>🍬{pet.treat_points_available}</span>
              </button>
            </div>
          </motion.div>
        )
      )}
    </div>
  );
}

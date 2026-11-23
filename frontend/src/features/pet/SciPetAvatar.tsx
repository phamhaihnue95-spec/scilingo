import { motion, useReducedMotion } from "framer-motion";

import type { PetHabitat, PetMood, PetSpecies } from "../../api/types";
import { Icon3D, LottieSticker, type Icon3DName, type LottieName } from "../../components/visuals/ScienceVisuals";

export type PetAvatarSize = "xs" | "sm" | "md" | "lg";

interface Props {
  species: PetSpecies | string;
  stage: number;
  mood?: PetMood;
  accessory?: string | null;
  habitat?: PetHabitat;
  size?: PetAvatarSize;
  animated?: boolean;
  celebrating?: boolean;
  sleeping?: boolean;
}

const SIZE_PX: Record<PetAvatarSize, number> = {
  xs: 26,
  sm: 36,
  md: 54,
  lg: 84,
};

const SPECIES_VISUALS: Record<
  PetSpecies,
  { lottie: LottieName; celebratingLottie?: LottieName; icon: Icon3DName; ringGrad: string }
> = {
  owl: {
    lottie: "owl",
    icon: "owl",
    ringGrad: "from-sky-400/25 via-indigo-400/20 to-amber-300/25",
  },
  fox: {
    lottie: "fox",
    icon: "fox",
    ringGrad: "from-orange-400/25 via-rose-400/20 to-amber-300/25",
  },
  cat: {
    lottie: "cat_face",
    celebratingLottie: "cat_heart_eyes",
    icon: "cat_face",
    ringGrad: "from-emerald-400/25 via-teal-400/20 to-sky-300/25",
  },
};

export const ACCESSORY_ICON_MAP: Record<string, Icon3DName> = {
  goggles: "goggles",
  test_tube: "test_tube",
  magnet: "magnet",
  seedling: "seedling",
  fire: "fire",
  graduation_cap: "graduation_cap",
  dna: "dna",
  crown: "crown",
};

export const HABITAT_BG_CLASS: Record<PetHabitat, string> = {
  lab: "bg-gradient-to-br from-sky-100 via-indigo-50 to-cyan-100 border-sky-200",
  forest: "bg-gradient-to-br from-emerald-100 via-teal-50 to-lime-100 border-emerald-200",
  cosmos: "bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 border-indigo-400/50",
  atom: "bg-gradient-to-br from-amber-100 via-orange-50 to-fuchsia-100 border-amber-300",
};

export function SciPetAvatar({
  species,
  stage,
  mood = "happy",
  accessory,
  habitat = "lab",
  size = "md",
  animated = true,
  celebrating = false,
  sleeping = false,
}: Props) {
  const reduced = useReducedMotion();
  const safeSpecies: PetSpecies =
    species === "fox" || species === "cat" || species === "owl" ? species : "owl";
  const visual = SPECIES_VISUALS[safeSpecies];
  const px = SIZE_PX[size];
  const isCompact = size === "xs" || size === "sm";
  const shouldMotion = animated && !reduced;

  const accessoryIcon = accessory ? ACCESSORY_ICON_MAP[accessory] : undefined;
  const activeLottie: LottieName =
    celebrating && visual.celebratingLottie ? visual.celebratingLottie : visual.lottie;

  const boxSize = Math.round(px * 1.24);
  const accPx = Math.max(14, Math.round(px * 0.4));

  const bodyContent =
    stage <= 1 ? (
      <motion.div
        animate={
          shouldMotion
            ? celebrating
              ? { y: [0, -10, 0, -7, 0], rotate: [-8, 8, -8, 6, 0] }
              : { rotate: [-5, 5, -4, 4, 0], y: [0, -2, 0] }
            : undefined
        }
        transition={{
          duration: celebrating ? 0.9 : 2.8,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <Icon3D name="egg" size={px} />
      </motion.div>
    ) : !isCompact && shouldMotion ? (
      <motion.div
        animate={
          celebrating
            ? { y: [0, -11, 0, -6, 0], scale: [1, 1.1, 0.97, 1.06, 1] }
            : sleeping
              ? { scaleY: [1, 0.94, 1], y: [0, 2, 0] }
              : mood === "ecstatic"
                ? { y: [0, -5, 0], rotate: [-2, 2, -2] }
                : { y: [0, -3, 0], scale: [1, 1.03, 1] }
        }
        transition={{
          duration: celebrating ? 0.85 : sleeping ? 3.4 : 2.4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <LottieSticker name={activeLottie} fallbackIcon={visual.icon} size={px} />
      </motion.div>
    ) : (
      <Icon3D name={visual.icon} size={px} />
    );

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full border shadow-sm ${
        HABITAT_BG_CLASS[habitat]
      } ${stage >= 4 && mood === "ecstatic" ? "glow-badge-ring" : ""}`}
      style={{ width: boxSize, height: boxSize }}
    >
      {/* Orbital Atom Ring for Stage 4+ */}
      {stage >= 4 && !isCompact && (
        <motion.svg
          viewBox="0 0 100 100"
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1.5 h-[calc(100%+12px)] w-[calc(100%+12px)]"
          animate={shouldMotion ? { rotate: 360 } : undefined}
          transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
        >
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="rgba(99, 102, 241, 0.45)"
            strokeWidth="2"
            strokeDasharray="6 8"
          />
        </motion.svg>
      )}

      {/* Stage 5 Floating Crown */}
      {stage >= 5 && !isCompact && accessory !== "crown" && (
        <motion.div
          aria-hidden="true"
          animate={shouldMotion ? { y: [0, -3, 0] } : undefined}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -top-3 z-20"
        >
          <Icon3D name="crown" size={Math.max(16, Math.round(px * 0.36))} />
        </motion.div>
      )}

      {/* Main Pet Avatar */}
      <div className="relative z-10 flex items-center justify-center">{bodyContent}</div>

      {/* Stage 3 Subtle Lab Goggles Accent (if not explicitly wearing another top item) */}
      {stage >= 3 && !isCompact && accessory !== "goggles" && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-1.5 -top-1 z-20 rounded-full border border-white/80 bg-white/90 p-0.5 shadow-sm"
        >
          <Icon3D name="goggles" size={Math.max(14, Math.round(px * 0.32))} />
        </div>
      )}

      {/* Equipped Accessory Orbit Pill */}
      {accessoryIcon && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-1 -right-1 z-20 flex items-center justify-center rounded-full border border-white bg-white/95 p-0.5 shadow"
        >
          <Icon3D name={accessoryIcon} size={accPx} />
        </div>
      )}

      {/* Sleeping Zzz Bubble */}
      {sleeping && !celebrating && !isCompact && (
        <motion.div
          aria-hidden="true"
          animate={shouldMotion ? { y: [0, -6, -2], opacity: [0.7, 1, 0.65] } : undefined}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          className="pointer-events-none absolute -right-2 -top-2 z-20"
        >
          <Icon3D name="zzz" size={Math.max(16, Math.round(px * 0.38))} />
        </motion.div>
      )}

      {/* Celebration Floating Hearts & Sparkles */}
      {celebrating && !isCompact && (
        <motion.div
          aria-hidden="true"
          initial={{ scale: 0.4, opacity: 0, y: 4 }}
          animate={{ scale: [0.9, 1.2, 1], opacity: 1, y: [-2, -8, -4] }}
          transition={{ duration: 0.7, repeat: Infinity, repeatType: "reverse" }}
          className="pointer-events-none absolute -right-2 -top-2 z-20"
        >
          <Icon3D name="sparkling_heart" size={Math.max(18, Math.round(px * 0.42))} />
        </motion.div>
      )}
    </div>
  );
}

import { Suspense, lazy, useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import type { Discipline, GradeLevel } from "../../api/types";

const LazyLottie = lazy(() =>
  import("lottie-react").then((mod) => ({ default: mod.Lottie }))
);

export type Icon3DName =
  | "microscope"
  | "test_tube"
  | "alembic"
  | "petri_dish"
  | "dna"
  | "atom"
  | "magnet"
  | "high_voltage"
  | "light_bulb"
  | "telescope"
  | "rocket"
  | "seedling"
  | "globe"
  | "trophy"
  | "fire"
  | "sparkles"
  | "graduation_cap"
  | "books"
  | "robot"
  | "owl"
  | "video_game"
  | "glowing_star"
  | "medal"
  | "ringed_planet"
  | "brain"
  | "heart"
  | "lungs"
  | "battery"
  | "thermometer"
  | "compass"
  | "herb"
  | "rainbow"
  | "crown"
  | "shield"
  | "gem_stone"
  | "microbe"
  | "gear"
  | "party_popper";

export type LottieName =
  | "rocket"
  | "fire"
  | "sparkles"
  | "party"
  | "lightbulb"
  | "electricity"
  | "trophy"
  | "star_glow"
  | "owl"
  | "seedling"
  | "gear";

export type BioDiagramName =
  | "beaker_stir"
  | "distillation"
  | "dropper_bottles"
  | "salt_solution"
  | "dna_helix"
  | "prokaryote_cell";

export function assetUrl(relPath: string): string {
  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const clean = relPath.replace(/^\//, "");
  return `${base}/${clean}`;
}

export const DISCIPLINE_3D_ICON: Record<Discipline, Icon3DName> = {
  general_lab: "microscope",
  chemistry: "test_tube",
  physics: "high_voltage",
  biology: "dna",
};

export const DISCIPLINE_BIO_DIAGRAM: Record<Discipline, BioDiagramName> = {
  general_lab: "distillation",
  chemistry: "beaker_stir",
  physics: "salt_solution",
  biology: "dna_helix",
};

export const GRADE_3D_ICON: Record<GradeLevel, Icon3DName> = {
  6: "microscope",
  7: "magnet",
  8: "alembic",
  9: "dna",
};

export const STUDY_PACK_UNIT_3D_ICON: Record<number, Icon3DName> = {
  1: "rocket",
  2: "thermometer",
  3: "magnet",
  4: "rainbow",
  5: "ringed_planet",
  6: "atom",
  7: "alembic",
  8: "test_tube",
  9: "gem_stone",
  10: "petri_dish",
  11: "microbe",
  12: "owl",
  13: "seedling",
  14: "heart",
  15: "globe",
  16: "dna",
};

const LOTTIE_DEFAULT_FALLBACK: Record<LottieName, Icon3DName> = {
  rocket: "rocket",
  fire: "fire",
  sparkles: "sparkles",
  party: "party_popper",
  lightbulb: "light_bulb",
  electricity: "high_voltage",
  trophy: "trophy",
  star_glow: "glowing_star",
  owl: "owl",
  seedling: "seedling",
  gear: "gear",
};

interface Icon3DProps {
  name: Icon3DName;
  size?: number;
  alt?: string;
  className?: string;
  float?: boolean;
}

export function Icon3D({
  name,
  size = 32,
  alt = "",
  className = "",
  float = false,
}: Icon3DProps) {
  return (
    <img
      src={assetUrl(`assets/icons3d/${name}.png`)}
      width={size}
      height={size}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      loading="lazy"
      decoding="async"
      className={`inline-block shrink-0 select-none object-contain drop-shadow-sm ${
        float ? "float-gentle" : ""
      } ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

const lottieCache = new Map<LottieName, object>();
const lottiePending = new Map<LottieName, Promise<object | null>>();

function loadLottieData(name: LottieName): Promise<object | null> {
  const cached = lottieCache.get(name);
  if (cached) return Promise.resolve(cached);

  const pending = lottiePending.get(name);
  if (pending) return pending;

  const promise = fetch(assetUrl(`assets/lottie/${name}.json`))
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<object>;
    })
    .then((json) => {
      lottieCache.set(name, json);
      return json;
    })
    .catch(() => null)
    .finally(() => {
      lottiePending.delete(name);
    });

  lottiePending.set(name, promise);
  return promise;
}

interface LottieStickerProps {
  name: LottieName;
  size?: number;
  fallbackIcon?: Icon3DName;
  loop?: boolean;
  className?: string;
}

export function LottieSticker({
  name,
  size = 48,
  fallbackIcon,
  loop = true,
  className = "",
}: LottieStickerProps) {
  const reduced = useReducedMotion();
  const [animData, setAnimData] = useState<object | null>(() => lottieCache.get(name) ?? null);
  const resolvedFallback = fallbackIcon ?? LOTTIE_DEFAULT_FALLBACK[name];

  useEffect(() => {
    if (reduced) return;
    const cached = lottieCache.get(name);
    if (cached) {
      setAnimData(cached);
      return;
    }
    let active = true;
    void loadLottieData(name).then((data) => {
      if (active && data) {
        setAnimData(data);
      }
    });
    return () => {
      active = false;
    };
  }, [name, reduced]);

  const fallbackEl = <Icon3D name={resolvedFallback} size={size} className={className} />;

  if (reduced || !animData) {
    return fallbackEl;
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Suspense fallback={fallbackEl}>
        <LazyLottie
          src={animData}
          loop={loop}
          autoplay
          style={{ width: size, height: size }}
        />
      </Suspense>
    </span>
  );
}

interface BioDiagramProps {
  name: BioDiagramName;
  alt?: string;
  className?: string;
}

export function BioDiagram({ name, alt = "", className = "" }: BioDiagramProps) {
  return (
    <img
      src={assetUrl(`assets/bioicons/${name}.svg`)}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      loading="lazy"
      decoding="async"
      className={`select-none object-contain ${className}`}
    />
  );
}

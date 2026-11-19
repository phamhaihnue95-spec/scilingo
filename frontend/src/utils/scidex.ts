const SCIDEX_STORAGE_KEY = "scilingo_scidex_unlocked";
const SCIDEX_BADGE_PATTERN = /^SciDex: Unit (\d+)$/;

function normalizeUnits(values: unknown): number[] {
  if (!Array.isArray(values)) return [];
  const valid = new Set<number>();
  for (const raw of values) {
    const num = typeof raw === "number" ? raw : Number(raw);
    if (Number.isInteger(num) && num >= 1 && num <= 16) {
      valid.add(num);
    }
  }
  return Array.from(valid).sort((a, b) => a - b);
}

export function getLocalSciDexUnits(): number[] {
  try {
    const raw = localStorage.getItem(SCIDEX_STORAGE_KEY);
    if (!raw) return [];
    return normalizeUnits(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function unlockLocalSciDexUnit(unitNo: number): number[] {
  if (!Number.isInteger(unitNo) || unitNo < 1 || unitNo > 16) {
    return getLocalSciDexUnits();
  }
  const current = new Set(getLocalSciDexUnits());
  current.add(unitNo);
  const next = Array.from(current).sort((a, b) => a - b);
  try {
    localStorage.setItem(SCIDEX_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota / privacy mode errors
  }
  return next;
}

export function extractSciDexUnitsFromBadges(badges: string[] = []): number[] {
  const units: number[] = [];
  for (const badge of badges) {
    const match = SCIDEX_BADGE_PATTERN.exec(badge);
    if (match) {
      const unitNo = Number(match[1]);
      if (Number.isInteger(unitNo) && unitNo >= 1 && unitNo <= 16) {
        units.push(unitNo);
      }
    }
  }
  return normalizeUnits(units);
}

export function getMergedSciDexUnits(badges?: string[]): number[] {
  const merged = new Set<number>([
    ...getLocalSciDexUnits(),
    ...extractSciDexUnitsFromBadges(badges),
  ]);
  return Array.from(merged).sort((a, b) => a - b);
}

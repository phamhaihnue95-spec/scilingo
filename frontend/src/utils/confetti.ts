import confetti from "canvas-confetti";

const PALETTE = ["#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#d946ef"];

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function fireSuccessSpark(): void {
  if (prefersReducedMotion()) return;
  try {
    void confetti({
      particleCount: 32,
      spread: 55,
      origin: { y: 0.65 },
      colors: PALETTE,
      disableForReducedMotion: true,
    });
  } catch {
    // Ignore confetti canvas errors in headless environments
  }
}

export function fireVictoryCelebration(): void {
  if (prefersReducedMotion()) return;
  try {
    void confetti({
      particleCount: 55,
      angle: 60,
      spread: 60,
      origin: { x: 0.1, y: 0.65 },
      colors: PALETTE,
      disableForReducedMotion: true,
    });
    void confetti({
      particleCount: 55,
      angle: 120,
      spread: 60,
      origin: { x: 0.9, y: 0.65 },
      colors: PALETTE,
      disableForReducedMotion: true,
    });
  } catch {
    // Ignore confetti canvas errors in headless environments
  }
}

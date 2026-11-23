import type { Discipline } from "../api/types";

export const PET_CELEBRATE_EVENT = "scilingo-pet-celebrate";
export const PET_FOCUS_EVENT = "scilingo-pet-focus-mode";

export interface PetCelebrateDetail {
  source: "srs" | "quiz" | "lightning" | "iupac" | "sequence" | "study_pack";
  xpEarned?: number;
  messageVi?: string;
  discipline?: Discipline;
  leveledUp?: boolean;
}

export function emitPetCelebration(detail: PetCelebrateDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<PetCelebrateDetail>(PET_CELEBRATE_EVENT, { detail }));
}

export function emitPetFocusMode(hidden: boolean): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<boolean>(PET_FOCUS_EVENT, { detail: hidden }));
}

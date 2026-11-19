/**
 * Zero-asset Web Audio API sound synthesizer for tactile game feedback.
 * Honors user preference saved in localStorage under 'scilingo_sound_fx'.
 */

const SOUND_PREF_KEY = "scilingo_sound_fx";
export const SOUND_CHANGE_EVENT = "scilingo-sound-change";

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!sharedCtx) {
      sharedCtx = new Ctor();
    }
    if (sharedCtx.state === "suspended") {
      void sharedCtx.resume();
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SOUND_PREF_KEY) !== "0";
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SOUND_PREF_KEY, enabled ? "1" : "0");
    window.dispatchEvent(new CustomEvent(SOUND_CHANGE_EVENT, { detail: enabled }));
  } catch {
    // Ignore storage errors
  }
}

function playTone(
  freq: number,
  durationSec: number,
  options: {
    type?: OscillatorType;
    gain?: number;
    delaySec?: number;
    endFreq?: number;
  } = {}
): void {
  if (!isSoundEnabled()) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const startAt = ctx.currentTime + (options.delaySec ?? 0);
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = options.type ?? "sine";
    osc.frequency.setValueAtTime(freq, startAt);
    if (options.endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(40, options.endFreq), startAt + durationSec);
    }

    const peakGain = options.gain ?? 0.08;
    gainNode.gain.setValueAtTime(0.001, startAt);
    gainNode.gain.linearRampToValueAtTime(peakGain, startAt + 0.015);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startAt + durationSec);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + durationSec + 0.02);
  } catch {
    // Ignore audio synthesis exceptions
  }
}

export function playClickSound(): void {
  playTone(620, 0.06, { type: "triangle", gain: 0.05, endFreq: 780 });
}

export function playFlipSound(): void {
  playTone(340, 0.09, { type: "sine", gain: 0.055, endFreq: 560 });
}

export function playSuccessSound(combo = 1): void {
  const boost = Math.min(Math.max(0, combo - 1), 6) * 45;
  playTone(523.25 + boost, 0.11, { type: "triangle", gain: 0.075 });
  playTone(659.25 + boost, 0.16, { type: "triangle", gain: 0.075, delaySec: 0.07 });
}

export function playWrongSound(): void {
  playTone(230, 0.14, { type: "sawtooth", gain: 0.045, endFreq: 170 });
}

export function playCelebrationSound(): void {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((freq, idx) => {
    playTone(freq, 0.22, {
      type: "triangle",
      gain: 0.08,
      delaySec: idx * 0.08,
    });
  });
}

export interface SpeechCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
}

const API_ROOT = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "");
const API_BASE = `${API_ROOT}/api/v1`;

let sharedAudio: HTMLAudioElement | null = null;
let cachedVoices: SpeechSynthesisVoice[] = [];
let activeUtterance: SpeechSynthesisUtterance | null = null;
let activeTimer: number | null = null;

function refreshVoices(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const list = window.speechSynthesis.getVoices();
  if (list && list.length > 0) {
    cachedVoices = list;
  }
}

if (typeof window !== "undefined" && "speechSynthesis" in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener?.("voiceschanged", refreshVoices);
}

function getSharedAudio(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = "auto";
  }
  return sharedAudio;
}

function clearTimers(): void {
  if (activeTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(activeTimer);
    activeTimer = null;
  }
}

function stopCurrentPlayback(): void {
  clearTimers();
  if (sharedAudio) {
    sharedAudio.onplaying = null;
    sharedAudio.onended = null;
    sharedAudio.onerror = null;
    try {
      sharedAudio.pause();
      sharedAudio.currentTime = 0;
    } catch {
      // ignore reset errors
    }
  }
  if (activeUtterance) {
    activeUtterance.onstart = null;
    activeUtterance.onend = null;
    activeUtterance.onerror = null;
    activeUtterance = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
  }
}

function pickEnglishVoice(): SpeechSynthesisVoice | null {
  refreshVoices();
  if (cachedVoices.length === 0) return null;
  const lowerMatch = (prefix: string) =>
    cachedVoices.find((v) => v.lang.toLowerCase().startsWith(prefix));
  return (
    lowerMatch("en-gb") ??
    lowerMatch("en-us") ??
    lowerMatch("en") ??
    cachedVoices.find((v) => v.default) ??
    cachedVoices[0] ??
    null
  );
}

function isAndroidOrMobileWebView(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|wv|Zalo|FBAN|FBAV/i.test(navigator.userAgent);
}

function playViaAudio(
  url: string,
  callbacks?: SpeechCallbacks,
  onFallback?: () => void
): void {
  const audio = getSharedAudio();
  if (!audio) {
    if (onFallback) {
      onFallback();
    } else {
      callbacks?.onEnd?.();
    }
    return;
  }

  let settled = false;
  const finish = () => {
    if (settled) return;
    settled = true;
    clearTimers();
    callbacks?.onEnd?.();
  };
  const failToFallback = () => {
    if (settled) return;
    settled = true;
    clearTimers();
    if (onFallback) {
      onFallback();
    } else {
      callbacks?.onEnd?.();
    }
  };

  audio.onplaying = () => callbacks?.onStart?.();
  audio.onended = finish;
  audio.onerror = failToFallback;
  audio.src = url;
  callbacks?.onStart?.();

  activeTimer =
    typeof window !== "undefined" ? window.setTimeout(finish, 8000) : null;

  const playPromise = audio.play();
  if (playPromise && typeof playPromise.catch === "function") {
    playPromise.catch(failToFallback);
  }
}

function playViaWebSpeech(
  cleanText: string,
  callbacks?: SpeechCallbacks,
  onFallback?: () => void
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (onFallback) {
      onFallback();
    } else {
      callbacks?.onStart?.();
      globalThis.setTimeout(() => callbacks?.onEnd?.(), 650);
    }
    return;
  }

  const synth = window.speechSynthesis;
  const wasActive = synth.speaking || synth.pending;
  if (wasActive) {
    synth.cancel();
  }

  const speakNow = () => {
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const voice = pickEnglishVoice();
    if (voice) {
      utterance.voice = voice;
    }
    utterance.lang = voice?.lang || "en-US";
    utterance.rate = 0.92;
    activeUtterance = utterance;

    let started = false;
    let finished = false;
    let startWatchdog: number | null = null;

    const markEnd = () => {
      if (finished) return;
      finished = true;
      if (startWatchdog !== null) window.clearTimeout(startWatchdog);
      clearTimers();
      activeUtterance = null;
      callbacks?.onEnd?.();
    };

    const failToFallback = () => {
      if (finished) return;
      finished = true;
      if (startWatchdog !== null) window.clearTimeout(startWatchdog);
      clearTimers();
      if (synth.speaking || synth.pending) {
        synth.cancel();
      }
      activeUtterance = null;
      if (onFallback) {
        onFallback();
      } else {
        callbacks?.onEnd?.();
      }
    };

    utterance.onstart = () => {
      started = true;
      if (startWatchdog !== null) window.clearTimeout(startWatchdog);
      callbacks?.onStart?.();
    };
    utterance.onend = markEnd;
    utterance.onerror = () => {
      if (!started && onFallback) {
        failToFallback();
      } else {
        markEnd();
      }
    };

    callbacks?.onStart?.();
    if (synth.paused) {
      synth.resume();
    }
    synth.speak(utterance);

    startWatchdog = window.setTimeout(() => {
      if (!started && !finished) {
        failToFallback();
      }
    }, 550);

    activeTimer = window.setTimeout(
      markEnd,
      Math.max(1800, cleanText.length * 140)
    );
  };

  if (wasActive && isAndroidOrMobileWebView()) {
    window.setTimeout(speakNow, 60);
  } else {
    speakNow();
  }
}

/**
 * Speaks an English scientific term aloud with reliable Android/mobile support:
 * - On Android/WebView: prioritizes cached backend MP3 audio, falling back to Web Speech API.
 * - On Desktop/iOS: uses Web Speech API first and seamlessly falls back to MP3 audio if TTS fails.
 */
export function speakEnglishTerm(
  termEn: string,
  audioUrl?: string | null,
  callbacks?: SpeechCallbacks
): void {
  const cleanText = termEn.replace(/\s*\(.*?\)\s*/g, " ").replace(/\s+/g, " ").trim();
  stopCurrentPlayback();

  if (!cleanText) {
    callbacks?.onEnd?.();
    return;
  }

  const proxyUrl = `${API_BASE}/curriculum/pronounce?text=${encodeURIComponent(cleanText)}`;

  if (audioUrl) {
    playViaAudio(audioUrl, callbacks, () =>
      playViaAudio(proxyUrl, callbacks, () => playViaWebSpeech(cleanText, callbacks))
    );
    return;
  }

  if (isAndroidOrMobileWebView()) {
    playViaAudio(proxyUrl, callbacks, () => playViaWebSpeech(cleanText, callbacks));
  } else {
    playViaWebSpeech(cleanText, callbacks, () => playViaAudio(proxyUrl, callbacks));
  }
}

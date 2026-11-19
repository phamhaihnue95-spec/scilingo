export interface SpeechCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
}

/**
 * Speaks an English scientific term aloud using either cached audio_url
 * or the browser's built-in Web Speech API (zero token cost in Bolt 1).
 */
export function speakEnglishTerm(
  termEn: string,
  audioUrl?: string | null,
  callbacks?: SpeechCallbacks
): void {
  if (audioUrl) {
    const audio = new Audio(audioUrl);
    audio.onplay = () => callbacks?.onStart?.();
    audio.onended = () => callbacks?.onEnd?.();
    audio.onerror = () => callbacks?.onEnd?.();
    void audio.play().catch(() => callbacks?.onEnd?.());
    return;
  }

  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    callbacks?.onStart?.();
    globalThis.setTimeout(() => callbacks?.onEnd?.(), 650);
    return;
  }

  window.speechSynthesis.cancel();
  const cleanText = termEn.replace(/\s*\(.*?\)\s*/g, " ").trim();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = "en-GB";
  utterance.rate = 0.92;

  let finished = false;
  const markEnd = () => {
    if (finished) return;
    finished = true;
    callbacks?.onEnd?.();
  };

  utterance.onstart = () => callbacks?.onStart?.();
  utterance.onend = markEnd;
  utterance.onerror = markEnd;

  callbacks?.onStart?.();
  window.speechSynthesis.speak(utterance);
  // Fallback timer in case browser speechSynthesis fails silently without firing onend
  globalThis.setTimeout(markEnd, Math.max(1600, cleanText.length * 140));
}

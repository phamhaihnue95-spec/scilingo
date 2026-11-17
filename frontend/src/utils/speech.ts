/**
 * Speaks an English scientific term aloud using either cached audio_url
 * or the browser's built-in Web Speech API (zero token cost in Bolt 1).
 */
export function speakEnglishTerm(termEn: string, audioUrl?: string | null): void {
  if (audioUrl) {
    const audio = new Audio(audioUrl);
    void audio.play();
    return;
  }

  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const cleanText = termEn.replace(/\s*\(.*?\)\s*/g, " ").trim();
  const utterance = new SpeechSynthesisUtterance(cleanText);
  utterance.lang = "en-GB";
  utterance.rate = 0.92;
  window.speechSynthesis.speak(utterance);
}

/**
 * Reading CarAI's replies aloud (Spec 34, AC-3) with the browser's SpeechSynthesis. One reply
 * speaks at a time; which one is speaking is a tiny external store, so the chat can show
 * "Speaking…" and a Stop button on exactly that message (§5 "Speaking (reply)").
 */

let speakingId: string | null = null;
const listeners = new Set<() => void>();

function setSpeaking(id: string | null) {
  if (speakingId === id) return;
  speakingId = id;
  listeners.forEach((listener) => listener());
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof window.SpeechSynthesisUtterance === "function";
}

/** Speaks `text` as message `id`, replacing anything already being spoken. */
export function speak(id: string, text: string, lang: string): void {
  if (!isSpeechSynthesisSupported() || !text.trim()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const utterance = new window.SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  const done = () => {
    if (speakingId === id) setSpeaking(null);
  };
  utterance.onend = done;
  utterance.onerror = done;
  setSpeaking(id);
  synth.speak(utterance);
}

/** Stops speaking at once (the Stop button, closing the chat, a new message, turning it off). */
export function cancelSpeech(): void {
  if (isSpeechSynthesisSupported()) window.speechSynthesis.cancel();
  setSpeaking(null);
}

/** For useSyncExternalStore: the id of the message being spoken, or null. */
export function getSpeakingId(): string | null {
  return speakingId;
}

export function getServerSpeakingId(): string | null {
  return null;
}

export function subscribeToSpeaking(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

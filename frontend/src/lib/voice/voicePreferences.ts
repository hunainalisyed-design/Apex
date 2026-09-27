/**
 * Per-viewer voice settings for CarAI (Spec 34), remembered in localStorage — the same
 * default-off, storage-guarded pattern as Spec 29's sound preference (lib/sound/soundPreference):
 * a private window or blocked storage just means "off, not remembered".
 *
 * - "Speak replies" (AC-3/AC-4): OFF unless the viewer turns it on — unexpected audio is unwelcome.
 * - Whether the viewer has already seen the one-time note that the browser's own speech service
 *   turns their voice into text (Chrome sends it to Google's servers).
 */
export const SPEAK_REPLIES_KEY = "apex:speak-replies";
export const VOICE_NOTE_SEEN_KEY = "apex:voice-note-seen";

const listeners = new Set<() => void>();
let speakRepliesOverride: boolean | null = null;

function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: boolean): void {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Not persisted — the in-memory value still applies for this page.
  }
}

export function setSpeakReplies(enabled: boolean): void {
  writeFlag(SPEAK_REPLIES_KEY, enabled);
  speakRepliesOverride = enabled;
  listeners.forEach((listener) => listener());
}

/** For useSyncExternalStore: the current choice, client-side. */
export function getSpeakRepliesSnapshot(): boolean {
  return speakRepliesOverride ?? readFlag(SPEAK_REPLIES_KEY);
}

/** Server render: always off, so speech can never be assumed before hydration. */
export function getServerSpeakRepliesSnapshot(): boolean {
  return false;
}

export function subscribeToSpeakReplies(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SPEAK_REPLIES_KEY) {
      speakRepliesOverride = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function hasSeenVoiceNote(): boolean {
  return readFlag(VOICE_NOTE_SEEN_KEY);
}

export function markVoiceNoteSeen(): void {
  writeFlag(VOICE_NOTE_SEEN_KEY, true);
}

/** Test-only: forget in-memory state between tests. */
export function resetVoicePreferencesForTests(): void {
  speakRepliesOverride = null;
}

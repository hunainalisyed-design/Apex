/**
 * The viewer's sound on/off choice (Spec 29, AC-1/AC-3): OFF unless they've turned it on,
 * remembered in localStorage — a per-viewer convenience, not account state. Every storage
 * access is guarded: a private window or blocked storage simply means "off, not remembered".
 * Deliberately unrelated to prefers-reduced-motion (AC-4): neither implies the other.
 */
export const SOUND_PREFERENCE_KEY = "apex:sound-enabled";

const listeners = new Set<() => void>();

export function readSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_PREFERENCE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, String(enabled));
  } catch {
    // Not persisted — the in-memory choice below still applies for this page.
  }
  memoryOverride = enabled;
  listeners.forEach((listener) => listener());
}

/** Holds the choice for this page even when storage writes fail. */
let memoryOverride: boolean | null = null;

/** For useSyncExternalStore: the current choice, client-side. */
export function getSoundEnabledSnapshot(): boolean {
  return memoryOverride ?? readSoundEnabled();
}

/** Server render: always off, so sound can never be assumed before hydration. */
export function getServerSoundEnabledSnapshot(): boolean {
  return false;
}

export function subscribeToSoundEnabled(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === SOUND_PREFERENCE_KEY) {
      memoryOverride = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Test-only: forget the in-memory choice between tests. */
export function resetSoundPreferenceForTests(): void {
  memoryOverride = null;
}

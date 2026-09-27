/** The display name people last used for live sessions, remembered on this device (Spec 33, AC-8). */
const NAME_KEY = "apex-live-name";
const JOINED_KEY = (sessionId: string) => `apex-live-joined:${sessionId}`;

export const LIVE_NAME_MAX_LENGTH = 24;

export function readLiveName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeLiveName(name: string) {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Not remembered — the field just starts empty next time.
  }
}

/** Set by whoever started or joined this session in this tab, so a reload rejoins without asking again. */
export function markJoined(sessionId: string) {
  try {
    sessionStorage.setItem(JOINED_KEY(sessionId), "1");
  } catch {
    // Without storage, a reload shows the join card again.
  }
}

export function hasJoined(sessionId: string): boolean {
  try {
    return sessionStorage.getItem(JOINED_KEY(sessionId)) === "1";
  } catch {
    return false;
  }
}

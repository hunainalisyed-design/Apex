import { create } from "zustand";

export type ConsentChoice = "accepted" | "rejected";

const STORAGE_KEY = "apex_cookie_consent";

/** Bumping this invalidates every stored consent choice, per Spec 24 AC-2's "until ... a
 * policy version changes" — change it whenever the privacy policy's actual data practices
 * change enough to warrant asking again, not for every unrelated policy-page copy edit. */
const POLICY_VERSION = 1;

interface StoredConsent {
  choice: ConsentChoice;
  policyVersion: number;
}

function readStoredConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredConsent;
    return parsed.policyVersion === POLICY_VERSION ? parsed.choice : null;
  } catch {
    // Private browsing/blocked storage, or corrupt JSON — treat as "no choice made yet"
    // rather than crashing; the banner reappearing is the correct, safe fallback.
    return null;
  }
}

function writeStoredConsent(choice: ConsentChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, policyVersion: POLICY_VERSION } satisfies StoredConsent));
  } catch {
    // Nothing further to do — the in-memory store state still reflects the choice for this
    // page load; it just won't persist across a reload if storage is unavailable.
  }
}

/**
 * Gate function for any non-essential script (Spec 24, AC-1/AC-3) — Spec 23's analytics is
 * the first intended caller, once it exists; there is no analytics code yet (that spec's own
 * AC-5/AC-6 were deliberately deferred pending this one), so this is currently a no-op
 * safety check with nothing calling it in production yet. Reads storage directly rather than
 * the store's React state so it works from plain module code, not just components.
 */
export function hasAnalyticsConsent(): boolean {
  return readStoredConsent() === "accepted";
}

export interface ConsentState {
  /** Distinguishes "haven't read localStorage yet" (SSR / not yet mounted) from "read it,
   * there's genuinely no choice" — same hydration-flag pattern as authStore, needed because
   * this app renders the same tree on the server (no localStorage there) and the client. */
  hydrated: boolean;
  choice: ConsentChoice | null;
  hydrate: () => void;
  accept: () => void;
  reject: () => void;
}

/** Cookie consent state (Spec 24) — a plain global Zustand store, matching this codebase's
 * established convention (authStore, garageStore, configurationStore) rather than React
 * Context. */
export const useConsentStore = create<ConsentState>((set) => ({
  hydrated: false,
  choice: null,

  hydrate: () => set({ choice: readStoredConsent(), hydrated: true }),

  accept: () => {
    writeStoredConsent("accepted");
    set({ choice: "accepted" });
  },

  reject: () => {
    writeStoredConsent("rejected");
    set({ choice: "rejected" });
  },
}));

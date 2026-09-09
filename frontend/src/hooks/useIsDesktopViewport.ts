"use client";

import { useSyncExternalStore } from "react";

// Matches Tailwind's default `lg` breakpoint — this codebase's one existing structural
// responsive threshold (see ShowroomLayout.tsx), and now shared by Nav's hamburger collapse
// and the scroll showcase's live-vs-static split (Spec 13, AC-12).
const QUERY = "(min-width: 1024px)";

function subscribe(callback: () => void) {
  const mediaQuery = window.matchMedia(QUERY);
  mediaQuery.addEventListener("change", callback);
  return () => mediaQuery.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

// Defaults to "not desktop" server-side/pre-hydration — the safe direction for AC-12's
// mobile-performance requirement, since a real GLB/Canvas must never mount on a small
// device even briefly. Mirrors useReducedMotion.ts's same SSR-safe useSyncExternalStore
// shape, applied to viewport width instead of the reduced-motion media query.
function getServerSnapshot() {
  return false;
}

/** Whether the viewport is at least the `lg` breakpoint (Spec 13, AC-12) — a JS boolean,
 * not just a CSS class, because the scroll showcase must decide whether to mount its
 * WebGL Canvas at all, which a CSS breakpoint alone can't prevent. */
export function useIsDesktopViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

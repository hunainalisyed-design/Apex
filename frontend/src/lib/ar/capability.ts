export type ArPlatform = "ios" | "android";

/**
 * Which native AR viewer this device can hand off to, or null when none (Spec 27, AC-1) —
 * progressive enhancement: null means the AR button simply isn't rendered.
 *
 * - iOS: Safari (and iOS browsers built on it) advertise AR Quick Look through
 *   `<a rel="ar">` support — the same check Apple documents and <model-viewer> uses.
 * - Android: Scene Viewer is reached through an `intent://` link, which Chrome-based
 *   browsers handle; Firefox and the Oculus browser don't, so they're excluded.
 *
 * Takes its inputs as arguments so it can be tested without a real device.
 */
export function detectArPlatform(env: { userAgent: string; supportsQuickLook: boolean }): ArPlatform | null {
  if (env.supportsQuickLook) return "ios";
  const ua = env.userAgent;
  if (/Android/i.test(ua) && !/Firefox|OculusBrowser/i.test(ua)) return "android";
  return null;
}

/** detectArPlatform for the current browser. Client-only (reads document/navigator). */
export function detectCurrentArPlatform(): ArPlatform | null {
  if (typeof document === "undefined" || typeof navigator === "undefined") return null;
  return detectArPlatform({ userAgent: navigator.userAgent, supportsQuickLook: supportsQuickLook() });
}

/** DOMTokenList.supports() is allowed to *throw* (not return false) when an element has no
 * defined rel tokens — some engines (and jsdom) do — so an exception means "no Quick Look". */
function supportsQuickLook(): boolean {
  try {
    return Boolean(document.createElement("a").relList?.supports?.("ar"));
  } catch {
    return false;
  }
}

import { translate } from "@/i18n/translator";
import messages from "../../../messages/en-US.json";

type ErrorMessageKey = Exclude<keyof typeof messages.errors, "fallback">;

function isKnownErrorCode(code: string): code is ErrorMessageKey {
  return code !== "fallback" && Object.hasOwn(messages.errors, code);
}

/**
 * Maps a backend ApiError `code` to a human-readable message (Spec 12, AC-4) — the raw
 * `code` or backend `message` string is never shown to the user. Any code without an
 * explicit mapping (including a missing/undefined code) falls back to a generic message.
 * The messages live under `errors` in messages/<locale>.json (Spec 26, AC-2); this runs
 * outside React (Zustand stores call it), hence the shared `translate` rather than a hook.
 * English is the key catalog — every locale file carries the same `errors` keys.
 */
export function getErrorMessage(code: string | undefined | null): string {
  if (code && isKnownErrorCode(code)) return translate(`errors.${code}`);
  return translate("errors.fallback");
}

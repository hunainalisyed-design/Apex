const ERROR_MESSAGES: Record<string, string> = {
  VEHICLE_NOT_FOUND: "Unable to load vehicle. Please try again.",
  VALIDATION_ERROR: "Something about this build isn't valid. Please try again.",
  OPTION_VEHICLE_MISMATCH: "One of your selections doesn't belong to this vehicle. Please refresh and try again.",
  DUPLICATE_OPTION_SELECTION: "A selection was submitted more than once. Please refresh and try again.",
  CONFIGURATION_NOT_FOUND: "This build could not be found.",
  RATE_LIMITED: "Too many requests. Please wait a moment and try again.",
};

const FALLBACK_MESSAGE = "Something went wrong. Please try again.";

/**
 * Maps a backend ApiError `code` to a human-readable message (Spec 12, AC-4) — the raw
 * `code` or backend `message` string is never shown to the user. Any code without an
 * explicit mapping (including a missing/undefined code) falls back to a generic message.
 */
export function getErrorMessage(code: string | undefined | null): string {
  if (!code) return FALLBACK_MESSAGE;
  return ERROR_MESSAGES[code] ?? FALLBACK_MESSAGE;
}

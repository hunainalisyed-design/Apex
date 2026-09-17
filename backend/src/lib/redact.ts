/**
 * Recursively strips known-sensitive keys from an arbitrary object before it's logged
 * (Spec 22, AC-5) — passwords, tokens, API keys, and payment details must never reach a log
 * line, structured or not. Matching is case-insensitive and substring-based (`"newPassword"`
 * and `"stripeSecretKey"` both match) so a new field named along these lines is caught
 * without updating this list.
 */
const SENSITIVE_KEY_PATTERN =
  /password|token|secret|apikey|api_key|authorization|cookie|cardnumber|card_number|cvv|cvc/i;

const REDACTED = "[REDACTED]";

export function redact<T>(value: T): T {
  return redactValue(value, new WeakSet()) as T;
}

function redactValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== "object") return value;

  if (seen.has(value as object)) return "[CIRCULAR]";
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, seen));
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactValue(entry, seen);
  }
  return result;
}

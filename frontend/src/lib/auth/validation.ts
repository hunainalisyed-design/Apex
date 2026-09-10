const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_LENGTH = 8;
const HAS_LETTER = /[a-zA-Z]/;
const HAS_NUMBER = /[0-9]/;

export function isValidEmail(email: string): boolean {
  return EMAIL_FORMAT.test(email.trim());
}

/** Mirrors backend/src/services/auth/password.ts's validatePasswordPolicy exactly (Spec
 * 16 §3) — client-side for immediate feedback, the server remains the authority. */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_LENGTH) {
    return `Password must be at least ${MIN_LENGTH} characters.`;
  }
  if (!HAS_LETTER.test(password)) {
    return "Password must include at least one letter.";
  }
  if (!HAS_NUMBER.test(password)) {
    return "Password must include at least one number.";
  }
  return null;
}

/**
 * Guards a `?returnTo=` query param before ever redirecting to it (Spec 17, AC-1) — an
 * open-redirect check. A bare `path.startsWith("/") && !path.startsWith("//")` check is a
 * common baseline but has a known bypass: browsers normalize a leading `/\` (or `\/`) to
 * `//` before resolving a URL, so a value like `/\evil.com` can still resolve as
 * protocol-relative and escape the origin. Also rejects any path starting with `\` or
 * containing `/\`/`\/` right after the leading slash for that reason.
 */
export function isSafeReturnTo(path: string | null): path is string {
  if (!path || !path.startsWith("/")) return false;
  // Reject "//..." (protocol-relative) and "/\..." / "\..." — browsers normalize a leading
  // backslash to a forward slash before resolving a URL, so these can also become
  // protocol-relative and escape the origin.
  if (path.startsWith("//") || path.startsWith("/\\") || path.startsWith("\\")) return false;
  return true;
}

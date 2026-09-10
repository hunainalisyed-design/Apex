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

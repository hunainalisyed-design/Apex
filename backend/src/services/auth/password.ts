import bcrypt from "bcryptjs";

const BCRYPT_COST_FACTOR = 12;

/** Baseline password policy (Spec 16 §3) — not tied to any specific compliance standard,
 * so it can be tightened later without a breaking API change (lives in validation logic,
 * not the wire contract). */
const MIN_LENGTH = 8;
const HAS_LETTER = /[a-zA-Z]/;
const HAS_NUMBER = /[0-9]/;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST_FACTOR);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Returns the first policy violation message, or null if the password satisfies every
 * rule. Client-side re-implements the identical rules for immediate feedback; this is the
 * authority (Spec 16 §3). */
export function validatePasswordPolicy(password: string): string | null {
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

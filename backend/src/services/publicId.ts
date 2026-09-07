import { randomInt } from "node:crypto";

// 32 characters, excludes visually ambiguous ones (0/O, 1/I/L).
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const SEGMENT_LENGTH = 4;
const PREFIX_LENGTH = 4;

function randomSegment(): string {
  return Array.from({ length: SEGMENT_LENGTH }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

function prefixFromVehicleName(name: string): string {
  const firstWord = name.trim().split(/\s+/)[0] ?? "";
  return firstWord.toUpperCase().slice(0, PREFIX_LENGTH).padEnd(PREFIX_LENGTH, "X");
}

export class PublicIdGenerationError extends Error {
  constructor(maxAttempts: number) {
    super(`Could not generate a unique publicId after ${maxAttempts} attempts.`);
    this.name = "PublicIdGenerationError";
  }
}

/**
 * Generates a "APEX-7F82-K91X"-style publicId (Spec 10 §3). `isTaken` is injected rather
 * than calling Prisma directly, so this stays a pure-ish, DB-agnostic function testable
 * without a real database — matching this codebase's existing pure-function-unit-test /
 * real-DB-integration-test split. Retries on collision; the caller is still responsible
 * for a defense-in-depth retry around the actual insert (see services/configurations.ts)
 * since this pre-check and the eventual create aren't atomic.
 */
export async function generatePublicId(
  vehicleName: string,
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 5,
): Promise<string> {
  const prefix = prefixFromVehicleName(vehicleName);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate = `${prefix}-${randomSegment()}-${randomSegment()}`;
    if (!(await isTaken(candidate))) {
      return candidate;
    }
  }

  throw new PublicIdGenerationError(maxAttempts);
}

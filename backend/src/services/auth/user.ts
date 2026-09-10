import type { User } from "@prisma/client";
import type { UserDto } from "../../types/auth.js";

export function mapUserToDto(user: User): UserDto {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Postgres's `@unique` is case-sensitive by default (no citext) — without normalizing,
 * "User@x.com" and "user@x.com" would collide inconsistently across the three places email
 * casing matters: sign-up's uniqueness check, login's lookup, and the login rate-limiter's
 * per-email key (Spec 16). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

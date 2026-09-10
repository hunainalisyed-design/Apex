import type { User } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { UserDto } from "../../types/auth.js";
import { hashPassword, validatePasswordPolicy, verifyPassword } from "./password.js";
import { revokeAllSessionsForUserExcept } from "./session.js";

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

/** Updates the display name (Spec 17, AC-9). Email/password are untouched here — those
 * have their own dedicated flows (sign-up, change-password, reset-password). */
export async function updateProfileName(userId: string, name: string): Promise<UserDto> {
  const user = await prisma.user.update({ where: { id: userId }, data: { name } });
  return mapUserToDto(user);
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; reason: "INVALID_CURRENT_PASSWORD" }
  | { ok: false; reason: "WEAK_PASSWORD"; message: string };

/**
 * Changes a known, authenticated user's password (Spec 17, AC-9) — distinct from Spec 16's
 * password reset: the caller already proved identity via their current password, not a
 * mailed token, so the current session stays signed in while every OTHER session is
 * revoked (revokeAllSessionsForUserExcept), atomically alongside the password-hash update
 * via the same prisma.$transaction composability pattern passwordReset.ts established.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentSessionToken: string,
): Promise<ChangePasswordResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return { ok: false, reason: "INVALID_CURRENT_PASSWORD" };
  }

  const violation = validatePasswordPolicy(newPassword);
  if (violation) {
    return { ok: false, reason: "WEAK_PASSWORD", message: violation };
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash } });
    await revokeAllSessionsForUserExcept(userId, currentSessionToken, tx);
  });

  return { ok: true };
}

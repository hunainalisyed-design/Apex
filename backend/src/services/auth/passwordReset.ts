import { prisma } from "../../lib/prisma.js";
import { hashPassword } from "./password.js";
import { generateToken, hashToken, revokeAllSessionsForUser } from "./session.js";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour (Spec 16 AC-6)

export async function createPasswordResetToken(userId: string): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });

  return token;
}

export type ConsumeResetTokenResult = { ok: true } | { ok: false };

/**
 * Validates a reset token (unexpired, unused), and — atomically in one
 * prisma.$transaction, not sequential awaits, so a crash mid-way can never leave a used
 * token with sessions still valid — marks it used, updates the password, and revokes every
 * session for that user (Spec 16 AC-7). Rejects reuse (AC-8) since usedAt is checked before
 * the transaction and the update is scoped to usedAt: null, making a concurrent double-use
 * race safe too (the second transaction's WHERE clause matches zero rows).
 */
export async function consumeResetToken(rawToken: string, newPassword: string): Promise<ConsumeResetTokenResult> {
  const tokenHash = hashToken(rawToken);
  const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
    return { ok: false };
  }

  const passwordHash = await hashPassword(newPassword);

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.passwordResetToken.updateMany({
      where: { id: resetToken.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    // Someone else consumed it between our read and this write — treat as invalid rather
    // than proceeding to change the password twice.
    if (updated.count === 0) return false;

    await tx.user.update({ where: { id: resetToken.userId }, data: { passwordHash } });
    await revokeAllSessionsForUser(resetToken.userId, tx);
    return true;
  });

  return result ? { ok: true } : { ok: false };
}

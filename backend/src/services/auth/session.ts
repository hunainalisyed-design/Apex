import crypto from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { Response } from "express";
import { prisma } from "../../lib/prisma.js";
import type { UserDto } from "../../types/auth.js";
import { mapUserToDto } from "./user.js";

type PrismaOrTx = PrismaClient | Prisma.TransactionClient;

export const SESSION_COOKIE_NAME = "apex_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days (Spec 16 §4 Retention)

export function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

/** SHA-256, deliberately not bcrypt: bcrypt's slowness defends a low-entropy, user-chosen
 * secret (a password) — a 256-bit random token is already unguessable, and bcrypt-hashing
 * it would slow down every authenticated request's session lookup for no security benefit
 * (Spec 16). */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Creates a session row and returns the raw token — the only time it's ever available;
 * only its hash is ever stored (Spec 16 §3). */
export async function createSession(userId: string, client: PrismaOrTx = prisma): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await client.session.create({ data: { userId, tokenHash, expiresAt } });

  return token;
}

export async function validateSession(rawToken: string): Promise<UserDto | null> {
  const tokenHash = hashToken(rawToken);
  const session = await prisma.session.findUnique({ where: { tokenHash }, include: { user: true } });

  if (!session || session.expiresAt < new Date()) return null;

  return mapUserToDto(session.user);
}

/** Invalidates exactly this one session (logout, AC-9) — other sessions for the same user
 * on other devices are untouched. */
export async function revokeSession(rawToken: string): Promise<void> {
  const tokenHash = hashToken(rawToken);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

/** Invalidates every session for a user (password reset, AC-7). Accepts an optional
 * Prisma-or-transaction client so callers needing atomicity (password reset must update
 * the password hash, mark the reset token used, AND revoke every session together) can
 * compose this into a single prisma.$transaction(async (tx) => ...) call. */
export async function revokeAllSessionsForUser(userId: string, client: PrismaOrTx = prisma): Promise<void> {
  await client.session.deleteMany({ where: { userId } });
}

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  // Conditional, not always true: a literal always-Secure cookie is never sent by browsers
  // over the plain http://localhost this project runs on in dev and in `playwright test` —
  // hardcoding it would silently break the whole auth flow in this environment.
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, { ...COOKIE_OPTIONS, maxAge: SESSION_TTL_MS });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, COOKIE_OPTIONS);
}

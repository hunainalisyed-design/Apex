import { prisma } from "../lib/prisma.js";
import { mapUserToDto } from "./auth/user.js";
import { getConfigurationsForUser } from "./configurations.js";
import { mapLeadToDto } from "./leads/mapLeadToDto.js";
import type { UserDataExportDto } from "../types/gdpr.js";
import type { ReservationDto } from "../types/reservations.js";

/** Spec 24, AC-5 — the four record types this product has collected about a user so far
 * (Specs 16, 10, 19, 20). Reuses each spec's own existing DTO mapper rather than a second,
 * drift-prone shape, same convention as Spec 9's deriveBuildSummary being reused everywhere
 * a build needs describing. */
export async function exportUserData(userId: string): Promise<UserDataExportDto> {
  const [user, configurations, leads, reservations, likes] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    getConfigurationsForUser(userId),
    prisma.lead.findMany({
      where: { userId },
      include: { configuration: { include: { vehicle: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.reservation.findMany({
      where: { userId },
      include: { configuration: { include: { vehicle: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.like.findMany({
      where: { userId },
      include: { configuration: { select: { publicId: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const reservationDtos: ReservationDto[] = reservations.map((reservation) => ({
    id: reservation.id,
    configurationPublicId: reservation.configuration.publicId,
    vehicleSlug: reservation.configuration.vehicle.slug,
    amountCents: reservation.amountCents,
    currency: reservation.currency,
    status: reservation.status,
    createdAt: reservation.createdAt.toISOString(),
  }));

  return {
    exportedAt: new Date().toISOString(),
    user: mapUserToDto(user),
    configurations,
    leads: leads.map(mapLeadToDto),
    reservations: reservationDtos,
    likes: likes.map((like) => ({ configurationPublicId: like.configuration.publicId, likedAt: like.createdAt.toISOString() })),
  };
}

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; reason: "EMAIL_MISMATCH" }
  | { ok: false; reason: "ADMIN_ACCOUNT" };

/**
 * Spec 24, AC-6. Deleting the `User` row is the entire anonymization mechanism — no manual
 * "set userId to null on related rows" step is needed here, because Configuration.user,
 * Lead.user, and Reservation.user are already `onDelete: SetNull` in the schema (set when
 * those specs were built, not added for this one). Session/PasswordResetToken are
 * `onDelete: Cascade` on the same relation, so they're removed automatically too.
 *
 * ADMIN accounts are refused rather than left to fail on AuditLogEntry.admin's FK (that
 * relation has no onDelete override — Prisma's default Restrict — since an admin action's
 * audit trail must survive the admin who performed it, Spec 21 AC-6). This mirrors the
 * existing "no self-service path into ADMIN" precedent (backend/scripts/promoteAdmin.ts) —
 * there's equally no self-service path out via account deletion.
 */
export async function deleteAccount(userId: string, confirmEmail: string): Promise<DeleteAccountResult> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  if (user.role === "ADMIN") return { ok: false, reason: "ADMIN_ACCOUNT" };
  if (user.email.toLowerCase() !== confirmEmail.trim().toLowerCase()) return { ok: false, reason: "EMAIL_MISMATCH" };

  // Spec 31: the account's builds leave the public gallery first — otherwise SetNull on
  // Configuration.userId would leave them published anonymously. Its likes cascade away with
  // the user row (Like.user onDelete: Cascade).
  await prisma.$transaction([
    prisma.configuration.updateMany({ where: { userId, isPublished: true }, data: { isPublished: false } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
  return { ok: true };
}

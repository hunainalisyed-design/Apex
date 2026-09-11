import { prisma } from "../../lib/prisma.js";
import type { ReservationDto } from "../../types/reservations.js";

/** For the return page (Spec 20, AC-4) — looked up by the Reservation's own id, no auth
 * required per the spec's own contract. */
export async function getReservationById(id: string): Promise<ReservationDto | null> {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: { configuration: { include: { vehicle: true } } },
  });
  if (!reservation) return null;

  return {
    id: reservation.id,
    configurationPublicId: reservation.configuration.publicId,
    vehicleSlug: reservation.configuration.vehicle.slug,
    amountCents: reservation.amountCents,
    currency: reservation.currency,
    status: reservation.status,
    createdAt: reservation.createdAt.toISOString(),
  };
}

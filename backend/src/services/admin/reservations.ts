import { prisma } from "../../lib/prisma.js";
import { parsePagination } from "./pagination.js";
import type { ReservationDto } from "../../types/reservations.js";
import type { PaginationQuery } from "../../types/admin.js";

/** Read-only (AC-5) — status only ever changes via the Stripe webhook
 * (services/reservations/webhook.js), never through an admin write. No update function
 * exists here on purpose. */
export async function listReservations(pagination: PaginationQuery): Promise<ReservationDto[]> {
  const { skip, take } = parsePagination(pagination);
  const reservations = await prisma.reservation.findMany({
    include: { configuration: { include: { vehicle: true } } },
    orderBy: { createdAt: "desc" },
    skip,
    take,
  });

  return reservations.map((reservation) => ({
    id: reservation.id,
    configurationPublicId: reservation.configuration.publicId,
    vehicleSlug: reservation.configuration.vehicle.slug,
    amountCents: reservation.amountCents,
    currency: reservation.currency,
    status: reservation.status,
    createdAt: reservation.createdAt.toISOString(),
  }));
}

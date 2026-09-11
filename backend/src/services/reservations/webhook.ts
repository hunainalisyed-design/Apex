import type Stripe from "stripe";
import { prisma } from "../../lib/prisma.js";

/**
 * Marks the matching Reservation PAID (Spec 20, AC-3). Uses updateMany, not update — this
 * is what makes the handler idempotent against Stripe's at-least-once webhook delivery: a
 * retried checkout.session.completed event just re-applies the same update (0 or 1 rows
 * affected either way), never an error for "already PAID."
 *
 * If no row matches by stripeCheckoutSessionId (the createCheckoutSession's final
 * write-back never landed — see that file's own doc comment), falls back to
 * session.metadata.reservationId to self-heal: the session genuinely got paid, so the
 * Reservation row must be found and marked PAID one way or another, not silently orphaned.
 */
export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const bySessionId = await prisma.reservation.updateMany({
    where: { stripeCheckoutSessionId: session.id },
    data: { status: "PAID" },
  });

  if (bySessionId.count > 0) return;

  const reservationId = session.metadata?.reservationId;
  if (!reservationId) {
    console.error(
      `[reservations] checkout.session.completed for unknown session ${session.id} with no reservationId metadata to fall back on`,
    );
    return;
  }

  const byMetadata = await prisma.reservation.updateMany({
    where: { id: reservationId },
    data: { status: "PAID", stripeCheckoutSessionId: session.id },
  });

  if (byMetadata.count === 0) {
    console.error(
      `[reservations] checkout.session.completed for session ${session.id} — no Reservation row matched by session id or metadata.reservationId (${reservationId})`,
    );
  }
}

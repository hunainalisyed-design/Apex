import type Stripe from "stripe";
import { logger } from "../../lib/logger.js";
import { prisma } from "../../lib/prisma.js";

type TerminalStatus = "PAID" | "FAILED";

/**
 * Shared idempotent-update logic behind both handlers below: match by
 * stripeCheckoutSessionId first, falling back to session.metadata.reservationId to
 * self-heal if createCheckoutSession's write-back never landed (see that file's own doc
 * comment). Uses updateMany, not update, so a retried webhook delivery (Stripe's at-least-
 * once guarantee) re-applies the same update harmlessly instead of erroring.
 *
 * `fromStatus` guards the update to only apply from that current status — this is what
 * stops a late/out-of-order `checkout.session.expired` from clobbering a Reservation a
 * `checkout.session.completed` already marked PAID (Stripe won't fire both for the same
 * session, but the guard is cheap insurance against delivery reordering).
 */
async function applyTerminalStatus(
  session: Stripe.Checkout.Session,
  status: TerminalStatus,
  fromStatus: "PENDING",
  eventType: string,
): Promise<void> {
  const bySessionId = await prisma.reservation.updateMany({
    where: { stripeCheckoutSessionId: session.id, status: fromStatus },
    data: { status },
  });

  if (bySessionId.count > 0) return;

  const reservationId = session.metadata?.reservationId;
  if (!reservationId) {
    logger.error(
      { eventType, sessionId: session.id },
      "[reservations] Webhook event for unknown session with no reservationId metadata to fall back on",
    );
    return;
  }

  const byMetadata = await prisma.reservation.updateMany({
    where: { id: reservationId, status: fromStatus },
    data: { status, stripeCheckoutSessionId: session.id },
  });

  if (byMetadata.count === 0) {
    logger.error(
      { eventType, sessionId: session.id, reservationId, fromStatus },
      "[reservations] Webhook event — no Reservation row matched by session id or metadata.reservationId",
    );
  }
}

/** Marks the matching Reservation PAID (Spec 20, AC-3). */
export async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
  await applyTerminalStatus(session, "PAID", "PENDING", "checkout.session.completed");
}

/**
 * Marks the matching Reservation FAILED when the checkout session expires unpaid or an
 * async payment method fails (Spec 20, AC-4's "abandoned session" state) — without this,
 * FAILED was unreachable and an abandoned checkout left the Reservation stuck PENDING
 * forever, which the confirmation page's polling has no way to distinguish from "webhook
 * just hasn't landed yet." `eventType` is only for the error log, so it names whichever of
 * the two source events actually triggered it.
 */
export async function handleCheckoutSessionFailed(
  session: Stripe.Checkout.Session,
  eventType: "checkout.session.expired" | "checkout.session.async_payment_failed",
): Promise<void> {
  await applyTerminalStatus(session, "FAILED", "PENDING", eventType);
}

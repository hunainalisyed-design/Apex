import { logger } from "../../lib/logger.js";
import { getStripeClient } from "../../lib/stripe.js";
import { prisma } from "../../lib/prisma.js";
import type { CreateCheckoutSessionRequest } from "../../types/reservations.js";

// Spec 20 AC-2: a fixed deposit amount, not proportional to the vehicle's price. Money is
// always an integer number of cents (docs/CLAUDE.md convention).
const DEPOSIT_AMOUNT_CENTS = 50000; // €500
const DEPOSIT_CURRENCY = "eur";

export type CreateCheckoutSessionResult =
  | { ok: true; checkoutUrl: string }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "PROVIDER_ERROR" };

/**
 * Creates a Stripe Checkout Session for a deposit reservation (Spec 20, AC-2). Sequencing
 * matters here: the Reservation row is created FIRST (status PENDING, no session id yet),
 * because the Stripe session's own success_url needs to point at this row's id
 * (/reservations/{id}/confirmation per the spec's own route shape) — and that id can't be
 * known until the row exists. `metadata: {reservationId}` is also set on the session so the
 * webhook handler can self-heal if the final "write the session id back" update below never
 * lands (a crash or transient DB error between creating the Stripe session and this
 * function returning) — without it, a genuinely paid session could never be matched back to
 * its Reservation row.
 */
export async function createCheckoutSession(
  input: CreateCheckoutSessionRequest,
  userId: string | null,
): Promise<CreateCheckoutSessionResult> {
  const stripe = getStripeClient();
  if (!stripe) return { ok: false, reason: "PROVIDER_ERROR" };

  const configuration = await prisma.configuration.findUnique({
    where: { publicId: input.configurationPublicId },
    include: { vehicle: true },
  });
  if (!configuration) return { ok: false, reason: "NOT_FOUND" };

  const reservation = await prisma.reservation.create({
    data: {
      configurationId: configuration.id,
      userId,
      amountCents: DEPOSIT_AMOUNT_CENTS,
      currency: "EUR",
      status: "PENDING",
    },
  });

  const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: DEPOSIT_CURRENCY,
            product_data: { name: `Reservation deposit — ${configuration.vehicle.name}` },
            unit_amount: DEPOSIT_AMOUNT_CENTS,
          },
          quantity: 1,
        },
      ],
      success_url: `${frontendOrigin}/reservations/${reservation.id}/confirmation`,
      cancel_url: `${frontendOrigin}/configure/${configuration.vehicle.slug}?build=${configuration.publicId}`,
      metadata: { reservationId: reservation.id },
    });

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { stripeCheckoutSessionId: session.id },
    });

    if (!session.url) {
      // Stripe always returns a url for a "payment" mode session created this way — this is
      // defense-in-depth, not an expected path.
      return { ok: false, reason: "PROVIDER_ERROR" };
    }
    return { ok: true, checkoutUrl: session.url };
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : err },
      "[reservations] Failed to create Stripe checkout session",
    );
    // The Reservation row is left as-is — an abandoned-checkout-shaped PENDING state, the
    // same as a user who never completes Stripe's hosted page. Not worth special-casing.
    return { ok: false, reason: "PROVIDER_ERROR" };
  }
}

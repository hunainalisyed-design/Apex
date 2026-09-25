import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { sendApiError } from "../lib/apiError.js";
import { logger } from "../lib/logger.js";
import { getStripeClient } from "../lib/stripe.js";
import { optionalAuth } from "../middleware/auth.js";
import { reservationRateLimit } from "../middleware/rateLimit.js";
import { createCheckoutSession } from "../services/reservations/createCheckoutSession.js";
import { getReservationById } from "../services/reservations/getReservation.js";
import { handleCheckoutSessionCompleted, handleCheckoutSessionFailed } from "../services/reservations/webhook.js";
import type { ApiResponse } from "../types/api.js";
import type { CheckoutSessionDto, CreateCheckoutSessionRequest, ReservationDto } from "../types/reservations.js";

export const reservationsRouter = Router();

reservationsRouter.post("/reservations/checkout-session", reservationRateLimit, optionalAuth, async (req, res) => {
  if (process.env.RESERVATIONS_ENABLED === "false") {
    sendApiError(res, 503, "RESERVATIONS_DISABLED", "Reservations are temporarily unavailable.");
    return;
  }

  const body = req.body as Partial<CreateCheckoutSessionRequest> | undefined;
  if (!body || typeof body.configurationPublicId !== "string" || !body.configurationPublicId) {
    sendApiError(res, 400, "VALIDATION_ERROR", "configurationPublicId is required.");
    return;
  }

  const result = await createCheckoutSession(
    { configurationPublicId: body.configurationPublicId },
    req.user?.id ?? null,
  );

  if (!result.ok) {
    if (result.reason === "NOT_FOUND") {
      sendApiError(res, 404, "CONFIGURATION_NOT_FOUND", "No configuration matches this ID.");
      return;
    }
    sendApiError(res, 502, "PAYMENT_PROVIDER_ERROR", "We couldn't start checkout. Please try again in a moment.");
    return;
  }

  const responseBody: ApiResponse<CheckoutSessionDto> = { data: { checkoutUrl: result.checkoutUrl } };
  res.status(200).json(responseBody);
});

reservationsRouter.get("/reservations/:id", async (req, res) => {
  const reservation = await getReservationById(req.params.id);

  if (!reservation) {
    sendApiError(res, 404, "RESERVATION_NOT_FOUND", "No reservation matches this ID.");
    return;
  }

  const responseBody: ApiResponse<ReservationDto> = { data: reservation };
  res.status(200).json(responseBody);
});

/**
 * Stripe's webhook receiver (Spec 20, AC-3/AC-5) — deliberately NOT part of
 * reservationsRouter above. This needs the raw, unparsed request body to verify Stripe's
 * signature; app.ts mounts it directly with its own express.raw() body parser, BEFORE the
 * app-wide express.json() would otherwise consume it. Kept here (not inline in app.ts) so
 * the actual logic stays with the rest of this file's routes — only the mounting is special.
 */
export async function reservationsWebhookHandler(req: Request, res: Response): Promise<void> {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    logger.error("[reservations] Webhook received but Stripe isn't configured");
    res.status(503).end();
    return;
  }

  const signature = req.headers["stripe-signature"];
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature as string, webhookSecret);
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : err },
      "[reservations] Webhook signature verification failed",
    );
    res.status(400).end();
    return;
  }

  logger.info({ eventType: event.type }, "[reservations] Received webhook event");

  if (event.type === "checkout.session.completed") {
    await handleCheckoutSessionCompleted(event.data.object);
  } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    await handleCheckoutSessionFailed(event.data.object, event.type);
  }

  // Every event type is acknowledged with 200, even ones we don't act on — standard Stripe
  // practice, avoids needless retries for events outside our concern.
  res.status(200).end();
}

import Stripe from "stripe";

/** Lazy-singleton Stripe client (Spec 20), mirroring lib/email.ts's shape — but unlike
 * email, there's no graceful-degradation story for "create a reservation but skip Stripe":
 * a missing key with RESERVATIONS_ENABLED still true is a genuine provider error, handled
 * explicitly by callers (502 PAYMENT_PROVIDER_ERROR) rather than silently no-opping. */
let client: Stripe | null = null;
export function getStripeClient(): Stripe | null {
  if (client) return client;
  if (!process.env.STRIPE_SECRET_KEY) return null;
  client = new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

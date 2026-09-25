export interface CreateCheckoutSessionRequest {
  configurationPublicId: string;
}

export interface ReservationDto {
  id: string;
  configurationPublicId: string;
  vehicleSlug: string;
  amountCents: number;
  currency: string;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  createdAt: string;
}

/** POST /reservations/checkout-session response — the Stripe-hosted checkout page to redirect to. */
export interface CheckoutSessionDto {
  checkoutUrl: string;
}

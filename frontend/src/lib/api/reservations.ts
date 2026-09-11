import type { CreateCheckoutSessionRequest, ReservationDto } from "@/types/reservations";
import { ApiRequestError } from "./configurations";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** credentials:"include" so optionalAuth can attribute the reservation to a signed-in user
 * server-side (Spec 20), same requirement Spec 19's createLead has. */
export async function createCheckoutSession(request: CreateCheckoutSessionRequest): Promise<{ checkoutUrl: string }> {
  const res = await fetch(`${API_BASE_URL}/api/reservations/checkout-session`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(json.code ?? "UNKNOWN_ERROR", json.message ?? "Something went wrong.", json.details);
  }
  return json.data as { checkoutUrl: string };
}

/** For the return page (Spec 20, AC-4) — no auth required, matches the backend's own
 * contract. */
export async function getReservation(id: string): Promise<ReservationDto> {
  const res = await fetch(`${API_BASE_URL}/api/reservations/${id}`, { cache: "no-store" });

  const json = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(json.code ?? "UNKNOWN_ERROR", json.message ?? "Something went wrong.");
  }
  return json.data as ReservationDto;
}

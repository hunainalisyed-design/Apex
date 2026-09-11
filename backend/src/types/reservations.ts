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

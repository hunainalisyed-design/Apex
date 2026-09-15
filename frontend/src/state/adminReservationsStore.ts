import { create } from "zustand";
import { listReservations } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/configurations";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import type { ReservationDto } from "@/types/reservations";

export type AdminReservationsStatus = "idle" | "loading" | "success" | "error";

export interface AdminReservationsState {
  status: AdminReservationsStatus;
  reservations: ReservationDto[];
  error: string | null;
  load: () => Promise<void>;
}

/** Admin reservation list — read-only (Spec 21 AC-5): status only ever changes via the
 * Stripe webhook, so there's no mutation here on purpose. */
export const useAdminReservationsStore = create<AdminReservationsState>((set) => ({
  status: "idle",
  reservations: [],
  error: null,

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const reservations = await listReservations();
      set({ status: "success", reservations });
    } catch (err) {
      set({ status: "error", error: getErrorMessage(err instanceof ApiRequestError ? err.code : undefined) });
    }
  },
}));

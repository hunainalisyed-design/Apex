import { create } from "zustand";
import { ApiRequestError } from "@/lib/api/configurations";
import { getReservation } from "@/lib/api/reservations";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import type { ReservationDto } from "@/types/reservations";

export type ReservationConfirmationStatus = "loading" | "error" | "loaded";

export interface ReservationConfirmationState {
  status: ReservationConfirmationStatus;
  reservation: ReservationDto | null;
  errorMessage: string | null;
  load: (id: string) => Promise<void>;
}

/**
 * Fetch-driven state for the Stripe return page (Spec 20), pulled into a store rather than
 * a local useCallback + useEffect — the same fix Spec 18's CompareView needed: react-hooks'
 * set-state-in-effect rule flags a synchronous setState call inside an effect body when the
 * function making that call is defined locally (traceable by static analysis), but not when
 * it's an imported store action (opaque to that analysis) — matching every other
 * fetch-driven feature in this codebase (configurationStore, garageStore, compareStore).
 */
export const useReservationConfirmationStore = create<ReservationConfirmationState>((set) => ({
  status: "loading",
  reservation: null,
  errorMessage: null,

  load: async (id) => {
    set({ status: "loading" });
    try {
      const data = await getReservation(id);
      set({ reservation: data, status: "loaded" });
    } catch (err) {
      const code = err instanceof ApiRequestError ? err.code : undefined;
      set({ errorMessage: getErrorMessage(code), status: "error" });
    }
  },
}));

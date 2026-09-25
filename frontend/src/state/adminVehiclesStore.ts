import { create } from "zustand";
import { createVehicle, listVehicles, updateVehicle } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/configurations";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import type { CreateVehicleRequest, UpdateVehicleRequest, VehicleAdminDto } from "@/types/admin";

export type AdminVehiclesStatus = "idle" | "loading" | "success" | "error";

export interface AdminVehiclesState {
  status: AdminVehiclesStatus;
  vehicles: VehicleAdminDto[];
  error: string | null;
  isSaving: boolean;
  saveError: string | null;
  /** Field-specific validation messages from the last failed save (e.g. Spec 25's
   * unversioned asset URL), shown inline on the matching FormField — authStore's pattern. */
  saveErrorDetails: Record<string, string[]> | null;
  load: () => Promise<void>;
  create: (request: CreateVehicleRequest) => Promise<boolean>;
  update: (id: string, request: UpdateVehicleRequest) => Promise<boolean>;
}

/** Admin vehicle list/create/edit (Spec 21 AC-2) — matches this codebase's plain
 * global-Zustand-store-per-concern convention (garageStore, configurationStore). */
export const useAdminVehiclesStore = create<AdminVehiclesState>((set, get) => ({
  status: "idle",
  vehicles: [],
  error: null,
  isSaving: false,
  saveError: null,
  saveErrorDetails: null,

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const vehicles = await listVehicles();
      set({ status: "success", vehicles });
    } catch (err) {
      set({ status: "error", error: getErrorMessage(err instanceof ApiRequestError ? err.code : undefined) });
    }
  },

  create: async (request) => {
    set({ isSaving: true, saveError: null, saveErrorDetails: null });
    try {
      const vehicle = await createVehicle(request);
      set({ vehicles: [...get().vehicles, vehicle], isSaving: false });
      return true;
    } catch (err) {
      set({
        isSaving: false,
        saveError: getErrorMessage(err instanceof ApiRequestError ? err.code : undefined),
        saveErrorDetails: err instanceof ApiRequestError ? (err.details ?? null) : null,
      });
      return false;
    }
  },

  update: async (id, request) => {
    set({ isSaving: true, saveError: null, saveErrorDetails: null });
    try {
      const vehicle = await updateVehicle(id, request);
      set({ vehicles: get().vehicles.map((v) => (v.id === vehicle.id ? vehicle : v)), isSaving: false });
      return true;
    } catch (err) {
      set({
        isSaving: false,
        saveError: getErrorMessage(err instanceof ApiRequestError ? err.code : undefined),
        saveErrorDetails: err instanceof ApiRequestError ? (err.details ?? null) : null,
      });
      return false;
    }
  },
}));

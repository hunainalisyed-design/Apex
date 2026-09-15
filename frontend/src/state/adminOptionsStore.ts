import { create } from "zustand";
import { createOption, deactivateOption, listOptions, updateOption } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/configurations";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import type { CreateOptionRequest, OptionAdminDto, UpdateOptionRequest } from "@/types/admin";

export type AdminOptionsStatus = "idle" | "loading" | "success" | "error";

export interface AdminOptionsState {
  vehicleId: string | null;
  status: AdminOptionsStatus;
  options: OptionAdminDto[];
  error: string | null;
  isSaving: boolean;
  saveError: string | null;
  loadForVehicle: (vehicleId: string) => Promise<void>;
  create: (request: CreateOptionRequest) => Promise<boolean>;
  update: (id: string, request: UpdateOptionRequest) => Promise<boolean>;
  deactivate: (id: string) => Promise<boolean>;
}

/** Admin CustomizationOption list/create/edit/deactivate (Spec 21 AC-3), scoped to one
 * vehicle at a time (whichever the admin is currently managing in VehicleTable). Mutations
 * re-fetch the full list for that vehicle rather than patching it in place — simpler and
 * always-correct given the single-default-invariant checks that can silently affect a
 * sibling row's isDefault, matching this spec's own "functional clarity over polish" UI
 * guidance for an internal tool. */
export const useAdminOptionsStore = create<AdminOptionsState>((set, get) => ({
  vehicleId: null,
  status: "idle",
  options: [],
  error: null,
  isSaving: false,
  saveError: null,

  loadForVehicle: async (vehicleId) => {
    set({ vehicleId, status: "loading", error: null });
    try {
      const options = await listOptions(vehicleId);
      // A later call for a different vehicle may have already landed first — don't clobber it.
      if (get().vehicleId !== vehicleId) return;
      set({ status: "success", options });
    } catch (err) {
      if (get().vehicleId !== vehicleId) return;
      set({ status: "error", error: getErrorMessage(err instanceof ApiRequestError ? err.code : undefined) });
    }
  },

  create: async (request) => {
    const { vehicleId } = get();
    if (!vehicleId) return false;
    set({ isSaving: true, saveError: null });
    try {
      await createOption(vehicleId, request);
      await get().loadForVehicle(vehicleId);
      set({ isSaving: false });
      return true;
    } catch (err) {
      set({ isSaving: false, saveError: getErrorMessage(err instanceof ApiRequestError ? err.code : undefined) });
      return false;
    }
  },

  update: async (id, request) => {
    const { vehicleId } = get();
    if (!vehicleId) return false;
    set({ isSaving: true, saveError: null });
    try {
      await updateOption(id, request);
      await get().loadForVehicle(vehicleId);
      set({ isSaving: false });
      return true;
    } catch (err) {
      set({ isSaving: false, saveError: getErrorMessage(err instanceof ApiRequestError ? err.code : undefined) });
      return false;
    }
  },

  deactivate: async (id) => {
    const { vehicleId } = get();
    if (!vehicleId) return false;
    set({ isSaving: true, saveError: null });
    try {
      await deactivateOption(id);
      await get().loadForVehicle(vehicleId);
      set({ isSaving: false });
      return true;
    } catch (err) {
      set({ isSaving: false, saveError: getErrorMessage(err instanceof ApiRequestError ? err.code : undefined) });
      return false;
    }
  },
}));

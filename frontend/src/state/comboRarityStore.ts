import { create } from "zustand";
import { getComboRarity } from "@/lib/api/comboRarity";
import type { ComboRarityDto } from "@/types/comboRarity";

export interface ComboRarityState {
  /** Which vehicle + build `data` was fetched for — a stale answer is never shown for another. */
  vehicleSlug: string | null;
  buildPublicId: string | null;
  data: ComboRarityDto | null;
  load: (vehicleSlug: string, buildPublicId: string | null) => Promise<void>;
}

let latestRequest = 0;

/** The configurator's rarity data (Spec 32): fetched once per vehicle (and again when a
 * different saved build is loaded), then matched locally as paint/wheels change. */
export const useComboRarityStore = create<ComboRarityState>((set, get) => ({
  vehicleSlug: null,
  buildPublicId: null,
  data: null,

  load: async (vehicleSlug, buildPublicId) => {
    const state = get();
    if (state.vehicleSlug === vehicleSlug && state.buildPublicId === buildPublicId && state.data) return;
    const request = ++latestRequest;
    set({ vehicleSlug, buildPublicId, data: null });
    const data = await getComboRarity(vehicleSlug, buildPublicId);
    if (request !== latestRequest) return;
    set({ data });
  },
}));

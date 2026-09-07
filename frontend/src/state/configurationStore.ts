import { create } from "zustand";
import { MULTI_SELECT_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "@/types/catalog";
import type { VehicleDetailDto } from "@/types/catalog";
import type { SavedConfigurationDto } from "@/types/configuration";
import type { MultiSelectCategory, SingleSelectCategory } from "@/types/pricing";

export function emptySingleSelections(): Record<SingleSelectCategory, string> {
  return Object.fromEntries(
    SINGLE_SELECT_CATEGORIES.map((c): [SingleSelectCategory, string] => [c, ""]),
  ) as Record<SingleSelectCategory, string>;
}

export function emptyMultiSelections(): Record<MultiSelectCategory, string[]> {
  return Object.fromEntries(
    MULTI_SELECT_CATEGORIES.map((c): [MultiSelectCategory, string[]] => [c, []]),
  ) as Record<MultiSelectCategory, string[]>;
}

interface Defaults {
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
}

function buildDefaultsFromVehicle(vehicle: VehicleDetailDto): Defaults {
  const singleSelections = emptySingleSelections();
  for (const category of SINGLE_SELECT_CATEGORIES) {
    const options = vehicle.options[category] ?? [];
    const defaultOption = options.find((o) => o.isDefault) ?? options[0];
    singleSelections[category] = defaultOption?.id ?? "";
  }

  return {
    vehicleSlug: vehicle.slug,
    singleSelections,
    multiSelections: emptyMultiSelections(),
  };
}

export interface ConfigurationState {
  vehicleSlug: string;
  /** One CustomizationOption id per single-select category (16 keys, Spec 2). */
  singleSelections: Record<SingleSelectCategory, string>;
  /** Set only when singleSelections.PAINT is the reserved custom-color option id. */
  customPaintHex: string | null;
  /** Zero or more CustomizationOption ids per multi-select category. */
  multiSelections: Record<MultiSelectCategory, string[]>;

  setSingleSelection: (category: SingleSelectCategory, optionId: string) => void;
  setCustomPaintHex: (hex: string) => void;
  toggleMultiSelection: (category: MultiSelectCategory, optionId: string) => void;
  /** Hydrates every category from the vehicle's isDefault options — called on showroom
   * mount and on every reload (AC-10), never leaving a category empty/undefined. */
  hydrateDefaults: (vehicle: VehicleDetailDto) => void;
  /** Hydrates from a previously saved configuration (Spec 10, AC-4) instead of vehicle
   * defaults. Still computes and stores the vehicle's own defaults internally so reset()
   * continues reverting to vehicle defaults, never back to this loaded build (AC-8). */
  hydrateFromSaved: (vehicle: VehicleDetailDto, saved: SavedConfigurationDto) => void;
  reset: () => void;
}

/**
 * The canonical client-side configuration store (Spec 6, reused verbatim by Specs 7-10).
 * A single module-level Zustand store — re-hydrated via hydrateDefaults on vehicle mount/
 * change, which is enough to keep it correctly scoped per showroom session without a
 * fancier per-vehicle-keyed store instance.
 */
export const useConfigurationStore = create<ConfigurationState>((set) => {
  let defaults: Defaults = {
    vehicleSlug: "",
    singleSelections: emptySingleSelections(),
    multiSelections: emptyMultiSelections(),
  };

  return {
    vehicleSlug: "",
    singleSelections: emptySingleSelections(),
    customPaintHex: null,
    multiSelections: emptyMultiSelections(),

    setSingleSelection: (category, optionId) =>
      set((state) => ({
        singleSelections: { ...state.singleSelections, [category]: optionId },
        // Selecting any paint option (including re-selecting Custom Color) clears the
        // previous custom hex; the custom color picker sets a fresh one right after.
        customPaintHex: category === "PAINT" ? null : state.customPaintHex,
      })),

    setCustomPaintHex: (hex) => set({ customPaintHex: hex }),

    toggleMultiSelection: (category, optionId) =>
      set((state) => {
        const current = state.multiSelections[category];
        const next = current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId];
        return { multiSelections: { ...state.multiSelections, [category]: next } };
      }),

    hydrateDefaults: (vehicle) => {
      defaults = buildDefaultsFromVehicle(vehicle);
      set({
        vehicleSlug: defaults.vehicleSlug,
        singleSelections: defaults.singleSelections,
        multiSelections: defaults.multiSelections,
        customPaintHex: null,
      });
    },

    hydrateFromSaved: (vehicle, saved) => {
      defaults = buildDefaultsFromVehicle(vehicle);
      set({
        vehicleSlug: vehicle.slug,
        singleSelections: saved.singleSelections,
        multiSelections: saved.multiSelections,
        customPaintHex: saved.customPaintHex,
      });
    },

    reset: () =>
      set({
        vehicleSlug: defaults.vehicleSlug,
        singleSelections: defaults.singleSelections,
        multiSelections: defaults.multiSelections,
        customPaintHex: null,
      }),
  };
});

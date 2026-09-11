import { create } from "zustand";
import { ApiRequestError, claimConfiguration, saveConfiguration } from "@/lib/api/configurations";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import { MULTI_SELECT_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "@/types/catalog";
import type { VehicleDetailDto } from "@/types/catalog";
import type { SavedConfigurationDto } from "@/types/configuration";
import type { MultiSelectCategory, SingleSelectCategory } from "@/types/pricing";

export type SaveStatus = "idle" | "saving" | "success" | "error";

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

export interface Defaults {
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
}

/** Exported for Spec 18's Car Comparison view, which needs each compared vehicle's default
 * selections to resolve its appearance directly (via resolveExteriorAppearance et al.)
 * WITHOUT going through useConfigurationStore — that store is a single module-level
 * singleton, so calling hydrateDefaults() twice (once per compared vehicle) would silently
 * clobber one vehicle's selections with the other's. This function has no such problem:
 * it's a pure read of a vehicle's own catalog data. */
export function buildDefaultsFromVehicle(vehicle: VehicleDetailDto): Defaults {
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

  /** Save state (Spec 10), lifted here rather than kept local to SaveSharePanel (Spec 11):
   * both SaveSharePanel and CaptureBuild need to read/write the SAME "what was last saved"
   * record to avoid two independently-triggered saves producing two different publicIds
   * for what the user perceives as one save, and to know whether a redundant save can be
   * skipped (AC-1/AC-2 of Spec 11). */
  saveStatus: SaveStatus;
  savedConfiguration: SavedConfigurationDto | null;
  saveError: string | null;

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
  /** Saves the current selections, updating saveStatus/savedConfiguration/saveError.
   * Re-throws on failure so a caller (e.g. Spec 11's capture flow) can also await it
   * directly without duplicating error handling. */
  save: () => Promise<SavedConfigurationDto>;
  /** True when the current selections differ from savedConfiguration (or nothing has been
   * saved yet) — the basis for Spec 11 AC-1/AC-2's "skip a redundant save." */
  isDirtySinceLastSave: () => boolean;
  /** Claims the currently-loaded unowned build for the signed-in caller (Spec 17, AC-7).
   * Lives here rather than garageStore because it operates on the single build loaded into
   * this configurator session, not the garage list. Replaces savedConfiguration with the
   * now-owned dto on success so the "Save to My Garage" affordance disappears reactively. */
  claim: () => Promise<void>;
}

/**
 * The canonical client-side configuration store (Spec 6, reused verbatim by Specs 7-10).
 * A single module-level Zustand store — re-hydrated via hydrateDefaults on vehicle mount/
 * change, which is enough to keep it correctly scoped per showroom session without a
 * fancier per-vehicle-keyed store instance.
 */
export const useConfigurationStore = create<ConfigurationState>((set, get) => {
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
    saveStatus: "idle",
    savedConfiguration: null,
    saveError: null,

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
        // A freshly-loaded/defaulted vehicle has no save context of its own — any prior
        // savedConfiguration would belong to a different vehicle/session.
        saveStatus: "idle",
        savedConfiguration: null,
        saveError: null,
      });
    },

    hydrateFromSaved: (vehicle, saved) => {
      defaults = buildDefaultsFromVehicle(vehicle);
      set({
        vehicleSlug: vehicle.slug,
        singleSelections: saved.singleSelections,
        multiSelections: saved.multiSelections,
        customPaintHex: saved.customPaintHex,
        // Loading a shared build means the current selections already match a real saved
        // row — record that immediately so isDirtySinceLastSave() is correct before the
        // user changes anything (Spec 11 AC-2).
        saveStatus: "success",
        savedConfiguration: saved,
        saveError: null,
      });
    },

    reset: () =>
      set({
        vehicleSlug: defaults.vehicleSlug,
        singleSelections: defaults.singleSelections,
        multiSelections: defaults.multiSelections,
        customPaintHex: null,
        // savedConfiguration/saveStatus are deliberately left untouched — Reset never
        // deletes or forgets an already-saved row (Spec 10 AC-8), and if the user resets
        // back to exactly what was last saved, isDirtySinceLastSave() should correctly
        // recognize that via comparison rather than needing to be told.
      }),

    save: async () => {
      const state = get();
      set({ saveStatus: "saving", saveError: null });
      try {
        const saved = await saveConfiguration({
          vehicleSlug: state.vehicleSlug,
          singleSelections: state.singleSelections,
          multiSelections: state.multiSelections,
          customPaintHex: state.customPaintHex,
        });
        set({ saveStatus: "success", savedConfiguration: saved, saveError: null });
        return saved;
      } catch (err) {
        const message = getErrorMessage(err instanceof ApiRequestError ? err.code : undefined);
        set({ saveStatus: "error", saveError: message });
        throw err;
      }
    },

    isDirtySinceLastSave: () => {
      const state = get();
      const saved = state.savedConfiguration;
      if (!saved) return true;
      return (
        JSON.stringify(state.singleSelections) !== JSON.stringify(saved.singleSelections) ||
        JSON.stringify(state.multiSelections) !== JSON.stringify(saved.multiSelections) ||
        state.customPaintHex !== saved.customPaintHex
      );
    },

    claim: async () => {
      const publicId = get().savedConfiguration?.publicId;
      if (!publicId) return;
      const claimed = await claimConfiguration(publicId);
      set({ savedConfiguration: claimed });
    },
  };
});

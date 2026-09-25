import { create } from "zustand";
import { getVehicleDetail, getVehicles } from "@/lib/api/vehicles";
import { resolveInitialPair } from "@/lib/compare/compareState";
import { resolveAccessoryAppearance } from "@/lib/showroom/accessoryAppearance";
import { resolveExteriorAppearance } from "@/lib/showroom/exteriorAppearance";
import { resolveInteriorAppearance } from "@/lib/showroom/interiorAppearance";
import type { VehicleDetailDto, VehicleSummaryDto } from "@/types/catalog";
import type { CompareVehicleAppearance } from "@/components/compare/CompareScene";
import { buildDefaultsFromVehicle } from "./configurationStore";

export type CompareStatus = "loading" | "error" | "success";
export type CompareViewMode = "table" | "3d";

/** A vehicle's own default (non-customized) appearance, resolved directly rather than via
 * useConfigurationStore — that store is a single module-level singleton, so hydrating it
 * twice (once per compared vehicle) would clobber one vehicle's selections with the
 * other's. buildDefaultsFromVehicle + the resolve* functions are pure, so this is safe to
 * call for both sides independently (Spec 18). */
function resolveDefaultAppearance(vehicle: VehicleDetailDto): CompareVehicleAppearance {
  const defaults = buildDefaultsFromVehicle(vehicle);
  const appearance = resolveExteriorAppearance(vehicle, defaults.singleSelections, null);
  const interior = resolveInteriorAppearance(vehicle, defaults.singleSelections);
  const accessories = resolveAccessoryAppearance(vehicle, defaults.multiSelections, appearance.paintColor);
  // The slug travels with the appearance it was resolved from, rather than CompareScene
  // reading leftSlug/rightSlug separately: that makes it structurally impossible for a slot
  // to render one vehicle's model wearing another vehicle's resolved paint/interior.
  return { slug: vehicle.slug, appearance, interior, accessories };
}

export interface CompareState {
  status: CompareStatus;
  vehicles: VehicleSummaryDto[];
  leftSlug: string;
  rightSlug: string;
  view: CompareViewMode;
  threeDUnavailable: boolean;
  leftAppearance: CompareVehicleAppearance | null;
  rightAppearance: CompareVehicleAppearance | null;
  detailsLoading: boolean;
  /** Fetches GET /api/vehicles and resolves the initial pair from ?left=/?right= (Spec 18,
   * AC-1/AC-3) via the pure resolveInitialPair. */
  load: (initialLeftSlug?: string, initialRightSlug?: string) => Promise<void>;
  /** Sets both sides at once (a single-side change still passes the other's current
   * value) — clears any already-resolved 3D appearance, since it belonged to the old pair. */
  setPair: (left: string, right: string) => void;
  setView: (view: CompareViewMode) => void;
  /** Reverts to the table view and disables the 3D toggle going forward (AC-6) — shared by
   * CompareSceneErrorBoundary's onError and a failed vehicle-detail fetch below, which the
   * boundary itself can never see since that fetch happens before CompareScene is even
   * given props. */
  handle3DFailure: () => void;
  /** Lazily fetches each selected vehicle's full detail (Spec 17's getVehicleDetail) only
   * once the 3D view is actually requested — most visits never open it. */
  loadDetails: () => Promise<void>;
}

/**
 * Car Comparison state (Spec 18) — a plain global Zustand store, matching this codebase's
 * established convention for any fetch-driven feature (configurationStore, garageStore,
 * authStore, carAiChatStore) rather than local component state with a component-scoped
 * useCallback, which trips react-hooks' set-state-in-effect rule the moment an effect's own
 * synchronous setState call is visible to static analysis — a store action is opaque to
 * that analysis the same way it already is for every one of those other stores.
 */
export const useCompareStore = create<CompareState>((set, get) => ({
  status: "loading",
  vehicles: [],
  leftSlug: "",
  rightSlug: "",
  view: "table",
  threeDUnavailable: false,
  leftAppearance: null,
  rightAppearance: null,
  detailsLoading: false,

  load: async (initialLeftSlug, initialRightSlug) => {
    set({ status: "loading" });
    const list = await getVehicles();
    if (list.length < 2) {
      set({ status: "error" });
      return;
    }
    const pair = resolveInitialPair(list, initialLeftSlug, initialRightSlug);
    set({ vehicles: list, leftSlug: pair.left, rightSlug: pair.right, status: "success" });
  },

  setPair: (left, right) => set({ leftSlug: left, rightSlug: right, leftAppearance: null, rightAppearance: null }),

  setView: (view) => set({ view }),

  handle3DFailure: () => set({ view: "table", threeDUnavailable: true }),

  loadDetails: async () => {
    const { leftSlug, rightSlug, handle3DFailure } = get();
    if (!leftSlug || !rightSlug) return;

    set({ detailsLoading: true });
    const [left, right] = await Promise.all([getVehicleDetail(leftSlug), getVehicleDetail(rightSlug)]);
    set({ detailsLoading: false });

    if (!left || !right) {
      handle3DFailure();
      return;
    }
    set({ leftAppearance: resolveDefaultAppearance(left), rightAppearance: resolveDefaultAppearance(right) });
  },
}));

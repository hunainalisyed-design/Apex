import { create } from "zustand";
import { ApiRequestError, deleteConfiguration as deleteConfigurationApi } from "@/lib/api/configurations";
import { unpublishBuild } from "@/lib/api/gallery";
import { getMyConfigurations } from "@/lib/api/me";
import { getVehicleDetail } from "@/lib/api/vehicles";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import type { VehicleDetailDto } from "@/types/catalog";
import type { SavedConfigurationDto } from "@/types/configuration";

export type GarageStatus = "idle" | "loading" | "success" | "error";

export interface GarageState {
  status: GarageStatus;
  configurations: SavedConfigurationDto[];
  vehiclesBySlug: Record<string, VehicleDetailDto>;
  error: string | null;
  /** Keyed by publicId, not a single flag — concurrent/sequential deletes across different
   * cards must never clobber each other's pending/error state (Spec 17 §5's "no optimistic
   * removal" UI-states row). */
  deletingPublicIds: Record<string, boolean>;
  deleteErrors: Record<string, string>;
  /** Spec 31 — per card, like the delete state above. */
  unpublishingPublicIds: Record<string, boolean>;
  unpublishErrors: Record<string, string>;
  load: () => Promise<void>;
  deleteConfiguration: (publicId: string) => Promise<boolean>;
  /** Takes the build out of the public gallery (Spec 31, AC-6) and updates its card. */
  unpublish: (publicId: string) => Promise<void>;
}

/**
 * The garage list (Spec 17) — a plain global Zustand store, matching this codebase's
 * established convention (configurationStore, carAiChatStore, authStore) rather than React
 * Context. Owns only the list; profile/password live on authStore (an identity concern),
 * and claiming the currently-loaded single build lives on configurationStore.
 */
export const useGarageStore = create<GarageState>((set) => ({
  status: "idle",
  configurations: [],
  vehiclesBySlug: {},
  error: null,
  deletingPublicIds: {},
  deleteErrors: {},
  unpublishingPublicIds: {},
  unpublishErrors: {},

  load: async () => {
    set({ status: "loading", error: null });
    try {
      const configurations = await getMyConfigurations();

      const uniqueSlugs = [...new Set(configurations.map((c) => c.vehicleSlug))];
      const vehicles = await Promise.all(uniqueSlugs.map((slug) => getVehicleDetail(slug)));

      const vehiclesBySlug: Record<string, VehicleDetailDto> = {};
      uniqueSlugs.forEach((slug, index) => {
        const vehicle = vehicles[index];
        if (vehicle) vehiclesBySlug[slug] = vehicle;
      });

      set({ status: "success", configurations, vehiclesBySlug });
    } catch (err) {
      const message = getErrorMessage(err instanceof ApiRequestError ? err.code : undefined);
      set({ status: "error", error: message });
    }
  },

  unpublish: async (publicId) => {
    set((state) => {
      const { [publicId]: _cleared, ...remainingErrors } = state.unpublishErrors;
      return { unpublishingPublicIds: { ...state.unpublishingPublicIds, [publicId]: true }, unpublishErrors: remainingErrors };
    });
    try {
      const status = await unpublishBuild(publicId);
      set((state) => ({
        configurations: state.configurations.map((c) =>
          c.publicId === publicId ? { ...c, isPublished: status.isPublished, publishedAt: status.publishedAt } : c,
        ),
        unpublishingPublicIds: { ...state.unpublishingPublicIds, [publicId]: false },
      }));
    } catch (err) {
      const message = getErrorMessage(err instanceof ApiRequestError ? err.code : undefined);
      set((state) => ({
        unpublishingPublicIds: { ...state.unpublishingPublicIds, [publicId]: false },
        unpublishErrors: { ...state.unpublishErrors, [publicId]: message },
      }));
    }
  },

  deleteConfiguration: async (publicId) => {
    set((state) => {
      const { [publicId]: _cleared, ...remainingErrors } = state.deleteErrors;
      return {
        deletingPublicIds: { ...state.deletingPublicIds, [publicId]: true },
        deleteErrors: remainingErrors,
      };
    });

    try {
      await deleteConfigurationApi(publicId);
      set((state) => ({
        configurations: state.configurations.filter((c) => c.publicId !== publicId),
        deletingPublicIds: { ...state.deletingPublicIds, [publicId]: false },
      }));
      return true;
    } catch (err) {
      const message = getErrorMessage(err instanceof ApiRequestError ? err.code : undefined);
      set((state) => ({
        deletingPublicIds: { ...state.deletingPublicIds, [publicId]: false },
        deleteErrors: { ...state.deleteErrors, [publicId]: message },
      }));
      return false;
    }
  },
}));

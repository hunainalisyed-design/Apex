import { create } from "zustand";
import { unpublishGalleryEntry } from "@/lib/api/admin";
import { ApiRequestError } from "@/lib/api/configurations";
import { fetchGallery } from "@/lib/api/gallery";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import type { GalleryEntryDto } from "@/types/gallery";

export type AdminGalleryStatus = "idle" | "loading" | "success" | "error";

export interface AdminGalleryState {
  status: AdminGalleryStatus;
  entries: GalleryEntryDto[];
  page: number;
  hasMore: boolean;
  error: string | null;
  removingId: string | null;
  rowError: { publicId: string; message: string } | null;
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  unpublish: (publicId: string) => Promise<void>;
}

function errorMessageOf(err: unknown): string {
  return getErrorMessage(err instanceof ApiRequestError ? err.code : undefined);
}

/** Admin gallery moderation (Spec 31, Risk #1): what's published, newest first, and Unpublish. */
export const useAdminGalleryStore = create<AdminGalleryState>((set, get) => ({
  status: "idle",
  entries: [],
  page: 1,
  hasMore: false,
  error: null,
  removingId: null,
  rowError: null,

  load: async () => {
    set({ status: "loading", error: null, rowError: null });
    try {
      const result = await fetchGallery("recent", 1);
      set({
        status: "success",
        entries: result.entries,
        page: result.page,
        hasMore: result.hasMore,
      });
    } catch (err) {
      set({ status: "error", error: errorMessageOf(err) });
    }
  },

  loadMore: async () => {
    try {
      const result = await fetchGallery("recent", get().page + 1);
      set((state) => {
        const seen = new Set(state.entries.map((entry) => entry.publicId));
        return {
          entries: [...state.entries, ...result.entries.filter((entry) => !seen.has(entry.publicId))],
          page: result.page,
          hasMore: result.hasMore,
        };
      });
    } catch (err) {
      set({ status: "error", error: errorMessageOf(err) });
    }
  },

  unpublish: async (publicId) => {
    set({ removingId: publicId, rowError: null });
    try {
      await unpublishGalleryEntry(publicId);
      set((state) => ({
        entries: state.entries.filter((entry) => entry.publicId !== publicId),
        removingId: null,
      }));
    } catch (err) {
      set({
        removingId: null,
        rowError: { publicId, message: errorMessageOf(err) },
      });
    }
  },
}));

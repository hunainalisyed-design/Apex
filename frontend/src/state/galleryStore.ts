import { create } from "zustand";
import { ApiRequestError } from "@/lib/api/configurations";
import { fetchGallery, toggleLike as toggleLikeApi, type GallerySort } from "@/lib/api/gallery";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import type { GalleryEntryDto } from "@/types/gallery";

export type GalleryStatus = "idle" | "loading" | "success" | "error";

export interface GalleryState {
  sort: GallerySort;
  entries: GalleryEntryDto[];
  page: number;
  hasMore: boolean;
  status: GalleryStatus;
  error: string | null;
  loadingMore: boolean;
  loadMoreError: string | null;
  /** Keyed by publicId — one in-flight like per card; other cards stay clickable. */
  pendingLikes: Record<string, boolean>;
  /** Reloads page 1 of the current sort. */
  load: () => Promise<void>;
  loadMore: () => Promise<void>;
  setSort: (sort: GallerySort) => void;
  /** Optimistic toggle (Spec 31 §5), reverted on failure. Resolves false when it failed. */
  toggleLike: (publicId: string) => Promise<boolean>;
}

function errorMessageOf(err: unknown): string {
  return getErrorMessage(err instanceof ApiRequestError ? err.code : undefined);
}

// Only the latest page-1 request may land — a sort switch mid-load must not show the old sort.
let latestRequest = 0;

/** The public gallery's list and likes (Spec 31). */
export const useGalleryStore = create<GalleryState>((set, get) => {
  function applyLike(publicId: string, likedByMe: boolean, likeCount: number) {
    set((state) => ({
      entries: state.entries.map((e) => (e.publicId === publicId ? { ...e, likedByMe, likeCount } : e)),
    }));
  }

  return {
    sort: "recent",
    entries: [],
    page: 1,
    hasMore: false,
    status: "idle",
    error: null,
    loadingMore: false,
    loadMoreError: null,
    pendingLikes: {},

    load: async () => {
      const request = ++latestRequest;
      set({
        status: "loading",
        error: null,
        loadMoreError: null,
        loadingMore: false,
      });
      try {
        const result = await fetchGallery(get().sort, 1);
        if (request !== latestRequest) return;
        set({
          status: "success",
          entries: result.entries,
          page: result.page,
          hasMore: result.hasMore,
        });
      } catch (err) {
        if (request !== latestRequest) return;
        set({ status: "error", error: errorMessageOf(err) });
      }
    },

    loadMore: async () => {
      const { sort, page, loadingMore } = get();
      if (loadingMore) return;
      const request = latestRequest;
      set({ loadingMore: true, loadMoreError: null });
      try {
        const result = await fetchGallery(sort, page + 1);
        if (request !== latestRequest) return;
        set((state) => {
          // New publishes shift later pages — skip anything already shown.
          const seen = new Set(state.entries.map((entry) => entry.publicId));
          return {
            entries: [...state.entries, ...result.entries.filter((entry) => !seen.has(entry.publicId))],
            page: result.page,
            hasMore: result.hasMore,
            loadingMore: false,
          };
        });
      } catch (err) {
        if (request !== latestRequest) return;
        set({ loadingMore: false, loadMoreError: errorMessageOf(err) });
      }
    },

    setSort: (sort) => {
      if (sort === get().sort) return;
      set({ sort });
      void get().load();
    },

    toggleLike: async (publicId) => {
      const entry = get().entries.find((e) => e.publicId === publicId);
      if (!entry || get().pendingLikes[publicId]) return true;

      set((state) => ({
        pendingLikes: { ...state.pendingLikes, [publicId]: true },
      }));
      applyLike(publicId, !entry.likedByMe, entry.likeCount + (entry.likedByMe ? -1 : 1));
      let ok = true;
      try {
        const result = await toggleLikeApi(publicId);
        applyLike(publicId, result.liked, result.likeCount);
      } catch {
        applyLike(publicId, entry.likedByMe, entry.likeCount);
        ok = false;
      }
      set((state) => ({
        pendingLikes: { ...state.pendingLikes, [publicId]: false },
      }));
      return ok;
    },
  };
});

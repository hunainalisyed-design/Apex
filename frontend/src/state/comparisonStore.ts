import { create } from "zustand";
import type { SelectionState } from "@/lib/ai/mergeRecommendation";

export type ComparisonStatus = "pending" | "ready" | "error";

export interface ComparisonEntry {
  status: ComparisonStatus;
  before?: string;
  after?: string;
}

/** One picture pair to make: the build as it is, and as it would be with the recommendation. */
export interface ComparisonJob {
  messageId: string;
  vehicleSlug: string;
  before: SelectionState;
  after: SelectionState;
}

export interface ComparisonState {
  /** The vehicle these pictures belong to; the chat (and so the pictures) reset with it. */
  vehicleSlug: string | null;
  /** By chat message id — made once per recommendation, then reused (e.g. reopening the chat). */
  entries: Record<string, ComparisonEntry>;
  /** The pair being made right now; the hidden studio renders it. */
  current: ComparisonJob | null;
  queue: ComparisonJob[];
  /** Asks for a pair; does nothing if this message already has one (or is waiting for one). */
  request: (job: ComparisonJob) => void;
  complete: (messageId: string, before: string, after: string) => void;
  fail: (messageId: string) => void;
  /** Forgets everything and starts over for this vehicle (the chat reset for it). */
  resetFor: (vehicleSlug: string) => void;
  /** Forgets everything. */
  reset: () => void;
}

/**
 * The before/after pictures for CarAI recommendation cards (Spec 36). Pairs are made one at a
 * time by the hidden ComparisonStudio (a separate, invisible 3D view — the live showroom is
 * never touched), in the order they were asked for.
 */
export const useComparisonStore = create<ComparisonState>((set, get) => {
  function startNext() {
    const [next, ...rest] = get().queue;
    set({ current: next ?? null, queue: rest });
  }

  function finish(messageId: string, entry: ComparisonEntry) {
    if (get().current?.messageId !== messageId) return; // a stale answer (e.g. after a reset)
    set((state) => ({ entries: { ...state.entries, [messageId]: entry } }));
    startNext();
  }

  return {
    vehicleSlug: null,
    entries: {},
    current: null,
    queue: [],

    request: (job) => {
      if (get().entries[job.messageId]) return;
      set((state) => ({ entries: { ...state.entries, [job.messageId]: { status: "pending" } }, queue: [...state.queue, job] }));
      if (!get().current) startNext();
    },

    complete: (messageId, before, after) => finish(messageId, { status: "ready", before, after }),
    fail: (messageId) => finish(messageId, { status: "error" }),

    resetFor: (vehicleSlug) => set({ vehicleSlug, entries: {}, current: null, queue: [] }),
    reset: () => set({ vehicleSlug: null, entries: {}, current: null, queue: [] }),
  };
});

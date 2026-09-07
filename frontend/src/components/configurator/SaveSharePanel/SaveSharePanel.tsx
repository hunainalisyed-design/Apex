"use client";

import { useEffect, useRef, useState } from "react";
import { ApiRequestError, saveConfiguration } from "@/lib/api/configurations";
import { formatPriceCents } from "@/lib/format/currency";
import { useConfigurationStore } from "@/state/configurationStore";
import type { VehicleDetailDto } from "@/types/catalog";
import type { SavedConfigurationDto } from "@/types/configuration";

export interface SaveSharePanelProps {
  vehicle: VehicleDetailDto;
}

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "success"; saved: SavedConfigurationDto }
  | { status: "error"; message: string };

const TOAST_DURATION_MS = 2500;

/** Save/Copy ID/Share/Reset controls (Spec 10) — lives directly below BuildSummary, per
 * the spec's own UI-states wording ("live in or beside the build summary panel"). Toast is
 * a minimal local mechanism (not a global provider): Spec 12 will eventually own a shared
 * one, but it doesn't exist yet, and this project's established practice (Spec 5's own
 * ShowroomLoadingScreen/ShowroomErrorBoundary) is to build a small local version rather
 * than block on infrastructure that hasn't landed. */
export function SaveSharePanel({ vehicle }: SaveSharePanelProps) {
  const singleSelections = useConfigurationStore((s) => s.singleSelections);
  const multiSelections = useConfigurationStore((s) => s.multiSelections);
  const customPaintHex = useConfigurationStore((s) => s.customPaintHex);
  const reset = useConfigurationStore((s) => s.reset);

  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  function showToast(message: string) {
    setToast(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }

  async function handleSave() {
    setState({ status: "saving" });
    try {
      // Sends the full current selection state; the server recalculates the price
      // authoritatively before persisting (AC-1) — this component trusts and displays
      // only what comes back, never the pre-save local estimate (AC-9).
      const saved = await saveConfiguration({
        vehicleSlug: vehicle.slug,
        singleSelections,
        multiSelections,
        customPaintHex,
      });
      setState({ status: "success", saved });
    } catch (err) {
      // In-progress selections are never touched here — a failed save leaves the store
      // exactly as it was (AC-10).
      const message =
        err instanceof ApiRequestError ? err.message : "Something went wrong while saving your configuration.";
      setState({ status: "error", message });
    }
  }

  async function handleCopyId(publicId: string) {
    try {
      await navigator.clipboard.writeText(publicId);
      showToast("Configuration ID copied");
    } catch {
      showToast("Couldn't copy — try again");
    }
  }

  async function handleShare(publicId: string) {
    const url = `${window.location.origin}/configure/${vehicle.slug}?build=${publicId}`;
    try {
      await navigator.clipboard.writeText(url);
      showToast("Share link copied");
    } catch {
      showToast("Couldn't copy — try again");
    }
  }

  function handleReset() {
    reset();
    setState({ status: "idle" });
  }

  return (
    <div className="glass-panel flex flex-col gap-3 rounded-2xl px-4 py-3" aria-label="Save and share">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={state.status === "saving"}
          className="flex-1 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {state.status === "saving" ? "Saving…" : "Save"}
        </button>

        {/* A distinct control from CameraPresetBar's own "Reset" button (which only
            resets the camera view) — the aria-label both clarifies scope and avoids any
            accessible-name collision with that button's query in existing e2e specs. */}
        <button
          type="button"
          onClick={handleReset}
          aria-label="Reset configuration"
          className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Reset
        </button>
      </div>

      {state.status === "error" && (
        <div className="flex items-center justify-between gap-2 text-xs text-red-300">
          <span>{state.message}</span>
          <button
            type="button"
            onClick={handleSave}
            className="shrink-0 rounded-full border border-red-300/40 px-3 py-1 font-semibold uppercase tracking-wide hover:bg-red-300/10"
          >
            Retry
          </button>
        </div>
      )}

      {state.status === "success" && (
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-white/50">Saved</span>
            <span className="font-semibold text-white">
              {formatPriceCents(state.saved.breakdown.totalPriceCents, vehicle.currency)}
            </span>
          </div>
          <p
            className="select-all rounded-lg bg-white/5 px-3 py-2 font-mono text-sm text-white"
            data-testid="saved-public-id"
          >
            {state.saved.publicId}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleCopyId(state.saved.publicId)}
              className="flex-1 rounded-full border border-white/20 px-3 py-1.5 font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Copy Configuration ID
            </button>
            <button
              type="button"
              onClick={() => handleShare(state.saved.publicId)}
              className="flex-1 rounded-full border border-white/20 px-3 py-1.5 font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              Share
            </button>
          </div>
        </div>
      )}

      {toast && (
        <p role="status" aria-live="polite" className="text-xs text-white/60">
          {toast}
        </p>
      )}
    </div>
  );
}

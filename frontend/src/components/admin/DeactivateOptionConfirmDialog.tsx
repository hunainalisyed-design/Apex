"use client";

import { useId, useRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export interface DeactivateOptionConfirmDialogProps {
  optionName: string;
  isSaving: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation before deactivating a CustomizationOption (Spec 21 §5's "confirmation on
 * deactivation/status changes"), modeled on DeleteConfirmDialog.tsx's existing pattern. */
export function DeactivateOptionConfirmDialog({
  optionName,
  isSaving,
  error,
  onConfirm,
  onCancel,
}: DeactivateOptionConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(dialogRef, true, onCancel);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6" onClick={onCancel}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel flex w-full max-w-sm flex-col gap-4 rounded-2xl p-6"
      >
        <h2 id={titleId} className="text-sm font-semibold uppercase tracking-wide text-white">
          Deactivate &quot;{optionName}&quot;?
        </h2>
        <p className="text-sm text-white/60">
          It will disappear from the public configurator, but existing saved builds that selected it are unaffected.
        </p>

        {error && <p className="text-xs text-red-300">{error}</p>}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving}
            className="flex-1 rounded-full bg-red-500/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
          >
            {isSaving ? "Deactivating…" : "Deactivate"}
          </button>
        </div>
      </div>
    </div>
  );
}

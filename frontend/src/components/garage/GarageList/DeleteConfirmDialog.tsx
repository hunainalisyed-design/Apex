"use client";

import { useId, useRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export interface DeleteConfirmDialogProps {
  isOpen: boolean;
  isDeleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * The app's first reusable confirm-before-destructive-action dialog (Spec 17, AC-5),
 * modeled directly on CaptureBuild.tsx's existing success-modal pattern (role="dialog"
 * aria-modal="true", bg-black/70 backdrop, useFocusTrap) rather than inventing a new one.
 */
export function DeleteConfirmDialog({ isOpen, isDeleting, error, onConfirm, onCancel }: DeleteConfirmDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(dialogRef, isOpen, onCancel);

  if (!isOpen) return null;

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
          Delete this build?
        </h2>
        <p className="text-sm text-white/60">This can&apos;t be undone.</p>

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
            disabled={isDeleting}
            className="flex-1 rounded-full bg-red-500/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useId, useRef, useState } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export interface DeleteAccountDialogProps {
  isOpen: boolean;
  isDeleting: boolean;
  error: string | null;
  userEmail: string;
  onConfirm: (confirmEmail: string) => void;
  onCancel: () => void;
}

/**
 * Spec 24, AC-6's "clear, explicit confirmation step (typing the account email, or similar)
 * before the irreversible action proceeds" — a stronger variant of GarageList's
 * DeleteConfirmDialog (that one only asks Cancel/Delete, appropriate for deleting one build;
 * this one asks for the account's own email, appropriate for an irreversible identity-level
 * action), modeled on the same dialog shell (role="dialog", useFocusTrap, glass-panel).
 */
export function DeleteAccountDialog({
  isOpen,
  isDeleting,
  error,
  userEmail,
  onConfirm,
  onCancel,
}: DeleteAccountDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const inputId = useId();
  const [typedEmail, setTypedEmail] = useState("");

  useFocusTrap(dialogRef, isOpen, onCancel);

  if (!isOpen) return null;

  const canConfirm = typedEmail.trim().toLowerCase() === userEmail.toLowerCase();

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
          Delete your account?
        </h2>
        <p className="text-sm text-white/60">
          This can&apos;t be undone. Your name, email, and password are permanently deleted. Type{" "}
          <strong className="text-white/90">{userEmail}</strong> to confirm.
        </p>

        <label htmlFor={inputId} className="sr-only">
          Type your account email to confirm
        </label>
        <input
          id={inputId}
          type="email"
          value={typedEmail}
          onChange={(e) => setTypedEmail(e.target.value)}
          placeholder={userEmail}
          className="rounded-lg border border-white/20 bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/30 focus-ring"
        />

        {error && (
          <p role="alert" className="text-xs text-red-300">
            {error}
          </p>
        )}

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
            onClick={() => onConfirm(typedEmail)}
            disabled={!canConfirm || isDeleting}
            className="flex-1 rounded-full bg-red-500/80 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50 focus-ring"
          >
            {isDeleting ? "Deleting…" : "Delete Account"}
          </button>
        </div>
      </div>
    </div>
  );
}

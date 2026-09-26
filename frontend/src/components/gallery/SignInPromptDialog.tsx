"use client";

import Link from "next/link";
import { useId, useRef } from "react";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export interface SignInPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Shown when a signed-out visitor tries to like a build (Spec 31, AC-4) — same modal
 * pattern as DeleteConfirmDialog (role="dialog", aria-modal, useFocusTrap). */
export function SignInPromptDialog({ isOpen, onClose }: SignInPromptDialogProps) {
  const t = useTranslations("gallery");
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(dialogRef, isOpen, onClose);

  if (!isOpen) return null;

  const linkClass =
    "flex-1 rounded-full px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide transition focus-ring";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel flex w-full max-w-sm flex-col gap-4 rounded-2xl p-6"
      >
        <h2 id={titleId} className="text-sm font-semibold uppercase tracking-wide text-white">
          {t("signInTitle")}
        </h2>
        <p className="text-sm text-white/60">{t("signInBody")}</p>
        <div className="flex gap-2">
          <Link href="/login?returnTo=/gallery" className={`${linkClass} bg-white text-black hover:bg-white/90`}>
            {t("logIn")}
          </Link>
          <Link
            href="/signup?returnTo=/gallery"
            className={`${linkClass} border border-white/20 text-white/80 hover:border-white/50 hover:text-white`}
          >
            {t("signUp")}
          </Link>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="self-center text-xs text-white/50 underline-offset-4 hover:text-white hover:underline focus-ring"
        >
          {t("notNow")}
        </button>
      </div>
    </div>
  );
}

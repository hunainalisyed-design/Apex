"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/shell/ToastProvider";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { buildShareUrl } from "@/lib/showroom/shareUrl";
import type { VehicleDetailDto } from "@/types/catalog";

export interface CaptureImageDialogProps {
  vehicle: VehicleDetailDto;
  image: Blob;
  filename: string;
  publicId: string;
  /** Shown above the image — e.g. why a video capture fell back to an image (Spec 30, AC-2). */
  notice?: string | null;
  onClose: () => void;
}

/**
 * The captured-build result: preview, Save Image, Copy Share Link (Spec 11). Shared by
 * "Capture Build" and by "Capture Video"'s image fallback (Spec 30), so both look and
 * behave identically.
 */
export function CaptureImageDialog({ vehicle, image, filename, publicId, notice, onClose }: CaptureImageDialogProps) {
  const t = useTranslations("capture");
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { show: showToast } = useToast();
  const imageUrl = useMemo(() => URL.createObjectURL(image), [image]);

  useEffect(() => () => URL.revokeObjectURL(imageUrl), [imageUrl]);
  useFocusTrap(dialogRef, true, onClose);

  function handleSaveImage() {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = filename;
    link.click();
  }

  async function handleCopyShareLink() {
    try {
      await navigator.clipboard.writeText(buildShareUrl(vehicle.slug, publicId));
      showToast(t("linkCopied"));
    } catch {
      showToast(t("linkCopyFailed"), "assertive");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel flex w-full max-w-lg flex-col gap-4 rounded-2xl p-6"
      >
        <h2 id={titleId} className="text-sm font-semibold uppercase tracking-wide text-white">
          {t("title")}
        </h2>
        {notice && (
          <p role="status" className="rounded-lg bg-white/5 px-3 py-2 text-xs text-white/70">
            {notice}
          </p>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: URL preview, not a real image asset */}
        <img src={imageUrl} alt={t("imageAlt", { vehicle: vehicle.name })} className="w-full rounded-xl" />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveImage}
            className="flex-1 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 focus-ring"
          >
            {t("saveImage")}
          </button>
          <button
            type="button"
            onClick={handleCopyShareLink}
            className="flex-1 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring"
          >
            {t("copyShareLink")}
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="self-center text-xs text-white/50 underline-offset-2 hover:text-white hover:underline focus-ring"
        >
          {t("close")}
        </button>
      </div>
    </div>
  );
}

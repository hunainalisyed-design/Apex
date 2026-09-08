"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import type { ShowroomControls } from "@/components/showroom/ShowroomScene";
import { useCaptureBuild } from "@/components/showroom/useCaptureBuild";
import { useToast } from "@/components/shell/ToastProvider";
import type { CameraPresetId } from "@/lib/showroom/cameraPresets";
import { buildShareUrl } from "@/lib/showroom/shareUrl";
import type { VehicleDetailDto } from "@/types/catalog";

export interface CaptureBuildProps {
  vehicle: VehicleDetailDto;
  showroomControlsRef: React.RefObject<ShowroomControls | null>;
  currentPreset: CameraPresetId;
  sceneReady: boolean;
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** "Capture Build" button + success modal (Spec 11) — a sibling directly below
 * SaveSharePanel, both "build sharing" actions clustered together in the right column.
 * Mostly presentational, driven by useCaptureBuild's returned state, same as
 * CameraPresetBar being driven by props rather than owning its own logic. */
export function CaptureBuild({ vehicle, showroomControlsRef, currentPreset, sceneReady }: CaptureBuildProps) {
  const { status, compositedImage, publicId, filename, error, capture, dismiss } = useCaptureBuild(
    vehicle,
    showroomControlsRef,
    currentPreset,
  );

  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { show: showToast } = useToast();

  const isOpen = status === "success" && compositedImage !== null;

  const imageUrl = useMemo(
    () => (compositedImage ? URL.createObjectURL(compositedImage) : null),
    [compositedImage],
  );

  // Revoke whenever imageUrl changes to a new value (or on unmount) — never inside the
  // memo itself, so this stays a pure cleanup, not a setState-driving effect.
  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  // Focus moves into the dialog on open; Tab/Shift+Tab cycles within it; Escape dismisses.
  useEffect(() => {
    if (!isOpen) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusables = () => Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    focusables()[0]?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, dismiss]);

  function handleSaveImage() {
    if (!imageUrl || !filename) return;
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = filename;
    link.click();
  }

  async function handleCopyShareLink() {
    if (!publicId) return;
    try {
      await navigator.clipboard.writeText(buildShareUrl(vehicle.slug, publicId));
      showToast("Share link copied");
    } catch {
      showToast("Couldn't copy — try again", "assertive");
    }
  }

  const isBusy = status === "saving" || status === "capturing";

  return (
    <>
      <button
        type="button"
        onClick={capture}
        disabled={!sceneReady || isBusy}
        className="glass-panel flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
      >
        {isBusy ? "Capturing your build…" : "Capture Build"}
      </button>

      {status === "error" && <p className="text-xs text-red-300">{error}</p>}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-6" onClick={dismiss}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel flex w-full max-w-lg flex-col gap-4 rounded-2xl p-6"
          >
            <h2 id={titleId} className="text-sm font-semibold uppercase tracking-wide text-white">
              Your Build
            </h2>
            {imageUrl && (
              // A locally-generated blob: URL, not a static/remote asset — next/image's
              // optimizer doesn't apply here.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt={`${vehicle.name} build capture`} className="w-full rounded-xl" />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveImage}
                className="flex-1 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 focus-ring"
              >
                Save Image
              </button>
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="flex-1 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring"
              >
                Copy Share Link
              </button>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="self-center text-xs text-white/50 underline-offset-2 hover:text-white hover:underline focus-ring"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

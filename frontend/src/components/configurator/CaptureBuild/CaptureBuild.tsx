"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import type { ShowroomControls } from "@/components/showroom/ShowroomScene";
import { useCaptureBuild } from "@/components/showroom/useCaptureBuild";
import type { CameraPresetId } from "@/lib/showroom/cameraPresets";
import type { VehicleDetailDto } from "@/types/catalog";
import { CaptureImageDialog } from "./CaptureImageDialog";

export interface CaptureBuildProps {
  vehicle: VehicleDetailDto;
  showroomControlsRef: React.RefObject<ShowroomControls | null>;
  currentPreset: CameraPresetId;
  sceneReady: boolean;
  /** Spec 30: lets the showroom lock "Capture Video" while an image capture runs. */
  onBusyChange?: (busy: boolean) => void;
}

/** "Capture Build" button + success modal (Spec 11) — a sibling directly below
 * SaveSharePanel, both "build sharing" actions clustered together in the right column.
 * Mostly presentational, driven by useCaptureBuild's returned state, same as
 * CameraPresetBar being driven by props rather than owning its own logic. The result
 * dialog is CaptureImageDialog, shared with Capture Video's image fallback (Spec 30). */
export function CaptureBuild({ vehicle, showroomControlsRef, currentPreset, sceneReady, onBusyChange }: CaptureBuildProps) {
  const t = useTranslations("capture");
  const { status, compositedImage, publicId, filename, error, capture, dismiss } = useCaptureBuild(
    vehicle,
    showroomControlsRef,
    currentPreset,
  );

  const isBusy = status === "saving" || status === "capturing";
  useEffect(() => {
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  return (
    <>
      <button
        type="button"
        onClick={capture}
        disabled={!sceneReady || isBusy}
        className="glass-panel flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
      >
        {isBusy ? t("capturingImage") : t("captureImage")}
      </button>

      {status === "error" && <p className="text-xs text-red-300">{error}</p>}

      {status === "success" && compositedImage && publicId && filename && (
        <CaptureImageDialog vehicle={vehicle} image={compositedImage} filename={filename} publicId={publicId} onClose={dismiss} />
      )}
    </>
  );
}

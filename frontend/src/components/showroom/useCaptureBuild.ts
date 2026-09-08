"use client";

import { useCallback, useState } from "react";
import type { CameraPresetId } from "@/lib/showroom/cameraPresets";
import { deriveBuildSummary } from "@/lib/showroom/buildSummary";
import {
  buildCaptureFilename,
  buildOverlayLayout,
  composeCaptureImage,
  selectOverlayLines,
} from "@/lib/showroom/composeCaptureImage";
import { useConfigurationStore } from "@/state/configurationStore";
import type { VehicleDetailDto } from "@/types/catalog";
import type { ShowroomControls } from "./ShowroomScene";

export type CaptureStatus = "idle" | "saving" | "capturing" | "success" | "error";

export interface UseCaptureBuildResult {
  status: CaptureStatus;
  compositedImage: Blob | null;
  publicId: string | null;
  filename: string | null;
  error: string | null;
  capture: () => Promise<void>;
  dismiss: () => void;
}

/**
 * Orchestrates "Capture Build" (Spec 11): save-if-dirty (reusing the shared store's save()
 * so a failure surfaces via SaveSharePanel's own error UI, not a capture-specific one),
 * snapshot the current camera, animate to the default framing, capture the frame,
 * composite the overlay, then restore the camera to exactly where it was. Mirrors this
 * codebase's existing hook-extraction convention (useCameraTransition, useReducedMotion).
 */
export function useCaptureBuild(
  vehicle: VehicleDetailDto,
  showroomControlsRef: React.RefObject<ShowroomControls | null>,
  currentPreset: CameraPresetId,
): UseCaptureBuildResult {
  const [status, setStatus] = useState<CaptureStatus>("idle");
  const [compositedImage, setCompositedImage] = useState<Blob | null>(null);
  const [publicId, setPublicId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(async () => {
    const controls = showroomControlsRef.current;
    if (!controls) return;

    const store = useConfigurationStore.getState();

    if (store.isDirtySinceLastSave()) {
      setStatus("saving");
      try {
        await store.save();
      } catch {
        // The store's own saveStatus/saveError already reflect this failure —
        // SaveSharePanel (rendered right alongside this control) shows it. Capture just
        // quietly stands down rather than showing a second, capture-specific error.
        setStatus("idle");
        return;
      }
    }

    setStatus("capturing");
    try {
      const snapshot = controls.getCurrentCameraState();
      const wasInterior = currentPreset === "interior" || currentPreset === "cockpit";

      await controls.goToPresetAsync("default");
      const frameDataUrl = controls.captureFrame();

      const latest = useConfigurationStore.getState();
      const saved = latest.savedConfiguration;
      if (!saved) {
        throw new Error("A saved build is required before capturing.");
      }

      const summary = deriveBuildSummary(
        vehicle,
        latest.singleSelections,
        latest.multiSelections,
        latest.customPaintHex,
      );
      const layout = buildOverlayLayout({
        vehicleName: vehicle.name,
        lines: selectOverlayLines(summary),
        totalPriceCents: saved.breakdown.totalPriceCents,
        currency: vehicle.currency,
        publicId: saved.publicId,
      });

      const blob = await composeCaptureImage({ frameDataUrl, layout });

      // The image is already captured — restoring the camera doesn't need to block
      // reaching "success". presetId resyncs currentPreset (and therefore
      // CameraPresetBar's highlighted button) to whatever it was before the
      // capture-triggered transition to "default", not just the raw position.
      if (snapshot) {
        void controls.goToRaw(snapshot, { isInterior: wasInterior, presetId: currentPreset });
      }

      setCompositedImage(blob);
      setPublicId(saved.publicId);
      setStatus("success");
    } catch {
      setStatus("error");
      setError("Unable to capture image, please try again.");
    }
  }, [vehicle, showroomControlsRef, currentPreset]);

  const dismiss = useCallback(() => {
    setStatus("idle");
    setCompositedImage(null);
    setPublicId(null);
    setError(null);
  }, []);

  return {
    status,
    compositedImage,
    publicId,
    filename: publicId ? buildCaptureFilename(vehicle.slug, publicId) : null,
    error,
    capture,
    dismiss,
  };
}

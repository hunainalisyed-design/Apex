"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import type { CameraPresetId } from "@/lib/showroom/cameraPresets";
import { deriveBuildSummary } from "@/lib/showroom/buildSummary";
import { buildOverlayLayout, selectOverlayLines } from "@/lib/showroom/composeCaptureImage";
import { buildVideoFilename, drawTitleCards, pickCurrentVideoStrategy } from "@/lib/showroom/composeCaptureVideo";
import { useConfigurationStore } from "@/state/configurationStore";
import type { VehicleDetailDto } from "@/types/catalog";
import type { ShowroomControls } from "./ShowroomScene";
import { useCaptureBuild, type UseCaptureBuildResult } from "./useCaptureBuild";

/** "preparing" is set synchronously on click, so the button disables before any async work. */
export type VideoCaptureStatus = "idle" | "preparing" | "saving" | "recording" | "success" | "fallback";

/** Why the image fallback ran (AC-2) — shown to the user, and reported. */
export type VideoFallbackReason = "unsupported" | "failed";

export interface UseCaptureVideoResult {
  status: VideoCaptureStatus;
  /** 0 → 1 while recording; null otherwise. */
  progress: number | null;
  video: Blob | null;
  filename: string | null;
  publicId: string | null;
  fallbackReason: VideoFallbackReason | null;
  /** True from the click until the clip (or its fallback image) is ready — the showroom locks
   * the other capture button and the camera/environment controls meanwhile. */
  busy: boolean;
  /** The image capture used as the fallback (its result dialog is shown by the caller). */
  imageFallback: UseCaptureBuildResult;
  capture: () => Promise<void>;
  dismiss: () => void;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * "Capture Video" (Spec 30): saves the build if it has unsaved changes (so the clip has a
 * build ID, like Spec 11's image), then records one scripted 360° orbit with intro/outro
 * title cards. Where the browser can't record — or recording fails partway — it runs
 * Spec 11's image capture instead and says why (AC-2), rather than failing silently.
 */
export function useCaptureVideo(
  vehicle: VehicleDetailDto,
  showroomControlsRef: React.RefObject<ShowroomControls | null>,
  currentPreset: CameraPresetId,
): UseCaptureVideoResult {
  const imageFallback = useCaptureBuild(vehicle, showroomControlsRef, currentPreset);
  const runImageCapture = imageFallback.capture;
  const [status, setStatus] = useState<VideoCaptureStatus>("idle");
  const [progress, setProgress] = useState<number | null>(null);
  const [video, setVideo] = useState<{ blob: Blob; extension: "mp4" | "webm"; publicId: string } | null>(null);
  const [fallbackReason, setFallbackReason] = useState<VideoFallbackReason | null>(null);

  // A synchronous guard: a second click that lands before React re-renders the disabled
  // button is ignored, so two recordings can never drive the same renderer at once.
  const inFlight = useRef(false);
  // Aborted if the showroom unmounts mid-capture (e.g. the user navigates away during a long
  // frame-by-frame render) — an abandonment, not a failure: no fallback and nothing reported.
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  const fallBackToImage = useCallback(
    async (reason: VideoFallbackReason, detail: unknown) => {
      // Spec 30 observability: how often each browser falls back, to inform Risk #2.
      if (reason === "failed") Sentry.captureException(detail, { tags: { feature: "video-capture", fallback: reason } });
      else Sentry.captureMessage("Video capture unsupported; fell back to image", { level: "info", tags: { feature: "video-capture", fallback: String(detail) } });
      setFallbackReason(reason);
      setStatus("fallback");
      await runImageCapture();
    },
    [runImageCapture],
  );

  const capture = useCallback(async () => {
    const controls = showroomControlsRef.current;
    if (!controls || inFlight.current) return;
    inFlight.current = true;
    setStatus("preparing");
    const abort = new AbortController();
    abortRef.current = abort;
    const { signal } = abort;

    try {
      const strategy = await pickCurrentVideoStrategy();
      if (signal.aborted) return;
      if ("unsupported" in strategy) {
        await fallBackToImage("unsupported", strategy.unsupported);
        return;
      }
      const extension = strategy.kind === "frames" ? strategy.extension : strategy.format.extension;

      const store = useConfigurationStore.getState();
      if (store.isDirtySinceLastSave()) {
        setStatus("saving");
        try {
          await store.save();
        } catch {
          // SaveSharePanel already shows the save error, same as Spec 11.
          setStatus("idle");
          return;
        }
      }

      const latest = useConfigurationStore.getState();
      const saved = latest.savedConfiguration;
      if (!saved || signal.aborted) {
        setStatus("idle");
        return;
      }
      const layout = buildOverlayLayout({
        vehicleName: vehicle.name,
        lines: selectOverlayLines(deriveBuildSummary(vehicle, latest.singleSelections, latest.multiSelections, latest.customPaintHex)),
        totalPriceCents: saved.breakdown.totalPriceCents,
        currency: vehicle.currency,
        publicId: saved.publicId,
      });

      setStatus("recording");
      setProgress(0);
      try {
        const blob = await controls.recordOrbit({
          strategy,
          signal,
          drawOverlay: (ctx, timeMs) => drawTitleCards(ctx, layout, timeMs),
          onProgress: setProgress,
        });
        setVideo({ blob, extension, publicId: saved.publicId });
        setStatus("success");
      } catch (error) {
        if (signal.aborted || isAbort(error)) return; // abandoned, not failed
        await fallBackToImage("failed", error);
      } finally {
        setProgress(null);
      }
    } finally {
      inFlight.current = false;
    }
  }, [vehicle, showroomControlsRef, fallBackToImage]);

  const dismiss = useCallback(() => {
    setStatus("idle");
    setVideo(null);
    setFallbackReason(null);
    imageFallback.dismiss();
  }, [imageFallback]);

  const fallbackImageInProgress =
    status === "fallback" && (imageFallback.status === "idle" || imageFallback.status === "saving" || imageFallback.status === "capturing");
  const busy = status === "preparing" || status === "saving" || status === "recording" || fallbackImageInProgress;

  return {
    status,
    progress,
    video: video?.blob ?? null,
    filename: video ? buildVideoFilename(vehicle.slug, video.publicId, video.extension) : null,
    publicId: video?.publicId ?? null,
    fallbackReason,
    busy,
    imageFallback,
    capture,
    dismiss,
  };
}

"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { CaptureImageDialog } from "@/components/configurator/CaptureBuild/CaptureImageDialog";
import type { ShowroomControls } from "@/components/showroom/ShowroomScene";
import { useCaptureVideo } from "@/components/showroom/useCaptureVideo";
import { useToast } from "@/components/shell/ToastProvider";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import type { CameraPresetId } from "@/lib/showroom/cameraPresets";
import { buildShareUrl } from "@/lib/showroom/shareUrl";
import type { VehicleDetailDto } from "@/types/catalog";

const VIDEO_CAPTURE_ENABLED = process.env.NEXT_PUBLIC_VIDEO_CAPTURE_ENABLED !== "false";

export interface CaptureVideoProps {
  vehicle: VehicleDetailDto;
  showroomControlsRef: React.RefObject<ShowroomControls | null>;
  currentPreset: CameraPresetId;
  sceneReady: boolean;
  reducedMotion: boolean;
  /** Recording progress (0 → 1) for the showroom's "Recording" overlay; null when not recording. */
  onRecordingProgress: (progress: number | null) => void;
  /** True from the click until the result is ready — the showroom locks conflicting controls. */
  onBusyChange?: (busy: boolean) => void;
}

/**
 * "Capture Video" (Spec 30) — a sibling of "Capture Build". Records a vertical 9:16 orbit
 * clip with the build's title cards, then offers Save Video / Copy Share Link. Where video
 * can't be recorded, it hands over to the image capture and says why (AC-2). Hidden when
 * NEXT_PUBLIC_VIDEO_CAPTURE_ENABLED=false, leaving Spec 11's image capture as before.
 */
export function CaptureVideo(props: CaptureVideoProps) {
  if (!VIDEO_CAPTURE_ENABLED) return null;
  return <CaptureVideoInner {...props} />;
}

function CaptureVideoInner({ vehicle, showroomControlsRef, currentPreset, sceneReady, reducedMotion, onRecordingProgress, onBusyChange }: CaptureVideoProps) {
  const t = useTranslations("capture");
  const capture = useCaptureVideo(vehicle, showroomControlsRef, currentPreset);
  const { status, progress, imageFallback } = capture;

  useEffect(() => {
    onRecordingProgress(progress);
  }, [progress, onRecordingProgress]);

  const { busy } = capture;
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);
  const fallbackImageReady =
    status === "fallback" && imageFallback.status === "success" && imageFallback.compositedImage && imageFallback.publicId && imageFallback.filename;

  return (
    <>
      <button
        type="button"
        onClick={capture.capture}
        disabled={!sceneReady || busy}
        className="glass-panel flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
      >
        {busy ? t("preparingVideo") : t("captureVideo")}
      </button>

      {status === "fallback" && imageFallback.status === "error" && <p className="text-xs text-red-300">{imageFallback.error}</p>}

      {status === "success" && capture.video && capture.filename && capture.publicId && (
        <CaptureVideoDialog
          vehicle={vehicle}
          video={capture.video}
          filename={capture.filename}
          publicId={capture.publicId}
          autoPlay={!reducedMotion}
          onClose={capture.dismiss}
        />
      )}

      {fallbackImageReady && (
        <CaptureImageDialog
          vehicle={vehicle}
          image={imageFallback.compositedImage!}
          filename={imageFallback.filename!}
          publicId={imageFallback.publicId!}
          notice={capture.fallbackReason === "failed" ? t("fallbackFailed") : t("fallbackUnsupported")}
          onClose={capture.dismiss}
        />
      )}
    </>
  );
}

/** Shows how much of the clip has been rendered, over the scene (AC-3). A percentage rather
 * than seconds left: frames are rendered one by one, so on a slow device rendering takes longer
 * than the clip itself. No decorative animation — the bar jumps with each update (AC-5). */
export function RecordingOverlay({ progress }: { progress: number }) {
  const t = useTranslations("capture");
  const percent = Math.round(progress * 100);
  return (
    <div
      role="status"
      aria-label={t("recordingLabel")}
      className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-black/85"
      data-testid="video-recording-overlay"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/80">{t("recording", { percent })}</p>
      <div
        className="h-1 w-48 overflow-hidden rounded-full bg-white/15"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="h-full bg-white" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function CaptureVideoDialog({
  vehicle,
  video,
  filename,
  publicId,
  autoPlay,
  onClose,
}: {
  vehicle: VehicleDetailDto;
  video: Blob;
  filename: string;
  publicId: string;
  autoPlay: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("capture");
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { show: showToast } = useToast();
  const videoUrl = useMemo(() => URL.createObjectURL(video), [video]);

  useEffect(() => () => URL.revokeObjectURL(videoUrl), [videoUrl]);
  useFocusTrap(dialogRef, true, onClose);

  function handleSaveVideo() {
    const link = document.createElement("a");
    link.href = videoUrl;
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
        className="glass-panel flex max-h-[90vh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-2xl p-6"
      >
        <h2 id={titleId} className="text-sm font-semibold uppercase tracking-wide text-white">
          {t("videoTitle")}
        </h2>
        {/* Muted: the clip is silent anyway. With reduced motion it doesn't autoplay (AC-5). */}
        <video
          src={videoUrl}
          aria-label={t("videoAlt", { vehicle: vehicle.name })}
          className="mx-auto max-h-[55vh] w-auto rounded-xl bg-black"
          autoPlay={autoPlay}
          loop
          muted
          playsInline
          controls
          data-testid="captured-video"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSaveVideo}
            className="flex-1 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 focus-ring"
          >
            {t("saveVideo")}
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

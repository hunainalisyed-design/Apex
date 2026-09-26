"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import type { ShowroomControls } from "@/components/showroom/ShowroomScene";
import { usePublishBuild } from "@/components/showroom/usePublishBuild";
import { useToast } from "@/components/shell/ToastProvider";
import type { CameraPresetId } from "@/lib/showroom/cameraPresets";
import { useAuthStore } from "@/state/authStore";
import { useConfigurationStore } from "@/state/configurationStore";
import type { VehicleDetailDto } from "@/types/catalog";

export interface PublishToGalleryProps {
  vehicle: VehicleDetailDto;
  showroomControlsRef: React.RefObject<ShowroomControls | null>;
  currentPreset: CameraPresetId;
  sceneReady: boolean;
  /** Publishing captures the scene, so the showroom locks the other captures and camera meanwhile. */
  onBusyChange?: (busy: boolean) => void;
}

/**
 * "Publish to Gallery" / "Unpublish" (Spec 31, AC-1 and AC-6) — signed-in users only (guests
 * can't publish, SRS §36.5). Shows the published state only while the loaded selections are
 * exactly the saved build; any change means Publish would save (and publish) a new build.
 */
export function PublishToGallery({
  vehicle,
  showroomControlsRef,
  currentPreset,
  sceneReady,
  onBusyChange,
}: PublishToGalleryProps) {
  const t = useTranslations("gallery");
  const { show: showToast } = useToast();
  const user = useAuthStore((s) => s.user);
  const savedConfiguration = useConfigurationStore((s) => s.savedConfiguration);
  // A boolean selector re-renders exactly when the selections start/stop matching the saved build.
  const isDirty = useConfigurationStore((s) => s.isDirtySinceLastSave());
  const { status, error, publish, unpublish } = usePublishBuild(vehicle, showroomControlsRef, currentPreset);

  const isBusy = status !== "idle";
  const isCapturing = status === "saving" || status === "capturing" || status === "publishing";
  useEffect(() => {
    onBusyChange?.(isCapturing);
  }, [isCapturing, onBusyChange]);

  if (!user) return null;
  // Someone else's shared build, unchanged: only its owner can publish it.
  const ownedByOther = !isDirty && savedConfiguration?.ownerId != null && savedConfiguration.ownerId !== user.id;
  if (ownedByOther) return null;

  const isPublished = !isDirty && savedConfiguration?.isPublished === true;

  async function handlePublish() {
    if (await publish()) showToast(t("published"));
  }

  async function handleUnpublish() {
    if (await unpublish()) showToast(t("unpublished"));
  }

  const buttonClass =
    "glass-panel flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-ring";

  return (
    <div className="flex flex-col gap-2">
      {isPublished ? (
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
            {t("publishedBadge")}
          </span>
          <Link href="/gallery" className={buttonClass}>
            {t("viewGallery")}
          </Link>
          <button type="button" onClick={handleUnpublish} disabled={isBusy} className={buttonClass}>
            {status === "unpublishing" ? t("unpublishing") : t("unpublish")}
          </button>
        </div>
      ) : (
        <button type="button" onClick={handlePublish} disabled={!sceneReady || isBusy} className={buttonClass}>
          {status === "saving"
            ? t("saving")
            : status === "capturing"
              ? t("capturing")
              : status === "publishing"
                ? t("publishing")
                : t("publish")}
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { publishBuild, unpublishBuild } from "@/lib/api/gallery";
import { ApiRequestError } from "@/lib/api/configurations";
import { getErrorMessage } from "@/lib/errors/getErrorMessage";
import type { CameraPresetId } from "@/lib/showroom/cameraPresets";
import { useAuthStore } from "@/state/authStore";
import { useConfigurationStore } from "@/state/configurationStore";
import type { VehicleDetailDto } from "@/types/catalog";
import { captureBuildImage } from "./useCaptureBuild";
import type { ShowroomControls } from "./ShowroomScene";

export type PublishStatus = "idle" | "saving" | "capturing" | "publishing" | "unpublishing";

export interface UsePublishBuildResult {
  status: PublishStatus;
  error: string | null;
  /** Save-if-dirty → claim a guest build → capture (Spec 11) → upload. Resolves true on success. */
  publish: () => Promise<boolean>;
  unpublish: () => Promise<boolean>;
}

/**
 * "Publish to Gallery" (Spec 31, AC-1). The gallery image is Spec 11's capture, taken here in
 * the browser at publish time and uploaded with the request, so publishing only happens where
 * the 3D scene is — the configurator. A guest-owned build the signed-in user is looking at is
 * claimed first (the server only lets owners publish); the caller hides the control for a
 * build someone else owns.
 */
export function usePublishBuild(
  vehicle: VehicleDetailDto,
  showroomControlsRef: React.RefObject<ShowroomControls | null>,
  currentPreset: CameraPresetId,
): UsePublishBuildResult {
  const [status, setStatus] = useState<PublishStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  // Synchronous double-click guard — state updates land a render too late for that.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const settle = useCallback((next: PublishStatus, message: string | null = null) => {
    inFlight.current = false;
    if (!mounted.current) return;
    setStatus(next);
    setError(message);
  }, []);

  const publish = useCallback(async () => {
    const controls = showroomControlsRef.current;
    const user = useAuthStore.getState().user;
    if (!controls || !user || inFlight.current) return false;
    inFlight.current = true;
    setError(null);

    const store = useConfigurationStore.getState();
    if (store.isDirtySinceLastSave()) {
      setStatus("saving");
      try {
        await store.save();
      } catch {
        // SaveSharePanel already shows the save failure (same as Capture Build).
        settle("idle");
        return false;
      }
    }

    try {
      if (useConfigurationStore.getState().savedConfiguration?.ownerId === null) {
        await useConfigurationStore.getState().claim();
      }
      setStatus("capturing");
      const { blob, publicId } = await captureBuildImage(vehicle, controls, currentPreset);
      setStatus("publishing");
      const published = await publishBuild(publicId, blob);
      useConfigurationStore.getState().setPublishStatus(published);
      settle("idle");
      return true;
    } catch (err) {
      settle("idle", getErrorMessage(err instanceof ApiRequestError ? err.code : null));
      return false;
    }
  }, [vehicle, showroomControlsRef, currentPreset, settle]);

  const unpublish = useCallback(async () => {
    const publicId = useConfigurationStore.getState().savedConfiguration?.publicId;
    if (!publicId || inFlight.current) return false;
    inFlight.current = true;
    setError(null);
    setStatus("unpublishing");
    try {
      useConfigurationStore.getState().setPublishStatus(await unpublishBuild(publicId));
      settle("idle");
      return true;
    } catch (err) {
      settle("idle", getErrorMessage(err instanceof ApiRequestError ? err.code : null));
      return false;
    }
  }, [settle]);

  return { status, error, publish, unpublish };
}

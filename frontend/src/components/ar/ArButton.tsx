"use client";

import { useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { useTranslations } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import type { ShowroomControls } from "@/components/showroom/ShowroomScene";
import { uploadArModel } from "@/lib/api/ar";
import { detectCurrentArPlatform } from "@/lib/ar/capability";
import { exportArModel } from "@/lib/ar/exportModel";
import { openQuickLook, openSceneViewer } from "@/lib/ar/launch";
import { getRealGlbVehicleConfig } from "@/lib/showroom/realGlbVehicles";
import type { VehicleDetailDto } from "@/types/catalog";

const AR_ENABLED = process.env.NEXT_PUBLIC_AR_ENABLED !== "false";

/** How long a Quick Look blob URL is kept alive after launch — Quick Look reads the file
 * right away, but revoking it immediately can race the hand-off on slower devices. */
const BLOB_URL_LIFETIME_MS = 60_000;

export interface ArButtonProps {
  vehicle: VehicleDetailDto;
  showroomControlsRef: RefObject<ShowroomControls | null>;
  sceneReady: boolean;
}

type Status = "idle" | "preparing" | "error";

// A device's AR capability never changes while the page is open, so there's nothing to
// subscribe to; the server snapshot is null, so the button only appears after hydration.
const noSubscription = () => () => {};
const serverPlatform = () => null;

/**
 * "View in Your Driveway" (Spec 27) — exports the car exactly as it currently looks in the
 * showroom and hands it to the phone's own AR viewer at real-world size.
 *
 * Renders nothing unless AR can actually work here (AC-1, progressive enhancement): the
 * feature flag is on, the device has a native AR viewer, and the vehicle is backed by a real
 * 3D model (placeholder-rig vehicles are excluded — life-size primitive shapes would
 * undercut the premium experience rather than add to it). Platform detection is client-only
 * (useSyncExternalStore's server snapshot is null), so server and hydration output agree.
 */
export function ArButton({ vehicle, showroomControlsRef, sceneReady }: ArButtonProps) {
  const t = useTranslations("ar");
  const platform = useSyncExternalStore(noSubscription, detectCurrentArPlatform, serverPlatform);
  const [status, setStatus] = useState<Status>("idle");
  const busy = useRef(false);
  const config = getRealGlbVehicleConfig(vehicle.slug);

  if (!AR_ENABLED || !config || !platform) return null;

  async function handleClick() {
    if (busy.current || !config || !platform) return;
    busy.current = true;
    setStatus("preparing");
    try {
      const vehicleObject = showroomControlsRef.current?.getVehicleObject();
      if (!vehicleObject) throw new Error("AR: the vehicle model isn't loaded yet.");

      const file = await exportArModel(vehicleObject, platform, {
        lengthMeters: config.lengthMeters,
        usdzTriangleRatio: config.usdzTriangleRatio,
      });

      if (platform === "ios") {
        const url = URL.createObjectURL(new Blob([file.bytes], { type: file.mimeType }));
        openQuickLook(url);
        setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_LIFETIME_MS);
      } else {
        const { url } = await uploadArModel(file.bytes);
        openSceneViewer(url, vehicle.name);
      }
      setStatus("idle");
    } catch (error) {
      // Spec 27 observability: failures are reported per platform; the configurator itself
      // is untouched, so the user can keep configuring.
      Sentry.captureException(error, { tags: { feature: "ar", arPlatform: platform } });
      console.error(error);
      setStatus("error");
    } finally {
      busy.current = false;
    }
  }

  return (
    <div className="glass-panel flex flex-col gap-2 rounded-2xl p-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={!sceneReady || status === "preparing"}
        aria-busy={status === "preparing"}
        className="flex-1 rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 focus-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "preparing" ? t("preparing") : t("button")}
      </button>
      {status === "error" && (
        <p role="alert" className="text-center text-xs text-red-300">
          {t("error")}
        </p>
      )}
    </div>
  );
}

"use client";

import { forwardRef, useEffect, useRef, type PointerEvent } from "react";
import { useTranslations } from "next-intl";
import { MAX_LATERAL_OFFSET } from "@/lib/showroom/driveIt";
import { DRIVE_FADE_MS, type UseDriveItResult } from "./useDriveIt";

export interface DriveItButtonProps {
  onStart: () => void;
  disabled: boolean;
}

/**
 * "Drive It" (Spec 37). The caller renders this only when the user doesn't prefer reduced motion
 * (AC-6): the whole point is fast camera motion, and there's no meaningful still version.
 */
export const DriveItButton = forwardRef<HTMLButtonElement, DriveItButtonProps>(function DriveItButton({ onStart, disabled }, ref) {
  const t = useTranslations("driveIt");
  return (
    <button
      ref={ref}
      type="button"
      onClick={onStart}
      disabled={disabled}
      className="glass-panel flex items-center justify-center gap-2 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-ring"
    >
      <span aria-hidden="true">🏁</span>
      {t("button")}
    </button>
  );
});

function SteerButton({ label, direction, glyph, drive }: { label: string; direction: -1 | 1; glyph: string; drive: UseDriveItResult }) {
  const hold = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drive.setTouchInput(direction);
  };
  const release = () => drive.setTouchInput(0);
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={hold}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
      className="focus-ring flex h-14 w-14 touch-none select-none items-center justify-center rounded-full bg-black/55 text-xl text-white backdrop-blur transition active:bg-white/25"
    >
      <span aria-hidden="true">{glyph}</span>
    </button>
  );
}

/**
 * Everything drawn over the 3D view during a drive: the fade to black, and — while driving —
 * Exit (AC-5), a thin progress bar, and hold-to-steer buttons for touch (AC-7) around a
 * steering indicator. It's a HUD, not a game UI: no score, no timer, no speedometer.
 */
export function DriveItOverlay({ drive }: { drive: UseDriveItResult }) {
  const t = useTranslations("driveIt");
  const steeringRef = useRef<HTMLDivElement>(null);
  const driving = drive.state === "driving";

  // Once the drive is under way, keyboard focus sits on the steering control.
  useEffect(() => {
    if (driving) steeringRef.current?.focus();
  }, [driving]);

  if (!drive.active) return null;
  const steeringPercent = Math.round((drive.offset / MAX_LATERAL_OFFSET) * 100);
  const steeringText = t("steeringValue", {
    value: Math.abs(steeringPercent) < 5 ? "center" : steeringPercent < 0 ? "left" : "right",
  });

  return (
    <>
      <div
        aria-hidden="true"
        data-testid="drive-fade"
        className="pointer-events-none absolute inset-0 z-20 bg-black"
        style={{ opacity: drive.faded ? 1 : 0, transition: `opacity ${DRIVE_FADE_MS}ms ease-in-out` }}
      />
      {drive.state === "entering" && (
        <p role="status" className="absolute inset-0 z-30 flex items-center justify-center text-sm text-white/80">
          {t("getReady")}
        </p>
      )}
      {driving && (
        <div className="absolute inset-0 z-30 flex flex-col justify-between p-3" data-testid="drive-hud">
          <div className="flex items-center gap-3">
            <div
              role="progressbar"
              aria-label={t("progress")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(drive.progress * 100)}
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/40"
            >
              <div className="h-full rounded-full bg-white/80" style={{ width: `${drive.progress * 100}%` }} />
            </div>
            <button
              type="button"
              onClick={drive.exit}
              className="focus-ring rounded-full bg-black/60 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white backdrop-blur transition hover:bg-black/80"
            >
              {t("exit")}
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-4">
              <SteerButton label={t("steerLeft")} direction={-1} glyph="◀" drive={drive} />
              <div
                ref={steeringRef}
                role="slider"
                tabIndex={0}
                aria-label={t("steering")}
                aria-valuemin={-100}
                aria-valuemax={100}
                aria-valuenow={steeringPercent}
                aria-valuetext={steeringText}
                className="focus-ring relative h-2 w-28 rounded-full bg-black/50"
                data-testid="drive-steering"
              >
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow"
                  style={{ left: `${50 + steeringPercent / 2}%` }}
                />
              </div>
              <SteerButton label={t("steerRight")} direction={1} glyph="▶" drive={drive} />
            </div>
            <p className="rounded-full bg-black/45 px-3 py-1 text-[11px] text-white/80">{t("hint")}</p>
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { Camera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { getCameraPreset, type CameraPresetId, type CameraState, type Vec3Tuple } from "@/lib/showroom/cameraPresets";
import { withReducedMotion } from "@/lib/motion/withReducedMotion";

const TRANSITION_DURATION = 0.9; // seconds — AC-5's "fixed duration"
const DOOR_DURATION = 0.7;

export type { CameraState };

export interface CameraTransitionControls {
  currentPreset: CameraPresetId;
  doorOpenAmount: number;
  goToPreset: (id: CameraPresetId) => void;
  /** Same as goToPreset but resolves once the tween completes (0-duration under
   * reducedMotion resolves immediately) — Spec 11's capture flow needs to know when the
   * camera has actually arrived before snapshotting the frame. */
  goToPresetAsync: (id: CameraPresetId) => Promise<void>;
  /** Tweens to an arbitrary raw position/target, not just a named preset — Spec 11 uses
   * this to restore the camera to exactly where the user had it (free-orbiting via
   * OrbitControls never updates currentPreset, so restoring to "the last named preset"
   * wouldn't be correct). Pass `presetId` when the restored position corresponds to a
   * known preset the user had selected (even if slightly free-orbited since) so
   * currentPreset — and therefore CameraPresetBar's highlighted button — resyncs too;
   * omit it for a position that was never a named preset (e.g. pure free-orbit). */
  goToRaw: (state: CameraState, options?: { isInterior?: boolean; presetId?: CameraPresetId }) => Promise<void>;
  /** A synchronous snapshot of the camera's current position/target, or null before the
   * scene has mounted. */
  getCurrentCameraState: () => CameraState | null;
}

/**
 * Eases the camera + OrbitControls target to a named preset over a fixed duration (AC-5),
 * and drives the door hinge open/closed in parallel when entering/leaving Interior or
 * Cockpit (AC-6). Reduced motion collapses every tween to an instant set (AC-10) — this is
 * the first real use of GSAP in this codebase, reserved for exactly this kind of
 * choreographed (not simple opacity/transform) animation per Spec 03/04's planning notes.
 *
 * goToPresetAsync/goToRaw/getCurrentCameraState (Spec 11) share the same tween machinery
 * as goToPreset via the internal runTween — not a parallel implementation.
 */
export function useCameraTransition(
  cameraRef: React.RefObject<Camera | null>,
  controlsRef: React.RefObject<OrbitControlsImpl | null>,
  reducedMotion: boolean,
): CameraTransitionControls {
  const [currentPreset, setCurrentPreset] = useState<CameraPresetId>("default");
  const [doorOpenAmount, setDoorOpenAmount] = useState(0);
  const doorAmountRef = useRef(0);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const doorTweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    doorAmountRef.current = doorOpenAmount;
  }, [doorOpenAmount]);

  const runTween = useCallback(
    (position: Vec3Tuple, target: Vec3Tuple, isInterior: boolean): Promise<void> => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return Promise.resolve();

      tweenRef.current?.kill();
      doorTweenRef.current?.kill();

      const from = {
        px: camera.position.x,
        py: camera.position.y,
        pz: camera.position.z,
        tx: controls.target.x,
        ty: controls.target.y,
        tz: controls.target.z,
      };

      const duration = withReducedMotion(reducedMotion, TRANSITION_DURATION, 0);

      const cameraArrived = new Promise<void>((resolve) => {
        tweenRef.current = gsap.to(from, {
          px: position.x,
          py: position.y,
          pz: position.z,
          tx: target.x,
          ty: target.y,
          tz: target.z,
          duration,
          ease: "power2.inOut",
          onUpdate: () => {
            camera.position.set(from.px, from.py, from.pz);
            controls.target.set(from.tx, from.ty, from.tz);
            controls.update();
          },
          onComplete: () => resolve(),
        });
      });

      const doorState = { amount: doorAmountRef.current };
      doorTweenRef.current = gsap.to(doorState, {
        amount: isInterior ? 1 : 0,
        duration: withReducedMotion(reducedMotion, DOOR_DURATION, 0),
        ease: "power2.inOut",
        onUpdate: () => setDoorOpenAmount(doorState.amount),
      });

      return cameraArrived;
    },
    [cameraRef, controlsRef, reducedMotion],
  );

  const goToPreset = useCallback(
    (id: CameraPresetId) => {
      const preset = getCameraPreset(id);
      setCurrentPreset(id);
      void runTween(preset.position, preset.target, preset.isInterior);
    },
    [runTween],
  );

  const goToPresetAsync = useCallback(
    async (id: CameraPresetId) => {
      const preset = getCameraPreset(id);
      setCurrentPreset(id);
      await runTween(preset.position, preset.target, preset.isInterior);
    },
    [runTween],
  );

  const goToRaw = useCallback(
    async (state: CameraState, options?: { isInterior?: boolean; presetId?: CameraPresetId }) => {
      if (options?.presetId) {
        setCurrentPreset(options.presetId);
      }
      await runTween(state.position, state.target, options?.isInterior ?? false);
    },
    [runTween],
  );

  const getCurrentCameraState = useCallback((): CameraState | null => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return null;
    return {
      position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      target: { x: controls.target.x, y: controls.target.y, z: controls.target.z },
    };
  }, [cameraRef, controlsRef]);

  return {
    currentPreset,
    doorOpenAmount,
    goToPreset,
    goToPresetAsync,
    goToRaw,
    getCurrentCameraState,
  };
}

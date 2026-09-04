"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import type { Camera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { getCameraPreset, type CameraPresetId } from "@/lib/showroom/cameraPresets";

const TRANSITION_DURATION = 0.9; // seconds — AC-5's "fixed duration"
const DOOR_DURATION = 0.7;

export interface CameraTransitionControls {
  currentPreset: CameraPresetId;
  doorOpenAmount: number;
  goToPreset: (id: CameraPresetId) => void;
}

/**
 * Eases the camera + OrbitControls target to a named preset over a fixed duration (AC-5),
 * and drives the door hinge open/closed in parallel when entering/leaving Interior or
 * Cockpit (AC-6). Reduced motion collapses every tween to an instant set (AC-10) — this is
 * the first real use of GSAP in this codebase, reserved for exactly this kind of
 * choreographed (not simple opacity/transform) animation per Spec 03/04's planning notes.
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

  const goToPreset = useCallback(
    (id: CameraPresetId) => {
      const camera = cameraRef.current;
      const controls = controlsRef.current;
      if (!camera || !controls) return;

      const preset = getCameraPreset(id);
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

      const duration = reducedMotion ? 0 : TRANSITION_DURATION;

      tweenRef.current = gsap.to(from, {
        px: preset.position.x,
        py: preset.position.y,
        pz: preset.position.z,
        tx: preset.target.x,
        ty: preset.target.y,
        tz: preset.target.z,
        duration,
        ease: "power2.inOut",
        onUpdate: () => {
          camera.position.set(from.px, from.py, from.pz);
          controls.target.set(from.tx, from.ty, from.tz);
          controls.update();
        },
      });

      const doorState = { amount: doorAmountRef.current };
      doorTweenRef.current = gsap.to(doorState, {
        amount: preset.isInterior ? 1 : 0,
        duration: reducedMotion ? 0 : DOOR_DURATION,
        ease: "power2.inOut",
        onUpdate: () => setDoorOpenAmount(doorState.amount),
      });

      setCurrentPreset(id);
    },
    [cameraRef, controlsRef, reducedMotion],
  );

  return { currentPreset, doorOpenAmount, goToPreset };
}

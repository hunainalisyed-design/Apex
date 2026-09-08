"use client";

import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Camera } from "three";
import { PlaceholderShowroomRig, type HoveredMesh } from "./PlaceholderShowroomRig";
import { useCameraTransition, type CameraTransitionControls } from "./useCameraTransition";
import { SHOWROOM_CAMERA_BOUNDS } from "@/lib/showroom/camera";
import { getCameraPreset, type CameraPresetId } from "@/lib/showroom/cameraPresets";
import { findHotspot } from "@/lib/showroom/hotspots";
import { DEFAULT_ACCESSORY_APPEARANCE, type AccessoryAppearance } from "@/lib/showroom/accessoryAppearance";
import { DEFAULT_EXTERIOR_APPEARANCE, type ExteriorAppearance } from "@/lib/showroom/exteriorAppearance";
import { DEFAULT_INTERIOR_APPEARANCE, type InteriorAppearance } from "@/lib/showroom/interiorAppearance";
import type { OptionCategory } from "@/types/catalog";

export interface HoverLabel {
  category: OptionCategory;
  x: number;
  y: number;
}

/** Control handles exposed once the scene is ready (Spec 5's original goToPreset, plus
 * Spec 11's capture-flow additions) — bundled into one onReady payload since these are all
 * "here are your handles" rather than an ongoing state stream (which onPresetChange/onHover
 * correctly stay as separate props for). */
export interface ShowroomControls {
  goToPreset: (id: CameraPresetId) => void;
  goToPresetAsync: (id: CameraPresetId) => Promise<void>;
  goToRaw: CameraTransitionControls["goToRaw"];
  getCurrentCameraState: CameraTransitionControls["getCurrentCameraState"];
  /** Captures the current frame as a PNG data URL — requires preserveDrawingBuffer on the
   * renderer (set below), otherwise the WebGL buffer may already be cleared by the time
   * this is called outside the render loop. */
  captureFrame: () => string;
}

interface ShowroomRigProps {
  headlightsOn: boolean;
  brakePulsing: boolean;
  reducedMotion: boolean;
  appearance: ExteriorAppearance;
  interior: InteriorAppearance;
  accessories: AccessoryAppearance;
  onReady: (controls: ShowroomControls) => void;
  onPresetChange: (id: CameraPresetId) => void;
  onHover: (hover: HoverLabel | null) => void;
}

function ShowroomRig({
  headlightsOn,
  brakePulsing,
  reducedMotion,
  appearance,
  interior,
  accessories,
  onReady,
  onPresetChange,
  onHover,
}: ShowroomRigProps) {
  const { camera, gl } = useThree();
  const cameraRef = useRef<Camera | null>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  const { currentPreset, doorOpenAmount, goToPreset, goToPresetAsync, goToRaw, getCurrentCameraState } =
    useCameraTransition(cameraRef, controlsRef, reducedMotion);

  useEffect(() => {
    onReady({
      goToPreset,
      goToPresetAsync,
      goToRaw,
      getCurrentCameraState,
      captureFrame: () => gl.domElement.toDataURL("image/png"),
    });
  }, [goToPreset, goToPresetAsync, goToRaw, getCurrentCameraState, gl, onReady]);

  useEffect(() => {
    onPresetChange(currentPreset);
  }, [currentPreset, onPresetChange]);

  const handleHoverMesh = (hover: HoveredMesh | null) => {
    if (!hover) {
      onHover(null);
      return;
    }
    const hotspot = findHotspot(hover.meshName);
    onHover(hotspot ? { category: hotspot.category, x: hover.x, y: hover.y } : null);
  };

  const defaultPreset = getCameraPreset("default");

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={1.3} />
      <directionalLight position={[-4, 2, -5]} intensity={0.35} color="#3d6fe0" />
      <PlaceholderShowroomRig
        doorOpenAmount={doorOpenAmount}
        headlightsOn={headlightsOn}
        brakePulsing={brakePulsing}
        onHoverMesh={handleHoverMesh}
        interior={interior}
        accessories={accessories}
        {...appearance}
      />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={SHOWROOM_CAMERA_BOUNDS.minDistance}
        maxDistance={SHOWROOM_CAMERA_BOUNDS.maxDistance}
        target={[defaultPreset.target.x, defaultPreset.target.y, defaultPreset.target.z]}
        autoRotate={!reducedMotion && currentPreset === "default"}
        autoRotateSpeed={0.6}
      />
    </>
  );
}

export interface ShowroomSceneProps {
  headlightsOn: boolean;
  brakePulsing: boolean;
  reducedMotion: boolean;
  appearance?: ExteriorAppearance;
  interior?: InteriorAppearance;
  accessories?: AccessoryAppearance;
  onReady: (controls: ShowroomControls) => void;
  onPresetChange: (id: CameraPresetId) => void;
  onHover: (hover: HoverLabel | null) => void;
}

export function ShowroomScene({
  appearance = DEFAULT_EXTERIOR_APPEARANCE,
  interior = DEFAULT_INTERIOR_APPEARANCE,
  accessories = DEFAULT_ACCESSORY_APPEARANCE,
  ...props
}: ShowroomSceneProps) {
  const defaultPreset = getCameraPreset("default");

  return (
    <Canvas
      camera={{
        position: [defaultPreset.position.x, defaultPreset.position.y, defaultPreset.position.z],
        fov: 40,
      }}
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <ShowroomRig {...props} appearance={appearance} interior={interior} accessories={accessories} />
    </Canvas>
  );
}

// Re-exported for the hover-tracking state type consumers need without reaching into ShowroomRig.
export type { HoveredMesh } from "./PlaceholderShowroomRig";

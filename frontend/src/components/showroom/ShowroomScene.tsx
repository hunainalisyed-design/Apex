"use client";

import { useEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  GradientTexture,
  GradientType,
  MeshReflectorMaterial,
  OrbitControls,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Camera, Group } from "three";
import {
  PlaceholderShowroomRig,
  type HoveredMesh,
} from "./PlaceholderShowroomRig";
import { RealGlbShowroomRig } from "./RealGlbShowroomRig";
import { SceneEnvironment } from "./SceneEnvironment";
import type { EnvironmentSceneSettings } from "@/lib/showroom/environment";
import { detectDoorEvent, type DoorEvent } from "@/lib/sound/cues";
import { getRealGlbVehicleConfig } from "@/lib/showroom/realGlbVehicles";
import {
  useCameraTransition,
  type CameraTransitionControls,
} from "./useCameraTransition";
import { SHOWROOM_CAMERA_BOUNDS } from "@/lib/showroom/camera";
import {
  getCameraPreset,
  type CameraPresetId,
} from "@/lib/showroom/cameraPresets";
import { findHotspot } from "@/lib/showroom/hotspots";
import {
  DEFAULT_ACCESSORY_APPEARANCE,
  type AccessoryAppearance,
} from "@/lib/showroom/accessoryAppearance";
import {
  DEFAULT_EXTERIOR_APPEARANCE,
  type ExteriorAppearance,
} from "@/lib/showroom/exteriorAppearance";
import {
  DEFAULT_INTERIOR_APPEARANCE,
  type InteriorAppearance,
} from "@/lib/showroom/interiorAppearance";
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
  /** The real-GLB car currently in the scene, for AR export (Spec 27) — null for the
   * placeholder rig (AR is offered only for real models) or before the model has loaded. */
  getVehicleObject: () => Group | null;
}

interface ShowroomRigProps {
  vehicleSlug: string;
  modelUrl: string;
  headlightsOn: boolean;
  brakePulsing: boolean;
  reducedMotion: boolean;
  appearance: ExteriorAppearance;
  interior: InteriorAppearance;
  accessories: AccessoryAppearance;
  onReady: (controls: ShowroomControls) => void;
  onPresetChange: (id: CameraPresetId) => void;
  onHover: (hover: HoverLabel | null) => void;
  environment: EnvironmentSceneSettings | null;
  onEnvironmentReady: () => void;
  onEnvironmentError: (error: unknown) => void;
  onDoorEvent: (event: Exclude<DoorEvent, null>) => void;
}

function ShowroomRig({
  vehicleSlug,
  modelUrl,
  headlightsOn,
  brakePulsing,
  reducedMotion,
  appearance,
  interior,
  accessories,
  onReady,
  onPresetChange,
  onHover,
  environment,
  onEnvironmentReady,
  onEnvironmentError,
  onDoorEvent,
}: ShowroomRigProps) {
  const { camera, gl } = useThree();
  const cameraRef = useRef<Camera | null>(null);
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const vehicleRef = useRef<Group>(null);

  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  const {
    currentPreset,
    doorOpenAmount,
    goToPreset,
    goToPresetAsync,
    goToRaw,
    getCurrentCameraState,
  } = useCameraTransition(cameraRef, controlsRef, reducedMotion);

  useEffect(() => {
    onReady({
      goToPreset,
      goToPresetAsync,
      goToRaw,
      getCurrentCameraState,
      captureFrame: () => gl.domElement.toDataURL("image/png"),
      getVehicleObject: () => vehicleRef.current,
    });
  }, [
    goToPreset,
    goToPresetAsync,
    goToRaw,
    getCurrentCameraState,
    gl,
    onReady,
  ]);

  useEffect(() => {
    onPresetChange(currentPreset);
  }, [currentPreset, onPresetChange]);

  const handleHoverMesh = (hover: HoveredMesh | null) => {
    if (!hover) {
      onHover(null);
      return;
    }
    const hotspot = findHotspot(hover.meshName);
    onHover(
      hotspot ? { category: hotspot.category, x: hover.x, y: hover.y } : null,
    );
  };

  const defaultPreset = getCameraPreset("default");
  const realGlbConfig = getRealGlbVehicleConfig(vehicleSlug);

  // Spec 29: door latch/thud as the doors actually swing. Only the placeholder rig animates its
  // doors — real-model cars never fire these (no sound for motion that isn't on screen).
  const previousDoorAmount = useRef(doorOpenAmount);
  useEffect(() => {
    const event = detectDoorEvent(previousDoorAmount.current, doorOpenAmount);
    previousDoorAmount.current = doorOpenAmount;
    if (event && !realGlbConfig) onDoorEvent(event);
  }, [doorOpenAmount, realGlbConfig, onDoorEvent]);

  // Where the showroom floor sits, in world units — not a car position/scale change: each
  // rig already places its own geometry differently (RealGlbShowroomRig explicitly zeros
  // its box.min.y so the car's lowest point sits at world y=0; PlaceholderShowroomRig's
  // wheels are modeled with their *center* at y=0 and a 0.32 radius, so their bottom sits
  // at y=-0.32). The floor just needs to sit at whichever of those two ground levels the
  // active rig already uses so it meets the wheels instead of clipping through them or
  // floating below.
  const floorY = realGlbConfig ? 0 : -0.32;
  // Spec 28: the studio backdrop and reflective floor only belong to the Studio environment;
  // outdoor scenes replace both with their own HDRI projected onto the ground. No environment
  // at all (the API was unreachable) keeps today's studio look.
  const studioBackdrop = !environment || environment.showStudioFloor;

  return (
    <>
      {/* Replaces the WebGL default black clear color with a cool silver/gray studio
       * gradient plus a soft blue glow centered behind the vehicle (a real scene.background,
       * so it's captured by CaptureBuild's gl.domElement.toDataURL too, unlike a CSS-only
       * backdrop) — visual polish only, no effect on lighting, camera, or the model itself.
       * Deliberately light (not the dark-navy/black tried previously): a light backdrop is
       * what actually gives dark-painted cars contrast, which a dark backdrop cannot. */}
      {studioBackdrop && (
        <GradientTexture
          attach="background"
          type={GradientType.Radial}
          innerCircleRadius={0}
          outerCircleRadius="auto"
          stops={[0, 1]}
          colors={["#dcebf8", "#c7ccd2"]}
          size={512}
        />
      )}
      {environment && (
        <group position={[0, floorY, 0]}>
          <SceneEnvironment
            settings={environment}
            onReady={onEnvironmentReady}
            onError={onEnvironmentError}
          />
        </group>
      )}
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 5]} intensity={1.3} />
      <directionalLight
        position={[-4, 2, -5]}
        intensity={0.35}
        color="#3d6fe0"
      />
      {realGlbConfig ? (
        <group ref={vehicleRef}>
          <RealGlbShowroomRig
            config={realGlbConfig}
            modelUrl={modelUrl}
            appearance={appearance}
          />
        </group>
      ) : (
        <PlaceholderShowroomRig
          doorOpenAmount={doorOpenAmount}
          headlightsOn={headlightsOn}
          brakePulsing={brakePulsing}
          onHoverMesh={handleHoverMesh}
          interior={interior}
          accessories={accessories}
          {...appearance}
        />
      )}
      {/* Studio floor: a very subtle mirror-like reflector (low `mirror`/`mixStrength`, per
       * the brief's "very subtle floor reflection") plus drei's ContactShadows for a soft,
       * realistic shadow blob under the vehicle — both purely environment, not part of any
       * vehicle rig, so they apply uniformly regardless of which rig is active above. */}
      {studioBackdrop && (
        <mesh
          position={[0, floorY, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[40, 40]} />
          <MeshReflectorMaterial
            blur={[300, 100]}
            resolution={1024}
            mixBlur={1}
            mixStrength={8}
            depthScale={1}
            minDepthThreshold={0.85}
            color="#9aa3ab"
            metalness={0.4}
            roughness={1}
            mirror={0.15}
          />
        </mesh>
      )}
      <ContactShadows
        position={[0, floorY + 0.001, 0]}
        opacity={0.55}
        scale={12}
        blur={2.4}
        far={4}
        resolution={512}
        color="#0a0e14"
      />
      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        minDistance={SHOWROOM_CAMERA_BOUNDS.minDistance}
        maxDistance={SHOWROOM_CAMERA_BOUNDS.maxDistance}
        target={[
          defaultPreset.target.x,
          defaultPreset.target.y,
          defaultPreset.target.z,
        ]}
        autoRotate={!reducedMotion && currentPreset === "default"}
        autoRotateSpeed={0.6}
      />
    </>
  );
}

const noop = () => {};

export interface ShowroomSceneProps {
  vehicleSlug: string;
  /** The vehicle's content-addressed showroomModelUrl (Spec 25) — loaded for real-GLB
   * vehicles; ignored by the placeholder rig. */
  modelUrl: string;
  headlightsOn: boolean;
  brakePulsing: boolean;
  reducedMotion: boolean;
  appearance?: ExteriorAppearance;
  interior?: InteriorAppearance;
  accessories?: AccessoryAppearance;
  onReady: (controls: ShowroomControls) => void;
  onPresetChange: (id: CameraPresetId) => void;
  onHover: (hover: HoverLabel | null) => void;
  /** Spec 28: the active environment's scene settings; null = none available (studio look). */
  environment?: EnvironmentSceneSettings | null;
  onEnvironmentReady?: () => void;
  onEnvironmentError?: (error: unknown) => void;
  /** Spec 29: the placeholder rig's doors started opening / finished closing. */
  onDoorEvent?: (event: Exclude<DoorEvent, null>) => void;
}

export function ShowroomScene({
  appearance = DEFAULT_EXTERIOR_APPEARANCE,
  interior = DEFAULT_INTERIOR_APPEARANCE,
  accessories = DEFAULT_ACCESSORY_APPEARANCE,
  environment = null,
  onEnvironmentReady = noop,
  onEnvironmentError = noop,
  onDoorEvent = noop,
  ...props
}: ShowroomSceneProps) {
  const defaultPreset = getCameraPreset("default");

  return (
    <Canvas
      camera={{
        position: [
          defaultPreset.position.x,
          defaultPreset.position.y,
          defaultPreset.position.z,
        ],
        fov: 40,
      }}
      dpr={[1, 2]}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
    >
      <ShowroomRig
        {...props}
        appearance={appearance}
        interior={interior}
        accessories={accessories}
        environment={environment}
        onEnvironmentReady={onEnvironmentReady}
        onEnvironmentError={onEnvironmentError}
        onDoorEvent={onDoorEvent}
      />
    </Canvas>
  );
}

// Re-exported for the hover-tracking state type consumers need without reaching into ShowroomRig.
export type { HoveredMesh } from "./PlaceholderShowroomRig";

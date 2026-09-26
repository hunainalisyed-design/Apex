"use client";

import { useCallback, useEffect, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  GradientTexture,
  GradientType,
  MeshReflectorMaterial,
  OrbitControls,
} from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { PerspectiveCamera, type Camera, type Group } from "three";
import {
  PlaceholderShowroomRig,
  type HoveredMesh,
} from "./PlaceholderShowroomRig";
import { RealGlbShowroomRig } from "./RealGlbShowroomRig";
import { SceneEnvironment } from "./SceneEnvironment";
import type { EnvironmentSceneSettings } from "@/lib/showroom/environment";
import { detectDoorEvent, type DoorEvent } from "@/lib/sound/cues";
import {
  VIDEO_DURATION_MS,
  VIDEO_FRAME_COUNT,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  encodeFramesToMp4,
  orbitCameraPose,
  recordCanvasClip,
  type VideoStrategy,
} from "@/lib/showroom/composeCaptureVideo";
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
  /** Spec 30: records a vertical 9:16 clip of one scripted 360° orbit and resolves with the
   * encoded video. The scene renders at 720×1280 with a portrait camera for the duration
   * (the page layout doesn't change), then size, camera and controls are restored. */
  recordOrbit: (options: RecordOrbitOptions) => Promise<Blob>;
}

export interface RecordOrbitOptions {
  /** "frames" (WebCodecs, preferred) or "realtime" (MediaRecorder) — see pickVideoStrategy. */
  strategy: Exclude<VideoStrategy, { unsupported: unknown }>;
  /** Draws the title cards on top of each frame. */
  drawOverlay: (ctx: CanvasRenderingContext2D, timeMs: number) => void;
  onProgress?: (fraction: number) => void;
  /** Cancels the capture (it rejects with an AbortError); state is still restored. */
  signal?: AbortSignal;
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
  const getThree = useThree((state) => state.get);
  // Spec 30: while set, the camera follows the scripted orbit instead of the user's controls —
  // by wall-clock time (real-time recording) or at an exact point (frame-by-frame).
  const orbitRef = useRef<{ start: number } | { progress: number } | null>(null);

  useFrame((state) => {
    const orbit = orbitRef.current;
    if (!orbit) return;
    const progress = "progress" in orbit ? orbit.progress : (performance.now() - orbit.start) / VIDEO_DURATION_MS;
    const pose = orbitCameraPose(progress);
    state.camera.position.set(...pose.position);
    state.camera.lookAt(...pose.target);
  });

  const recordOrbit = useCallback(
    async ({ strategy, drawOverlay, onProgress, signal }: RecordOrbitOptions): Promise<Blob> => {
      // Read the live camera/renderer from the r3f store rather than render-time hook values:
      // this runs long after render and has to mutate them.
      const { camera, gl: renderer, advance, setFrameloop, frameloop } = getThree();
      const controls = controlsRef.current;
      if (!(camera instanceof PerspectiveCamera)) throw new Error("Video capture needs a perspective camera.");
      const previous = {
        position: camera.position.clone(),
        target: controls?.target.clone(),
        aspect: camera.aspect,
        controlsEnabled: controls?.enabled ?? true,
      };

      // Render portrait for the clip. updateStyle=false keeps the canvas's on-page size, so
      // the layout doesn't jump; the showroom covers the scene with a "Recording" overlay.
      if (controls) controls.enabled = false; // a disabled OrbitControls doesn't update
      renderer.setPixelRatio(1);
      renderer.setSize(VIDEO_WIDTH, VIDEO_HEIGHT, false);
      camera.aspect = VIDEO_WIDTH / VIDEO_HEIGHT;
      camera.updateProjectionMatrix();

      try {
        if (strategy.kind === "frames") {
          // Frame-by-frame: stop the render loop and render each frame on demand at its exact
          // point in the orbit, so the clip is complete however slow this device renders.
          setFrameloop("never");
          return await encodeFramesToMp4({
            codec: strategy.codec,
            signal,
            onProgress,
            renderFrame: (ctx, index, timeMs) => {
              orbitRef.current = { progress: index / VIDEO_FRAME_COUNT }; // frame N ≡ frame 0: seamless loop
              advance(performance.now());
              ctx.fillStyle = "#0a0a0c";
              ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
              ctx.drawImage(renderer.domElement, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
              drawOverlay(ctx, timeMs);
            },
          });
        }
        orbitRef.current = { start: performance.now() };
        return await recordCanvasClip({ source: renderer.domElement, format: strategy.format, signal, drawOverlay, onProgress });
      } finally {
        orbitRef.current = null;
        // Best-effort: if the showroom was torn down mid-capture (the reason it was cancelled),
        // the renderer may already be disposed — never let restoring mask the real outcome.
        try {
          setFrameloop(frameloop);
          const { size, viewport } = getThree();
          renderer.setPixelRatio(viewport.dpr);
          renderer.setSize(size.width, size.height, false);
          camera.aspect = previous.aspect;
          camera.updateProjectionMatrix();
          camera.position.copy(previous.position);
          if (controls) {
            if (previous.target) controls.target.copy(previous.target);
            controls.enabled = previous.controlsEnabled;
            controls.update();
          }
        } catch (restoreError) {
          console.warn("[video] Couldn't restore the showroom after capture.", restoreError);
        }
      }
    },
    [getThree],
  );

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
      recordOrbit,
    });
  }, [
    recordOrbit,
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

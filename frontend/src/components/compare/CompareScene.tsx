"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { CanvasTexture, SRGBColorSpace } from "three";
import { PlaceholderShowroomRig } from "@/components/showroom/PlaceholderShowroomRig";
import { RealGlbShowroomRig } from "@/components/showroom/RealGlbShowroomRig";
import { getRealGlbVehicleConfig } from "@/lib/showroom/realGlbVehicles";
import type { AccessoryAppearance } from "@/lib/showroom/accessoryAppearance";
import type { ExteriorAppearance } from "@/lib/showroom/exteriorAppearance";
import type { InteriorAppearance } from "@/lib/showroom/interiorAppearance";

export interface CompareVehicleAppearance {
  /** Which catalog vehicle this slot is showing — drives the same realGlbVehicles.ts rig
   * dispatch ShowroomScene.tsx uses, so a vehicle with a real GLB renders that GLB here
   * too instead of the procedural stand-in. */
  slug: string;
  /** That vehicle's content-addressed showroomModelUrl (Spec 25), resolved alongside its slug. */
  modelUrl: string;
  appearance: ExteriorAppearance;
  interior: InteriorAppearance;
  accessories: AccessoryAppearance;
}

export interface CompareSceneProps {
  left: CompareVehicleAppearance;
  right: CompareVehicleAppearance;
  reducedMotion: boolean;
}

// Half the gap between the two cars' centers — the rig's real geometry (body box plus
// front/rear accessories) spans roughly x∈[-1.31,1.31], so this leaves a clearly visible
// ~2.6-unit gap between the nearest edges rather than the cars touching or overlapping.
const OFFSET_X = 2.6;

// PlaceholderShowroomRig draws itself inside a root <group position={[0,-0.3,0]}> with its
// wheels centred at that group's y=0 and a 0.32 radius, so its tyres meet the ground at
// y=-0.62. RealGlbShowroomRig instead zeroes its own box.min.y, i.e. its ground is y=0.
// Dropping a real-GLB slot by this much puts both kinds of slot on one shared ground plane
// (otherwise a real car would hover ~0.6 units above a placeholder one beside it), and
// leaves the existing placeholder framing/camera untouched.
const PLACEHOLDER_GROUND_Y = -0.62;

const noop = () => {};

/** A faint pool of blue light on the floor under the cars, fading to nothing at its edges. */
function FloorGlow() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 256;
    const context = canvas.getContext("2d");
    if (!context) return null;
    const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, "rgb(77 163 255 / 0.3)");
    gradient.addColorStop(1, "rgb(77 163 255 / 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);
    const made = new CanvasTexture(canvas);
    made.colorSpace = SRGBColorSpace;
    return made;
  }, []);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    <mesh position={[0, PLACEHOLDER_GROUND_Y - 0.002, 0]} rotation-x={-Math.PI / 2}>
      <planeGeometry args={[20, 10]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

/**
 * One comparison slot. Dispatches on the slot's own slug exactly the way ShowroomScene.tsx
 * does — a vehicle backed by a real GLB renders that GLB, and the procedural rig stays only
 * for the vehicles that genuinely have no asset yet (docs/CLAUDE.md's "Known open blocker"),
 * never as a fallback masking a failed load: a missing/broken GLB throws past this to
 * CompareSceneErrorBoundary, which surfaces it rather than hiding it behind a stand-in.
 */
function CompareVehicleRig({ vehicle }: { vehicle: CompareVehicleAppearance }) {
  const realGlbConfig = getRealGlbVehicleConfig(vehicle.slug);

  if (realGlbConfig) {
    return (
      <group position={[0, PLACEHOLDER_GROUND_Y, 0]}>
        <Suspense fallback={null}>
          <RealGlbShowroomRig config={realGlbConfig} modelUrl={vehicle.modelUrl} appearance={vehicle.appearance} />
        </Suspense>
      </group>
    );
  }

  return (
    <PlaceholderShowroomRig
      doorOpenAmount={0}
      headlightsOn={false}
      brakePulsing={false}
      onHoverMesh={noop}
      interior={vehicle.interior}
      accessories={vehicle.accessories}
      {...vehicle.appearance}
    />
  );
}

/**
 * Both compared vehicles' default (non-customized) configurations, side by side under one
 * shared camera (Spec 18, AC-5) — no camera-preset switching UI, unlike the single-vehicle
 * showroom, so cameraPresets.ts/useCameraTransition.ts (built for a single centered
 * vehicle) aren't reused here. Same ambient+directional lighting ShowroomScene.tsx's
 * ShowroomRig uses — PlaceholderShowroomRig itself has no lights of its own. No
 * preserveDrawingBuffer (that exists on the single-vehicle scene only for Spec 11's
 * screenshot capture, which Compare doesn't have) and no hover/hotspot wiring (Compare's
 * 3D view is view-only — the rig's mesh names aren't vehicle-qualified, which would only
 * matter if two rigs' hover events needed to be told apart).
 */
export function CompareScene({ left, right, reducedMotion }: CompareSceneProps) {
  const [ready, setReady] = useState(false);
  // "grabbing" while a drag is under way. Tracked by hand: the orbit controls capture the
  // pointer, so CSS :active can't be relied on to hold for the whole drag.
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    if (!dragging) return;
    const stop = () => setDragging(false);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    window.addEventListener("blur", stop); // released over another window
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      window.removeEventListener("blur", stop);
    };
  }, [dragging]);

  return (
    // grab / grabbing: the cars can be turned by dragging.
    <div
      data-compare-scene-ready={ready}
      onPointerDown={() => setDragging(true)}
      className={`h-full w-full ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
    >
      <Canvas
        camera={{ position: [3.5, 2.2, 9], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onCreated={() => setReady(true)}
      >
        {/* A soft studio rig over the navy stage. This view sits farther back to fit two cars,
            and many catalog default paints are dark, so: a sky/ground fill, a key from the
            top-front, a cool side fill, and a blue rim from behind that traces each car's
            silhouette against the background. */}
        <hemisphereLight args={["#dbe9ff", "#0b2942", 0.9]} />
        <directionalLight position={[4, 7, 6]} intensity={1.8} />
        <directionalLight position={[-7, 3, 3]} intensity={0.6} color="#b8c7d9" />
        <directionalLight position={[0, 4, -8]} intensity={1} color="#a9cdf5" />
        {/* Soft reflections for paint, glass and chrome — built from light panels in code, so
            there's nothing to download. Neutral, so every paint shows its true colour. */}
        <Environment resolution={256} frames={1}>
          <Lightformer form="rect" intensity={2} color="#ffffff" position={[0, 6, 2]} rotation-x={Math.PI / 2} scale={[12, 3, 1]} />
          <Lightformer form="rect" intensity={1} color="#b8c7d9" position={[-8, 2, 0]} rotation-y={Math.PI / 2} scale={[10, 2, 1]} />
          <Lightformer form="rect" intensity={1} color="#ffffff" position={[8, 2, 0]} rotation-y={-Math.PI / 2} scale={[10, 2, 1]} />
        </Environment>

        {/* The floor: a faint blue pool of light under the cars, and soft contact shadows. The
            shadows update every frame (kept cheap at 256px): the cars load in asynchronously
            and can be swapped from the selectors, so a shadow baked once would miss a car
            that arrives late, or keep the old car's after a swap. */}
        <FloorGlow />
        <ContactShadows position={[0, PLACEHOLDER_GROUND_Y, 0]} opacity={0.7} scale={[16, 8]} blur={2.4} far={3} resolution={256} color="#01070d" />

        {/* key={slug} so changing one slot's vehicle remounts that slot alone — the new
            car's GLB loads from scratch and the previous one's cloned scene/materials are
            dropped, with the other slot left completely untouched. */}
        <group position={[-OFFSET_X, 0, 0]}>
          <CompareVehicleRig key={left.slug} vehicle={left} />
        </group>
        <group position={[OFFSET_X, 0, 0]}>
          <CompareVehicleRig key={right.slug} vehicle={right} />
        </group>

        <OrbitControls
          enablePan={false}
          minDistance={6}
          maxDistance={24}
          target={[0, 0.6, 0]}
          // Turn all the way round, but never below the floor.
          maxPolarAngle={Math.PI / 2 - 0.05}
          autoRotate={!reducedMotion}
          autoRotateSpeed={0.4}
        />
      </Canvas>
    </div>
  );
}

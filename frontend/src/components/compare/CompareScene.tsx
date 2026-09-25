"use client";

import { Suspense, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
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

  return (
    <div data-compare-scene-ready={ready} className="h-full w-full">
      <Canvas
        camera={{ position: [3.5, 2.2, 9], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true }}
        onCreated={() => setReady(true)}
      >
        {/* Brighter than the single-vehicle scene's lighting (ambient 0.55, key 1.3) —
            this view sits farther back to fit two cars, and with many catalog default
            paints landing on dark colors, the extra contrast keeps both cars legible
            rather than reading as near-black silhouettes. */}
        <ambientLight intensity={0.75} />
        <directionalLight position={[4, 6, 5]} intensity={1.8} />
        <directionalLight position={[-4, 2, -5]} intensity={0.5} color="#3d6fe0" />

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
          autoRotate={!reducedMotion}
          autoRotateSpeed={0.4}
        />
      </Canvas>
    </div>
  );
}

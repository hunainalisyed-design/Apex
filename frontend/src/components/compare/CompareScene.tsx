"use client";

import { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PlaceholderShowroomRig } from "@/components/showroom/PlaceholderShowroomRig";
import type { AccessoryAppearance } from "@/lib/showroom/accessoryAppearance";
import type { ExteriorAppearance } from "@/lib/showroom/exteriorAppearance";
import type { InteriorAppearance } from "@/lib/showroom/interiorAppearance";

export interface CompareVehicleAppearance {
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

const noop = () => {};

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

        <group position={[-OFFSET_X, 0, 0]}>
          <PlaceholderShowroomRig
            doorOpenAmount={0}
            headlightsOn={false}
            brakePulsing={false}
            onHoverMesh={noop}
            interior={left.interior}
            accessories={left.accessories}
            {...left.appearance}
          />
        </group>
        <group position={[OFFSET_X, 0, 0]}>
          <PlaceholderShowroomRig
            doorOpenAmount={0}
            headlightsOn={false}
            brakePulsing={false}
            onHoverMesh={noop}
            interior={right.interior}
            accessories={right.accessories}
            {...right.appearance}
          />
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

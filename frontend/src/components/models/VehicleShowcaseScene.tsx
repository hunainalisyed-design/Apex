"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import { HeroVehicleModel } from "../landing/HeroVehicleModel";

export interface VehicleShowcaseSceneProps {
  modelUrl: string;
  targetLength: number;
}

/**
 * A compact, always-rotating preview of a real-GLB catalog vehicle (realGlbVehicles.ts) —
 * generalized from the original Porsche-only PorscheShowcaseScene (see git history) once a
 * second real-GLB vehicle needed the identical scene, parameterized by model URL and
 * auto-fit target length instead of duplicated per car. No reveal-sequence choreography
 * needed here, just a tighter camera/target-length framing for the /models page's small
 * card area.
 */
export function VehicleShowcaseScene({ modelUrl, targetLength }: VehicleShowcaseSceneProps) {
  return (
    <Canvas camera={{ position: [0, 0.5, 4.2], fov: 32 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 5]} intensity={1.2} />
      <directionalLight position={[-4, 2, -5]} intensity={0.4} color="#3d6fe0" />
      <Suspense fallback={null}>
        <HeroVehicleModel modelUrl={modelUrl} targetLength={targetLength} />
      </Suspense>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={1.4}
        minPolarAngle={Math.PI / 2.4}
        maxPolarAngle={Math.PI / 2}
      />
    </Canvas>
  );
}

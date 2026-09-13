"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Suspense } from "react";
import { HeroVehicleModel } from "../landing/HeroVehicleModel";

/**
 * A compact, always-rotating preview of the same GLB the landing-page Hero uses (Spec-less
 * "models section" showcase request) — no reveal-sequence choreography needed here, just a
 * tighter camera/target-length framing for the /models page's small card area.
 */
export function PorscheShowcaseScene() {
  return (
    <Canvas camera={{ position: [0, 0.5, 4.2], fov: 32 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 5]} intensity={1.2} />
      <directionalLight position={[-4, 2, -5]} intensity={0.4} color="#3d6fe0" />
      <Suspense fallback={null}>
        <HeroVehicleModel targetLength={1.6} />
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

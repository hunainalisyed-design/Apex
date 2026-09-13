"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Environment, OrbitControls } from "@react-three/drei";
import { Suspense, useRef, useState } from "react";
import type { Group } from "three";
import { HeroVehicleModel } from "./HeroVehicleModel";
import type { HeroStage } from "./heroSequence";
import { isStageAtLeast } from "./heroSequence";

interface HeroRigProps {
  stage: HeroStage;
}

function HeroRig({ stage }: HeroRigProps) {
  const groupRef = useRef<Group>(null);
  // The reveal timer (useHeroSequence, fixed ~550ms/stage) is independent of the GLB's
  // actual download time — gating the scale-in target on modelLoaded too means a slow
  // network just delays the pop-in smoothly (same lerp below) instead of it appearing
  // abruptly mid-sequence whenever the download happens to finish.
  const [modelLoaded, setModelLoaded] = useState(false);
  const vehicleRevealed = isStageAtLeast(stage, "vehicle");
  const cameraMovedIn = isStageAtLeast(stage, "camera");

  useFrame((state, delta) => {
    if (groupRef.current) {
      const targetScale = vehicleRevealed && modelLoaded ? 1 : 0.001;
      const current = groupRef.current.scale.x;
      groupRef.current.scale.setScalar(current + (targetScale - current) * Math.min(1, delta * 4));
    }

    const targetZ = cameraMovedIn ? 5.5 : 8.5;
    state.camera.position.z += (targetZ - state.camera.position.z) * Math.min(1, delta * 3);
  });

  return (
    <group ref={groupRef}>
      {/* fallback={null}: nothing renders where the car will be until it's loaded, matching
          the "background" stage's own empty starting state — no placeholder geometry. */}
      <Suspense fallback={null}>
        <HeroVehicleModel onReady={() => setModelLoaded(true)} targetLength={5.2} />
      </Suspense>
    </group>
  );
}

export interface HeroSceneProps {
  stage: HeroStage;
}

export function HeroScene({ stage }: HeroSceneProps) {
  return (
    <Canvas
      camera={{ position: [0, 1.2, 8.5], fov: 35 }}
      dpr={[1, 2]}
      gl={{ antialias: true }}
    >
      <ambientLight intensity={0.35} />
      {/* Key light — a moodier, more directional "showroom spotlight" than the flat pair
          this replaced, tuned for the enlarged hero canvas (Hero.tsx). */}
      <directionalLight position={[5, 7, 4]} intensity={1.6} />
      <directionalLight position={[-5, 3, -4]} intensity={0.5} color="#3d6fe0" />
      <HeroRig stage={stage} />
      {/* Bounded-frame contact shadow rather than a live reflective floor (e.g. drei's
          MeshReflectorMaterial) — a live mirror reflection re-renders the scene from a
          second camera every frame, real sustained GPU cost stacked onto the same heavy
          GLB that already caused a genuine WebGL context-loss crash elsewhere in this app
          under sustained load (see next.config.ts's reactStrictMode comment). This reads
          as "car sitting in a showroom" without that cost; the car is grounded at y=0 by
          HeroVehicleModel's own auto-fit. frames=240 (~4s at 60fps) rather than 1 — the
          reveal sequence scales the car in from ~0 over roughly that long (useHeroSequence
          stage timing plus the lerp above), and baking a single frame too early captured
          almost no shadow at all since the car was still near-invisible; 240 lets it
          re-bake through the whole reveal and settle once the car reaches full scale,
          then stop updating. */}
      <ContactShadows position={[0, -0.001, 0]} opacity={0.55} scale={14} blur={2.4} far={3} frames={240} />
      {/* Lighting-only environment map (no visible background) for realistic paint/glass/
          chrome specular highlights — a one-time PMREM bake, not a per-frame cost. */}
      <Environment preset="city" />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={stage === "idle"}
        autoRotateSpeed={0.8}
        minPolarAngle={Math.PI / 2.6}
        maxPolarAngle={Math.PI / 2}
      />
    </Canvas>
  );
}

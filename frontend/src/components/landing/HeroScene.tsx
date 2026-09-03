"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useRef } from "react";
import type { Group } from "three";
import { PlaceholderVehicleMesh } from "./PlaceholderVehicleMesh";
import type { HeroStage } from "./heroSequence";
import { isStageAtLeast } from "./heroSequence";

interface HeroRigProps {
  stage: HeroStage;
}

function HeroRig({ stage }: HeroRigProps) {
  const groupRef = useRef<Group>(null);
  const vehicleRevealed = isStageAtLeast(stage, "vehicle");
  const cameraMovedIn = isStageAtLeast(stage, "camera");

  useFrame((state, delta) => {
    if (groupRef.current) {
      const targetScale = vehicleRevealed ? 1 : 0.001;
      const current = groupRef.current.scale.x;
      groupRef.current.scale.setScalar(current + (targetScale - current) * Math.min(1, delta * 4));
    }

    const targetZ = cameraMovedIn ? 5.5 : 8.5;
    state.camera.position.z += (targetZ - state.camera.position.z) * Math.min(1, delta * 3);
  });

  return (
    <group ref={groupRef}>
      <PlaceholderVehicleMesh />
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
      <ambientLight intensity={0.6} />
      <directionalLight position={[4, 6, 5]} intensity={1.2} />
      <directionalLight position={[-4, 2, -5]} intensity={0.4} color="#3d6fe0" />
      <HeroRig stage={stage} />
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

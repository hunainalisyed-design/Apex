"use client";

import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { getBrakeLightEmissive, getHeadlightEmissive } from "@/lib/showroom/lighting";

export interface HoveredMesh {
  meshName: string;
  x: number;
  y: number;
}

export interface PlaceholderShowroomRigProps {
  /** 0 = closed, 1 = fully open. Both doors share one amount — the nearest one is the
   * meaningful one for Interior/Cockpit, but symmetric motion reads fine for a placeholder. */
  doorOpenAmount: number;
  headlightsOn: boolean;
  brakePulsing: boolean;
  onHoverMesh: (hover: HoveredMesh | null) => void;
}

const WHEEL_POSITIONS: Array<{ name: string; position: [number, number, number] }> = [
  { name: "wheel_fl", position: [0.85, 0, 0.6] },
  { name: "wheel_fr", position: [0.85, 0, -0.6] },
  { name: "wheel_rl", position: [-0.85, 0, 0.6] },
  { name: "wheel_rr", position: [-0.85, 0, -0.6] },
];

const DOOR_HINGE_ANGLE = 1.1; // radians, ~63deg open

function Wheel({
  name,
  position,
  onHoverMesh,
}: {
  name: string;
  position: [number, number, number];
  onHoverMesh: (hover: HoveredMesh | null) => void;
}) {
  return (
    <mesh
      name={name}
      position={position}
      rotation={[Math.PI / 2, 0, 0]}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHoverMesh({ meshName: name, x: e.clientX, y: e.clientY });
      }}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHoverMesh({ meshName: name, x: e.clientX, y: e.clientY });
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onHoverMesh(null);
      }}
    >
      <cylinderGeometry args={[0.32, 0.32, 0.22, 24]} />
      <meshStandardMaterial color="#111114" metalness={0.2} roughness={0.6} name="wheel-material" />
    </mesh>
  );
}

function Door({ side, openAmount }: { side: "left" | "right"; openAmount: number }) {
  const sign = side === "left" ? 1 : -1;
  const hingeZ = 0.55 * sign;

  return (
    <group position={[0.1, 0.35, hingeZ]} rotation={[0, sign * DOOR_HINGE_ANGLE * openAmount, 0]}>
      <mesh name={`door_${side}`} position={[-0.55, 0, 0.02 * sign]}>
        <boxGeometry args={[1.1, 0.42, 0.06]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.6} roughness={0.3} />
      </mesh>
    </group>
  );
}

export function PlaceholderShowroomRig({
  doorOpenAmount,
  headlightsOn,
  brakePulsing,
  onHoverMesh,
}: PlaceholderShowroomRigProps) {
  const headlight = useMemo(() => getHeadlightEmissive(headlightsOn), [headlightsOn]);
  const brakelight = useMemo(() => getBrakeLightEmissive(brakePulsing), [brakePulsing]);

  return (
    <group position={[0, -0.3, 0]}>
      {/* body */}
      <mesh name="body" position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.4, 0.5, 1.1]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.6} roughness={0.3} />
      </mesh>

      {/* cabin */}
      <mesh position={[-0.15, 0.68, 0]} castShadow>
        <boxGeometry args={[1.2, 0.4, 0.95]} />
        <meshStandardMaterial color="#0a0a0c" metalness={0.4} roughness={0.2} />
      </mesh>

      {WHEEL_POSITIONS.map(({ name, position }) => (
        <Wheel key={name} name={name} position={position} onHoverMesh={onHoverMesh} />
      ))}

      {/* brake calipers, nested just inside each wheel */}
      {WHEEL_POSITIONS.map(({ name, position }) => (
        <mesh key={`caliper_${name}`} name={`caliper_${name}`} position={position} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.26, 16]} />
          <meshStandardMaterial color="#b3121b" metalness={0.3} roughness={0.4} />
        </mesh>
      ))}

      <Door side="left" openAmount={doorOpenAmount} />
      <Door side="right" openAmount={doorOpenAmount} />

      {/* headlights */}
      {[0.42, -0.42].map((z) => (
        <mesh key={`headlight_${z}`} name={`headlight_${z}`} position={[1.18, 0.35, z]}>
          <boxGeometry args={[0.05, 0.12, 0.28]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive={headlight.color}
            emissiveIntensity={headlight.intensity}
          />
        </mesh>
      ))}

      {/* brake lights */}
      {[0.42, -0.42].map((z) => (
        <mesh key={`brakelight_${z}`} name={`brakelight_${z}`} position={[-1.18, 0.35, z]}>
          <boxGeometry args={[0.05, 0.12, 0.28]} />
          <meshStandardMaterial
            color="#3a0a0c"
            emissive={brakelight.color}
            emissiveIntensity={brakelight.intensity}
          />
        </mesh>
      ))}
    </group>
  );
}

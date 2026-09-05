"use client";

import { useMemo, type ReactNode } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { getBrakeLightEmissive, getHeadlightEmissive } from "@/lib/showroom/lighting";
import type { AccessoryAppearance } from "@/lib/showroom/accessoryAppearance";
import type { InteriorAppearance } from "@/lib/showroom/interiorAppearance";
import type { ThreeMaterialParams } from "@/lib/showroom/interiorMaterial";

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

  // Exterior customization (Spec 6) — resolved by lib/showroom/exteriorAppearance.ts.
  paintColor: string;
  brakeCaliperColor: string;
  wheelStyle: string;
  windowTintOpacity: number;
  spoilerVisible: boolean;
  spoilerColor: string;
  frontAccessoryVisible: boolean;
  rearAccessoryVisible: boolean;
  bodyPackageVisible: boolean;
  carbonComponentVisible: boolean;

  // Interior customization (Spec 7) — resolved by lib/showroom/interiorAppearance.ts.
  // Passed as one bundle rather than ~16 flat props (5 surfaces x color/roughness/metalness
  // + lighting color) — the individual-props convention above stays reasonable at this size,
  // this one wouldn't.
  interior: InteriorAppearance;

  // Accessories/packages (Spec 8) — resolved by lib/showroom/accessoryAppearance.ts.
  accessories: AccessoryAppearance;
}

const WHEEL_POSITIONS: Array<{ name: string; position: [number, number, number] }> = [
  { name: "wheel_fl", position: [0.85, 0, 0.6] },
  { name: "wheel_fr", position: [0.85, 0, -0.6] },
  { name: "wheel_rl", position: [-0.85, 0, 0.6] },
  { name: "wheel_rr", position: [-0.85, 0, -0.6] },
];

const DOOR_HINGE_ANGLE = 1.1; // radians, ~63deg open

const WHEEL_STYLE_MATERIAL: Record<string, { color: string; metalness: number; roughness: number }> = {
  "wheel-standard": { color: "#111114", metalness: 0.2, roughness: 0.6 },
  "wheel-sport-20": { color: "#1a1a1d", metalness: 0.5, roughness: 0.35 },
  "wheel-performance": { color: "#3a3a3f", metalness: 0.7, roughness: 0.25 },
  "wheel-carbon": { color: "#15151a", metalness: 0.3, roughness: 0.15 },
};

function wheelMaterialFor(style: string) {
  return WHEEL_STYLE_MATERIAL[style] ?? WHEEL_STYLE_MATERIAL["wheel-standard"];
}

interface HoverablePartProps {
  name: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  visible?: boolean;
  onHoverMesh: (hover: HoveredMesh | null) => void;
  children: ReactNode;
}

/** A named, hover-reactive mesh — the shared wiring every hotspot-eligible part (Spec 5's
 * registry) needs, factored out so wheels/body/calipers don't each repeat it. */
function HoverablePart({ name, position, rotation, visible, onHoverMesh, children }: HoverablePartProps) {
  return (
    <mesh
      name={name}
      position={position}
      rotation={rotation}
      visible={visible}
      castShadow
      receiveShadow
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
      {children}
    </mesh>
  );
}

function SurfaceMaterial({ material }: { material: ThreeMaterialParams }) {
  return (
    <meshStandardMaterial color={material.color} roughness={material.roughness} metalness={material.metalness} />
  );
}

function Door({
  side,
  openAmount,
  doorPanelMaterial,
}: {
  side: "left" | "right";
  openAmount: number;
  doorPanelMaterial: ThreeMaterialParams;
}) {
  const sign = side === "left" ? 1 : -1;
  const hingeZ = 0.55 * sign;

  return (
    <group position={[0.1, 0.35, hingeZ]} rotation={[0, sign * DOOR_HINGE_ANGLE * openAmount, 0]}>
      <mesh name={`door_${side}`} position={[-0.55, 0, 0.02 * sign]}>
        <boxGeometry args={[1.1, 0.42, 0.06]} />
        <meshStandardMaterial color="#d4d4d8" metalness={0.6} roughness={0.3} />
      </mesh>
      {/* interior door-panel trim (Spec 7) — the cabin-facing side, moves with the door */}
      <mesh name={`door_panel_trim_${side}`} position={[-0.5, 0, -0.015 * sign]}>
        <boxGeometry args={[0.9, 0.28, 0.02]} />
        <SurfaceMaterial material={doorPanelMaterial} />
      </mesh>
    </group>
  );
}

export function PlaceholderShowroomRig({
  doorOpenAmount,
  headlightsOn,
  brakePulsing,
  onHoverMesh,
  paintColor,
  brakeCaliperColor,
  wheelStyle,
  windowTintOpacity,
  spoilerVisible,
  spoilerColor,
  frontAccessoryVisible,
  rearAccessoryVisible,
  bodyPackageVisible,
  carbonComponentVisible,
  interior,
  accessories,
}: PlaceholderShowroomRigProps) {
  const headlight = useMemo(() => getHeadlightEmissive(headlightsOn), [headlightsOn]);
  const brakelight = useMemo(() => getBrakeLightEmissive(brakePulsing), [brakePulsing]);
  const wheelMaterial = useMemo(() => wheelMaterialFor(wheelStyle), [wheelStyle]);

  return (
    <group position={[0, -0.3, 0]}>
      <HoverablePart name="body" position={[0, 0.3, 0]} onHoverMesh={onHoverMesh}>
        <boxGeometry args={[2.4, 0.5, 1.1]} />
        <meshStandardMaterial color={paintColor} metalness={0.6} roughness={0.3} />
      </HoverablePart>

      {/* lower cabin structure, below the beltline (opaque — matches a real car's
          door/rocker panels; the glass greenhouse above it is where the interior shows) */}
      <mesh position={[-0.15, 0.56, 0]} castShadow>
        <boxGeometry args={[1.2, 0.16, 0.95]} />
        <meshStandardMaterial color="#0a0a0c" metalness={0.4} roughness={0.2} />
      </mesh>

      {/* glass greenhouse, above the beltline — window tint (Spec 6, AC-6) */}
      <mesh position={[-0.15, 0.78, 0]}>
        <boxGeometry args={[1.24, 0.28, 0.99]} />
        <meshPhysicalMaterial
          color="#1a2530"
          transparent
          opacity={windowTintOpacity}
          roughness={0.05}
          metalness={0}
        />
      </mesh>

      {/* interior surfaces (Spec 7) — positioned so their upper portions read through the
          glass above; grade+color are pre-combined into each material by
          lib/showroom/interiorAppearance.ts */}
      <mesh name="floor" position={[-0.15, 0.485, 0]}>
        <boxGeometry args={[1.1, 0.03, 0.85]} />
        <SurfaceMaterial material={interior.floor} />
      </mesh>

      <mesh name="dashboard" position={[0.32, 0.7, 0]}>
        <boxGeometry args={[0.12, 0.22, 0.85]} />
        <SurfaceMaterial material={interior.dashboard} />
      </mesh>

      <mesh
        name="steering_wheel"
        position={[0.22, 0.75, 0.15]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <torusGeometry args={[0.12, 0.02, 12, 24]} />
        <SurfaceMaterial material={interior.steeringWheel} />
      </mesh>

      <group name="seat">
        <mesh position={[-0.4, 0.56, 0]}>
          <boxGeometry args={[0.35, 0.14, 0.75]} />
          <SurfaceMaterial material={interior.seat} />
        </mesh>
        <mesh position={[-0.56, 0.72, 0]} rotation={[0.15, 0, 0]}>
          <boxGeometry args={[0.32, 0.36, 0.7]} />
          <SurfaceMaterial material={interior.seat} />
        </mesh>
      </group>

      {/* interior lighting (Spec 7, AC-4) — real ambient light + emissive trim strip */}
      <pointLight position={[-0.15, 0.84, 0]} color={interior.lightingColor} intensity={0.5} distance={1.4} />
      <mesh position={[-0.15, 0.86, 0]}>
        <boxGeometry args={[0.9, 0.02, 0.05]} />
        <meshStandardMaterial color="#111111" emissive={interior.lightingColor} emissiveIntensity={1.5} />
      </mesh>

      {WHEEL_POSITIONS.map(({ name, position }) => (
        <HoverablePart key={name} name={name} position={position} rotation={[Math.PI / 2, 0, 0]} onHoverMesh={onHoverMesh}>
          <cylinderGeometry args={[0.32, 0.32, 0.22, 24]} />
          <meshStandardMaterial
            color={wheelMaterial.color}
            metalness={wheelMaterial.metalness}
            roughness={wheelMaterial.roughness}
          />
        </HoverablePart>
      ))}

      {/* brake calipers, nested just inside each wheel */}
      {WHEEL_POSITIONS.map(({ name, position }) => (
        <HoverablePart
          key={`caliper_${name}`}
          name={`caliper_${name}`}
          position={position}
          rotation={[Math.PI / 2, 0, 0]}
          onHoverMesh={onHoverMesh}
        >
          <cylinderGeometry args={[0.2, 0.2, 0.26, 16]} />
          <meshStandardMaterial color={brakeCaliperColor} metalness={0.3} roughness={0.4} />
        </HoverablePart>
      ))}

      <Door side="left" openAmount={doorOpenAmount} doorPanelMaterial={interior.doorPanel} />
      <Door side="right" openAmount={doorOpenAmount} doorPanelMaterial={interior.doorPanel} />

      {/* spoiler — struts + wing (Spec 6, AC-7) */}
      <group visible={spoilerVisible}>
        {[0.35, -0.35].map((z) => (
          <mesh key={`spoiler-strut-${z}`} position={[-1.15, 0.62, z]}>
            <boxGeometry args={[0.05, 0.22, 0.05]} />
            <meshStandardMaterial color={spoilerColor} metalness={0.4} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[-1.2, 0.74, 0]}>
          <boxGeometry args={[0.28, 0.05, 1.0]} />
          <meshStandardMaterial color={spoilerColor} metalness={0.4} roughness={0.3} />
        </mesh>
      </group>

      {/* front accessory — splitter (Spec 6, AC-8) */}
      <mesh visible={frontAccessoryVisible} position={[1.25, 0.07, 0]}>
        <boxGeometry args={[0.12, 0.06, 1.15]} />
        <meshStandardMaterial color="#0a0a0c" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* rear accessory — diffuser (Spec 6, AC-8) */}
      <mesh visible={rearAccessoryVisible} position={[-1.25, 0.07, 0]}>
        <boxGeometry args={[0.12, 0.06, 1.15]} />
        <meshStandardMaterial color="#0a0a0c" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* body package — side skirts (Spec 6, AC-8) */}
      <group visible={bodyPackageVisible}>
        {[0.58, -0.58].map((z) => (
          <mesh key={`skirt-${z}`} position={[0, 0.12, z]}>
            <boxGeometry args={[2.0, 0.08, 0.08]} />
            <meshStandardMaterial color={paintColor} metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* carbon component — roof trim accent (Spec 6, AC-8) */}
      <mesh visible={carbonComponentVisible} position={[-0.15, 0.9, 0]}>
        <boxGeometry args={[1.15, 0.02, 0.9]} />
        <meshStandardMaterial color="#0d0d10" metalness={0.2} roughness={0.15} />
      </mesh>

      {/* roof panel — always present, caps the glass greenhouse; paint-colored by default,
          carbon-finished when the ACCESSORY "Carbon Roof" is active (Spec 8, AC-3) —
          intentionally a separate mesh from the CARBON_COMPONENT trim accent above, per
          Spec 2 Risk #4's "intentionally independent" resolution */}
      <mesh name="roof" position={[-0.15, 0.93, 0]}>
        <boxGeometry args={[1.22, 0.02, 0.97]} />
        <meshStandardMaterial color={accessories.roofColor} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* mirror caps — always present, same paint-color-by-default/carbon-when-active
          pattern as the roof (Spec 8, AC-3) */}
      {[0.56, -0.56].map((z) => (
        <mesh key={`mirror-${z}`} name={`mirror_${z > 0 ? "left" : "right"}`} position={[0.25, 0.62, z]}>
          <boxGeometry args={[0.04, 0.05, 0.12]} />
          <meshStandardMaterial color={accessories.mirrorCapsColor} metalness={0.5} roughness={0.3} />
        </mesh>
      ))}

      {/* exhaust tips — hidden until Sport Exhaust is active (Spec 8, AC-2) */}
      {[0.15, -0.15].map((z) => (
        <mesh
          key={`exhaust-${z}`}
          name={`exhaust_tip_${z > 0 ? "left" : "right"}`}
          visible={accessories.exhaustTipVisible}
          position={[-1.22, 0.1, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.045, 0.045, 0.12, 16]} />
          <meshStandardMaterial color="#8a8d91" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}

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

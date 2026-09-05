"use client";

import { useMemo, type ReactNode } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { getBrakeLightEmissive, getHeadlightEmissive } from "@/lib/showroom/lighting";
import type { AccessoryAppearance } from "@/lib/showroom/accessoryAppearance";
import type { InteriorAppearance } from "@/lib/showroom/interiorAppearance";
import type { ThreeMaterialParams } from "@/lib/showroom/interiorMaterial";
import { useCarModelGeometry, type CarModelNodeName } from "./CarModel";

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

  // Real body/wheel/spoiler geometry (Kenney "Car Kit" CC0 asset, see
  // frontend/public/models/shared/CREDITS.md) — a per-vehicle GLB URL.
  modelUrl: string;
}

const DOOR_HINGE_ANGLE = 1.1; // radians, ~63deg open

// The Kenney sedan-sports.glb's length axis is the file's own Z, but this rig's camera
// presets/hotspots/door-left-right conventions all assume length runs along X — this
// rotation reconciles the two. Verified against the Front/Left/Right camera presets;
// flip the sign if a preset shows the wrong end/side of the car.
const MODEL_ROTATION: [number, number, number] = [0, Math.PI / 2, 0];

// Raw node translations read directly from the source glTF (frontend/public/models/shared/
// sedan-sports.glb) — left in the asset's own (unrotated) local space since they live
// inside the MODEL_ROTATION group below, which reorients the whole subtree consistently.
const BODY_LOCAL_POSITION: [number, number, number] = [0, 0.15, -0.025];
// spoiler is a child of body in the source file, so its position here is body's own
// translation plus spoiler's local translation, composed in the source's local space.
const SPOILER_LOCAL_POSITION: [number, number, number] = [0, 0.6, -1.0687];

const REAL_WHEELS: Array<{ name: string; node: CarModelNodeName; position: [number, number, number] }> = [
  { name: "wheel_fl", node: "wheel-front-left", position: [0.3, 0.3, 0.66] },
  { name: "wheel_fr", node: "wheel-front-right", position: [-0.3, 0.3, 0.66] },
  { name: "wheel_rl", node: "wheel-back-left", position: [0.3, 0.3, -0.66] },
  { name: "wheel_rr", node: "wheel-back-right", position: [-0.3, 0.3, -0.66] },
];

// Same 4 wheels' positions, pre-rotated by MODEL_ROTATION into the rig's outer (unrotated)
// coordinate frame — used by the procedural brake calipers, which sit outside the
// MODEL_ROTATION group (they're not part of the real asset).
const CALIPER_POSITIONS: Array<{ name: string; position: [number, number, number] }> = [
  { name: "wheel_fl", position: [0.66, 0.3, -0.3] },
  { name: "wheel_fr", position: [0.66, 0.3, 0.3] },
  { name: "wheel_rl", position: [-0.66, 0.3, -0.3] },
  { name: "wheel_rr", position: [-0.66, 0.3, 0.3] },
];

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
  const hingeZ = 0.58 * sign;

  return (
    <group position={[0.55, 0.55, hingeZ]} rotation={[0, sign * DOOR_HINGE_ANGLE * openAmount, 0]}>
      <mesh name={`door_${side}`} position={[-0.55, 0, 0]}>
        <boxGeometry args={[1.0, 0.42, 0.04]} />
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
  modelUrl,
}: PlaceholderShowroomRigProps) {
  const headlight = useMemo(() => getHeadlightEmissive(headlightsOn), [headlightsOn]);
  const brakelight = useMemo(() => getBrakeLightEmissive(brakePulsing), [brakePulsing]);
  const wheelMaterial = useMemo(() => wheelMaterialFor(wheelStyle), [wheelStyle]);

  const bodyGeometry = useCarModelGeometry(modelUrl, "body");
  const spoilerGeometry = useCarModelGeometry(modelUrl, "spoiler");
  const wheelGeometryByNode: Record<CarModelNodeName, ReturnType<typeof useCarModelGeometry>> = {
    body: bodyGeometry,
    spoiler: spoilerGeometry,
    "wheel-front-left": useCarModelGeometry(modelUrl, "wheel-front-left"),
    "wheel-front-right": useCarModelGeometry(modelUrl, "wheel-front-right"),
    "wheel-back-left": useCarModelGeometry(modelUrl, "wheel-back-left"),
    "wheel-back-right": useCarModelGeometry(modelUrl, "wheel-back-right"),
  };

  return (
    <group position={[0, -0.3, 0]}>
      {/* Real body/wheel/spoiler geometry (Kenney "Car Kit," CC0 — see
          frontend/public/models/shared/CREDITS.md). Rotated once as a group since the
          source asset's length axis doesn't match this rig's X-forward convention. */}
      <group rotation={MODEL_ROTATION}>
        <HoverablePart name="body" position={BODY_LOCAL_POSITION} onHoverMesh={onHoverMesh}>
          <primitive object={bodyGeometry} attach="geometry" />
          <meshStandardMaterial color={paintColor} metalness={0.6} roughness={0.3} />
        </HoverablePart>

        {REAL_WHEELS.map(({ name, node, position }) => (
          <HoverablePart key={name} name={name} position={position} onHoverMesh={onHoverMesh}>
            <primitive object={wheelGeometryByNode[node]} attach="geometry" />
            <meshStandardMaterial
              color={wheelMaterial.color}
              metalness={wheelMaterial.metalness}
              roughness={wheelMaterial.roughness}
            />
          </HoverablePart>
        ))}

        <group visible={spoilerVisible}>
          <mesh position={SPOILER_LOCAL_POSITION} castShadow>
            <primitive object={spoilerGeometry} attach="geometry" />
            <meshStandardMaterial color={spoilerColor} metalness={0.4} roughness={0.3} />
          </mesh>
        </group>
      </group>

      {/* glass greenhouse, sitting in the upper portion of the real body — window tint
          (Spec 6, AC-6). Repositioned from its old placeholder-body-relative offsets;
          exact fit is tuned visually, not computed from the asset's bounding box alone. */}
      <mesh position={[-0.05, 0.85, 0]}>
        <boxGeometry args={[1.05, 0.22, 0.6]} />
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
      <mesh name="floor" position={[-0.05, 0.25, 0]}>
        <boxGeometry args={[1.05, 0.03, 0.5]} />
        <SurfaceMaterial material={interior.floor} />
      </mesh>

      <mesh name="dashboard" position={[0.45, 0.85, 0]}>
        <boxGeometry args={[0.12, 0.22, 0.5]} />
        <SurfaceMaterial material={interior.dashboard} />
      </mesh>

      <mesh
        name="steering_wheel"
        position={[0.35, 0.9, 0.15]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <torusGeometry args={[0.12, 0.02, 12, 24]} />
        <SurfaceMaterial material={interior.steeringWheel} />
      </mesh>

      <group name="seat">
        <mesh position={[-0.3, 0.75, 0]}>
          <boxGeometry args={[0.35, 0.14, 0.4]} />
          <SurfaceMaterial material={interior.seat} />
        </mesh>
        <mesh position={[-0.46, 0.92, 0]} rotation={[0.15, 0, 0]}>
          <boxGeometry args={[0.32, 0.36, 0.38]} />
          <SurfaceMaterial material={interior.seat} />
        </mesh>
      </group>

      {/* interior lighting (Spec 7, AC-4) — real ambient light + emissive trim strip */}
      <pointLight position={[-0.05, 1.0, 0]} color={interior.lightingColor} intensity={0.5} distance={1.4} />
      <mesh position={[-0.05, 1.02, 0]}>
        <boxGeometry args={[0.9, 0.02, 0.05]} />
        <meshStandardMaterial color="#111111" emissive={interior.lightingColor} emissiveIntensity={1.5} />
      </mesh>

      {/* brake calipers, nested just inside each real wheel */}
      {CALIPER_POSITIONS.map(({ name, position }) => (
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

      {/* front accessory — splitter (Spec 6, AC-8) */}
      <mesh visible={frontAccessoryVisible} position={[1.28, 0.16, 0]}>
        <boxGeometry args={[0.12, 0.06, 1.15]} />
        <meshStandardMaterial color="#0a0a0c" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* rear accessory — diffuser (Spec 6, AC-8) */}
      <mesh visible={rearAccessoryVisible} position={[-1.28, 0.16, 0]}>
        <boxGeometry args={[0.12, 0.06, 1.15]} />
        <meshStandardMaterial color="#0a0a0c" metalness={0.3} roughness={0.5} />
      </mesh>

      {/* body package — side skirts (Spec 6, AC-8) */}
      <group visible={bodyPackageVisible}>
        {[0.65, -0.65].map((z) => (
          <mesh key={`skirt-${z}`} position={[0, 0.2, z]}>
            <boxGeometry args={[2.1, 0.08, 0.08]} />
            <meshStandardMaterial color={paintColor} metalness={0.6} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* carbon component — roof trim accent (Spec 6, AC-8) */}
      <mesh visible={carbonComponentVisible} position={[-0.05, 1.05, 0]}>
        <boxGeometry args={[1.15, 0.02, 0.55]} />
        <meshStandardMaterial color="#0d0d10" metalness={0.2} roughness={0.15} />
      </mesh>

      {/* roof panel — always present, caps the glass greenhouse; paint-colored by default,
          carbon-finished when the ACCESSORY "Carbon Roof" is active (Spec 8, AC-3) —
          intentionally a separate mesh from the CARBON_COMPONENT trim accent above, per
          Spec 2 Risk #4's "intentionally independent" resolution */}
      <mesh name="roof" position={[-0.05, 1.08, 0]}>
        <boxGeometry args={[1.22, 0.02, 0.6]} />
        <meshStandardMaterial color={accessories.roofColor} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* mirror caps — always present, same paint-color-by-default/carbon-when-active
          pattern as the roof (Spec 8, AC-3) */}
      {[0.66, -0.66].map((z) => (
        <mesh key={`mirror-${z}`} name={`mirror_${z > 0 ? "left" : "right"}`} position={[0.35, 0.78, z]}>
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
          position={[-1.3, 0.18, z]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.045, 0.045, 0.12, 16]} />
          <meshStandardMaterial color="#8a8d91" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}

      {/* headlights */}
      {[0.42, -0.42].map((z) => (
        <mesh key={`headlight_${z}`} name={`headlight_${z}`} position={[1.25, 0.45, z]}>
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
        <mesh key={`brakelight_${z}`} name={`brakelight_${z}`} position={[-1.25, 0.45, z]}>
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

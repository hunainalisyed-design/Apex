export type CameraPresetId =
  | "default"
  | "front"
  | "rear"
  | "left"
  | "right"
  | "side"
  | "top"
  | "interior"
  | "cockpit";

export interface Vec3Tuple {
  x: number;
  y: number;
  z: number;
}

export interface CameraPreset {
  id: CameraPresetId;
  label: string;
  position: Vec3Tuple;
  target: Vec3Tuple;
  /** Interior/cockpit presets open the nearest door as part of the transition (AC-6). */
  isInterior: boolean;
}

const ORIGIN: Vec3Tuple = { x: 0, y: 0.6, z: 0 };

export const CAMERA_PRESETS: readonly CameraPreset[] = [
  { id: "default", label: "Reset", position: { x: 4.5, y: 2, z: 5.5 }, target: ORIGIN, isInterior: false },
  { id: "front", label: "Front", position: { x: 0, y: 1.1, z: 5.5 }, target: ORIGIN, isInterior: false },
  { id: "rear", label: "Rear", position: { x: 0, y: 1.1, z: -5.5 }, target: ORIGIN, isInterior: false },
  { id: "left", label: "Left", position: { x: -5.5, y: 1.1, z: 0 }, target: ORIGIN, isInterior: false },
  { id: "right", label: "Right", position: { x: 5.5, y: 1.1, z: 0 }, target: ORIGIN, isInterior: false },
  { id: "side", label: "Side", position: { x: -4.5, y: 1.6, z: 3.2 }, target: ORIGIN, isInterior: false },
  { id: "top", label: "Top", position: { x: 0, y: 7.5, z: 0.01 }, target: ORIGIN, isInterior: false },
  // The placeholder rig's body/cabin are solid meshes (no hollow interior to place a
  // camera inside), so these frame a close three-quarter shot on the open door instead
  // of clipping into geometry — a real GLB's actual cabin replaces this framing later.
  {
    id: "interior",
    label: "Interior",
    position: { x: 1.7, y: 1.4, z: 1.7 },
    target: { x: 0.3, y: 0.7, z: 0.3 },
    isInterior: true,
  },
  {
    id: "cockpit",
    label: "Cockpit",
    position: { x: 1.1, y: 1.15, z: 1.1 },
    target: { x: 0.5, y: 0.75, z: 0.25 },
    isInterior: true,
  },
] as const;

export function getCameraPreset(id: CameraPresetId): CameraPreset {
  const preset = CAMERA_PRESETS.find((p) => p.id === id);
  if (!preset) {
    throw new Error(`Unknown camera preset "${id}"`);
  }
  return preset;
}

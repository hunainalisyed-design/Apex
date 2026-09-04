import type { OptionCategory } from "@/types/catalog";
import type { CameraPresetId } from "./cameraPresets";

export interface Hotspot {
  meshName: string; // must match a node name inside the GLB (or, for now, the placeholder rig)
  category: OptionCategory; // links to the currently-selected option's name for the label
  cameraFocus?: CameraPresetId; // optional: clicking (not just hovering) can jump the camera here
}

/**
 * The hotspot registry — the mechanism every customization spec (6/7/8) registers into,
 * without touching Spec 5's code. Spec 5 proved the mechanism with the four wheel meshes;
 * Spec 5's own doc explicitly delegated PAINT (the body mesh) and BRAKE_CALIPER (the four
 * caliper meshes) to this spec, which registers them here.
 */
export const HOTSPOTS: Hotspot[] = [
  { meshName: "wheel_fl", category: "WHEELS" },
  { meshName: "wheel_fr", category: "WHEELS" },
  { meshName: "wheel_rl", category: "WHEELS" },
  { meshName: "wheel_rr", category: "WHEELS" },
  { meshName: "body", category: "PAINT" },
  { meshName: "caliper_wheel_fl", category: "BRAKE_CALIPER" },
  { meshName: "caliper_wheel_fr", category: "BRAKE_CALIPER" },
  { meshName: "caliper_wheel_rl", category: "BRAKE_CALIPER" },
  { meshName: "caliper_wheel_rr", category: "BRAKE_CALIPER" },
];

export function findHotspot(meshName: string): Hotspot | undefined {
  return HOTSPOTS.find((h) => h.meshName === meshName);
}

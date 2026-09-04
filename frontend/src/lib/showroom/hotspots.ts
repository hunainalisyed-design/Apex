import type { OptionCategory } from "@/types/catalog";
import type { CameraPresetId } from "./cameraPresets";

export interface Hotspot {
  meshName: string; // must match a node name inside the GLB (or, for now, the placeholder rig)
  category: OptionCategory; // links to the currently-selected option's name for the label
  cameraFocus?: CameraPresetId; // optional: clicking (not just hovering) can jump the camera here
}

/**
 * The hotspot registry — the mechanism every customization spec (6/7/8) registers into,
 * without touching this spec's code. Proven here with the placeholder rig's four named
 * wheel meshes, all mapped to WHEELS (one category, four real interactive parts).
 */
export const HOTSPOTS: Hotspot[] = [
  { meshName: "wheel_fl", category: "WHEELS" },
  { meshName: "wheel_fr", category: "WHEELS" },
  { meshName: "wheel_rl", category: "WHEELS" },
  { meshName: "wheel_rr", category: "WHEELS" },
];

export function findHotspot(meshName: string): Hotspot | undefined {
  return HOTSPOTS.find((h) => h.meshName === meshName);
}

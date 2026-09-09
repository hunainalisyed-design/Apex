import type { CameraState } from "@/lib/showroom/cameraPresets";

export type ShowcaseStageId = "established" | "exterior" | "wheels" | "interior" | "returned" | "summary";

export interface ShowcaseStage {
  id: ShowcaseStageId;
  caption: string;
  /** Camera position/target for this beat. "summary" deliberately reuses "returned"'s
   * camera — SRS §23's sixth beat is a configuration-summary UI overlay, not a new camera
   * move (Spec 13, AC-8). */
  camera: CameraState;
}

// A pulled-back, hero-scale establishing shot — not the showroom's own "default" preset
// (cameraPresets.ts), which is tuned for the interactive configurator's canvas, not a
// full-bleed landing-page section.
const ESTABLISHED_CAMERA: CameraState = { position: { x: 5.5, y: 2.3, z: 7.5 }, target: { x: 0, y: 0.6, z: 0 } };

// Adapted from cameraPresets.ts's "side" preset — already a good three-quarter exterior
// framing, reused here rather than inventing a new position.
const EXTERIOR_CAMERA: CameraState = { position: { x: -4.5, y: 1.6, z: 3.2 }, target: { x: 0, y: 0.6, z: 0 } };

// Bespoke — no showroom preset frames a wheel. Positioned near PlaceholderVehicleMesh's own
// front-right wheel coordinates ({x:0.85, z:0.6} local, offset by the mesh group's own
// [0,-0.3,0] position) rather than an arbitrary guess.
const WHEELS_CAMERA: CameraState = { position: { x: 1.7, y: 0.15, z: 1.35 }, target: { x: 0.85, y: -0.15, z: 0.6 } };

// Reused verbatim from cameraPresets.ts's "interior" preset — already tuned to frame the
// placeholder cabin through the greenhouse.
const INTERIOR_CAMERA: CameraState = { position: { x: 1.6, y: 1.1, z: 1.5 }, target: { x: 0.25, y: 0.42, z: 0.05 } };

/**
 * The six SRS §23 narrative beats (Spec 13, AC-8), as pure data — mirrors
 * heroSequence.ts's React-free style. `vehicleName` only affects the first caption; the
 * camera positions themselves are vehicle-agnostic (the placeholder rig's geometry is
 * identical across vehicles today).
 */
export function buildShowcaseStages(vehicleName: string): ShowcaseStage[] {
  return [
    { id: "established", caption: `Presenting the ${vehicleName}.`, camera: ESTABLISHED_CAMERA },
    { id: "exterior", caption: "Every line, sculpted for performance.", camera: EXTERIOR_CAMERA },
    { id: "wheels", caption: "Precision-engineered wheels and brakes.", camera: WHEELS_CAMERA },
    { id: "interior", caption: "A driver-focused cockpit, built for you.", camera: INTERIOR_CAMERA },
    { id: "returned", caption: "The full picture, once more.", camera: ESTABLISHED_CAMERA },
    { id: "summary", caption: "Make it yours.", camera: ESTABLISHED_CAMERA },
  ];
}

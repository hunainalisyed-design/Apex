/** Zoom/dolly distance bounds (AC-4) — passed straight to OrbitControls' native
 * minDistance/maxDistance rather than hand-rolled clamping math. */
export const SHOWROOM_CAMERA_BOUNDS = {
  minDistance: 3,
  maxDistance: 12,
} as const;

export function clampDistance(distance: number): number {
  return Math.min(
    SHOWROOM_CAMERA_BOUNDS.maxDistance,
    Math.max(SHOWROOM_CAMERA_BOUNDS.minDistance, distance),
  );
}

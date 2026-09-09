import type { CameraState, Vec3Tuple } from "./cameraPresets";

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpVec3(a: Vec3Tuple, b: Vec3Tuple, t: number): Vec3Tuple {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

/**
 * Linearly interpolates between two camera states at progress `t` (clamped to [0,1]).
 * Deliberately a plain pure function, not a GSAP tween like useCameraTransition.ts's
 * runTween — scroll-driven camera movement (Spec 13, AC-8/AC-9) needs an instant,
 * backward-seekable function of external scroll progress, not a fixed-duration clock the
 * showroom's click-driven presets use. The interactive showroom's camera is untouched by
 * this function.
 */
export function lerpCameraState(a: CameraState, b: CameraState, t: number): CameraState {
  const clamped = Math.min(1, Math.max(0, t));
  return {
    position: lerpVec3(a.position, b.position, clamped),
    target: lerpVec3(a.target, b.target, clamped),
  };
}

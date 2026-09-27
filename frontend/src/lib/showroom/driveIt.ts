/**
 * "Drive It" (Spec 37): the fixed path, the pace, and the deliberately tiny steering model —
 * pure math, no three.js, so the bounds that keep this a delight moment (not a driving game)
 * are unit-testable. World units: the showroom frames a ~4.2-unit car; Y is up.
 */

/** The Spec 28 environment the drive happens in (AC-1: it reads best in motion). */
export const DRIVE_ENVIRONMENT_ID = "coastal-road";

/** One run of the path (AC-4: a bounded moment). */
export const DRIVE_DURATION_MS = 40_000;
/** Speeding up at the start and slowing at the end, as a share of the run. */
export const RAMP_FRACTION = 0.1;

/**
 * The figure-eight's half-width and half-depth. Kept small on purpose: an environment's
 * 360° photo only looks sharp near the middle of its projected ground — further out it smears
 * into streaks — so the route stays in that sharp area and is driven twice instead.
 */
export const PATH_HALF_WIDTH = 8;
export const PATH_HALF_DEPTH = 5;
/** Laps of the figure-eight in one drive. */
export const PATH_LAPS = 2;

/** AC-2's "narrow band": the most the car can drift sideways off the path, in units. */
export const MAX_LATERAL_OFFSET = 1;
/** How fast steering moves the car sideways (units/second), and how fast it recentres. */
export const STEER_SPEED = 1.6;
export const RETURN_RATE = 2.5;
/** The visible feel: a little body lean and a little extra yaw, both capped. */
export const MAX_LEAN_RAD = (4 * Math.PI) / 180;
export const MAX_YAW_RAD = (8 * Math.PI) / 180;
const LEAN_PER_SPEED = MAX_LEAN_RAD / STEER_SPEED;
const YAW_PER_SPEED = MAX_YAW_RAD / STEER_SPEED;

/** Chase camera: this far behind and above the car, looking a little ahead of it. */
export const CHASE_DISTANCE = 5.5;
export const CHASE_HEIGHT = 2;
export const LOOK_AHEAD = 3;

export type Vec3 = [number, number, number];

function clamp(value: number, limit: number): number {
  return Math.max(-limit, Math.min(limit, value));
}

/**
 * How far along the path the car is, 0→1, for a time 0→1: a trapezoidal speed profile —
 * gentle start, steady cruise, gentle stop — so there's never a jolt.
 */
export function pathProgress(timeFraction: number): number {
  const t = Math.min(1, Math.max(0, timeFraction));
  const r = RAMP_FRACTION;
  const norm = 1 - r; // total distance under the speed curve, so the path ends exactly at 1
  if (t < r) return (t * t) / (2 * r * norm);
  if (t > 1 - r) return 1 - ((1 - t) * (1 - t)) / (2 * r * norm);
  return (t - r / 2) / norm;
}

export interface PathPoint {
  x: number;
  z: number;
  /** Direction of travel, as the yaw from +z toward +x (the direction is (sin, cos) in x/z). */
  heading: number;
}

/**
 * The fixed route (AC-1): laps of a figure-eight (a lemniscate of Gerono) that start and end
 * at the showroom's spot, so the car sets off from — and comes home to — where it stands.
 */
export function pathPoint(progress: number): PathPoint {
  const a = 2 * Math.PI * PATH_LAPS * progress;
  const x = PATH_HALF_WIDTH * Math.sin(a);
  const z = (PATH_HALF_DEPTH / 2) * Math.sin(2 * a);
  const dx = PATH_HALF_WIDTH * Math.cos(a);
  const dz = PATH_HALF_DEPTH * Math.cos(2 * a);
  return { x, z, heading: Math.atan2(dx, dz) };
}

export interface SteerState {
  /** Sideways distance from the path, + = to the car's right. */
  offset: number;
  /** Sideways speed; drives the visible lean and yaw. */
  velocity: number;
}

export const CENTERED: SteerState = { offset: 0, velocity: 0 };

/**
 * One step of the steering feel (AC-2). `input` is -1 (left) … 1 (right); with no input the car
 * drifts back onto the path. The offset never leaves ±MAX_LATERAL_OFFSET — at the edge the car
 * simply stops drifting further; there's no collision or physics of any kind.
 */
export function stepSteer(state: SteerState, input: number, dtSeconds: number): SteerState {
  const dt = Math.min(Math.max(dtSeconds, 0), 0.1); // a long frame (tab switch) can't fling the car
  const steer = clamp(input, 1);
  let velocity = steer !== 0 ? steer * STEER_SPEED : -state.offset * RETURN_RATE;
  const next = state.offset + velocity * dt;
  const offset = clamp(next, MAX_LATERAL_OFFSET);
  if (offset !== next) velocity = 0; // pinned at the edge of the band
  return { offset, velocity: clamp(velocity, STEER_SPEED) };
}

/** The visible response to steering: body lean (roll) and a touch of extra yaw, both capped. */
export function steerFeel(state: SteerState): { lean: number; yaw: number } {
  return {
    lean: clamp(-state.velocity * LEAN_PER_SPEED, MAX_LEAN_RAD),
    yaw: clamp(-state.velocity * YAW_PER_SPEED, MAX_YAW_RAD),
  };
}

export interface DrivePose {
  position: Vec3;
  /** Direction the car points (path heading plus the steering yaw). */
  heading: number;
  lean: number;
  camera: { position: Vec3; target: Vec3 };
}

/** Where the car and the chase camera are, for a path point and a steering state. */
export function drivePose(point: PathPoint, steer: SteerState): DrivePose {
  const { lean, yaw } = steerFeel(steer);
  const fx = Math.sin(point.heading);
  const fz = Math.cos(point.heading);
  // Right of travel direction (x/z plane, Y up).
  const rx = -fz;
  const rz = fx;
  const x = point.x + rx * steer.offset;
  const z = point.z + rz * steer.offset;
  return {
    position: [x, 0, z],
    heading: point.heading + yaw,
    lean,
    camera: {
      position: [x - fx * CHASE_DISTANCE, CHASE_HEIGHT, z - fz * CHASE_DISTANCE],
      target: [x + fx * LOOK_AHEAD, 0.6, z + fz * LOOK_AHEAD],
    },
  };
}

/**
 * Which way a model's front points in its own file: the yaw of its forward axis from +z. The
 * placeholder rig is built facing +x; each real model's was checked from its node positions
 * (headlights vs. tail lights) — see realGlbVehicles.ts.
 */
export type ForwardAxis = "+x" | "-x" | "+z" | "-z";

export function forwardYaw(axis: ForwardAxis): number {
  switch (axis) {
    case "+z":
      return 0;
    case "+x":
      return Math.PI / 2;
    case "-z":
      return Math.PI;
    case "-x":
      return -Math.PI / 2;
  }
}

import { Quaternion, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import {
  CENTERED,
  CHASE_DISTANCE,
  drivePose,
  forwardYaw,
  MAX_LATERAL_OFFSET,
  MAX_LEAN_RAD,
  MAX_YAW_RAD,
  PATH_HALF_DEPTH,
  PATH_HALF_WIDTH,
  pathPoint,
  pathProgress,
  stepSteer,
  steerFeel,
  type ForwardAxis,
  type SteerState,
} from "../../src/lib/showroom/driveIt";
import { getRealGlbVehicleConfig } from "../../src/lib/showroom/realGlbVehicles";

const GROUND_RADIUS = 60; // Spec 28's projected ground

describe("pathProgress — gentle start, cruise, gentle stop", () => {
  it("runs from 0 to 1 and is clamped outside the run", () => {
    expect(pathProgress(0)).toBe(0);
    expect(pathProgress(1)).toBeCloseTo(1, 12);
    expect(pathProgress(-1)).toBe(0);
    expect(pathProgress(2)).toBeCloseTo(1, 12);
  });

  it("only ever moves forward, with no jumps", () => {
    let previous = 0;
    for (let i = 1; i <= 1000; i++) {
      const p = pathProgress(i / 1000);
      expect(p).toBeGreaterThanOrEqual(previous);
      expect(p - previous).toBeLessThan(0.002); // continuous: small time step → small move
      previous = p;
    }
  });

  it("starts and ends slowly (no jolt)", () => {
    const startSpeed = pathProgress(0.001) - pathProgress(0);
    const cruiseSpeed = pathProgress(0.501) - pathProgress(0.5);
    const endSpeed = pathProgress(1) - pathProgress(0.999);
    expect(startSpeed).toBeLessThan(cruiseSpeed / 10);
    expect(endSpeed).toBeLessThan(cruiseSpeed / 10);
  });
});

describe("pathPoint — the fixed route (AC-1)", () => {
  it("starts and ends at the showroom spot", () => {
    for (const p of [pathPoint(0), pathPoint(1)]) {
      expect(p.x).toBeCloseTo(0, 9);
      expect(p.z).toBeCloseTo(0, 9);
    }
  });

  it("stays well inside the environment's projected ground", () => {
    for (let i = 0; i <= 500; i++) {
      const p = pathPoint(i / 500);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(PATH_HALF_WIDTH + 1e-9);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(PATH_HALF_DEPTH / 2 + 1e-9);
      expect(Math.hypot(p.x, p.z) + CHASE_DISTANCE + MAX_LATERAL_OFFSET).toBeLessThan(GROUND_RADIUS / 2);
    }
  });

  it("heading follows the direction of travel", () => {
    for (let i = 0; i < 200; i++) {
      const a = pathPoint(i / 200);
      const b = pathPoint(i / 200 + 1e-5);
      const travel = Math.atan2(b.x - a.x, b.z - a.z);
      const diff = Math.atan2(Math.sin(travel - a.heading), Math.cos(travel - a.heading));
      expect(Math.abs(diff)).toBeLessThan(1e-3);
    }
  });
});

describe("steering — a narrow, bounded feel, never physics (AC-2)", () => {
  function run(state: SteerState, input: number, seconds: number, dt = 1 / 60): SteerState {
    let s = state;
    for (let t = 0; t < seconds; t += dt) s = stepSteer(s, input, dt);
    return s;
  }

  it("holding right drifts the car right, but never past the band", () => {
    const s = run(CENTERED, 1, 10);
    expect(s.offset).toBe(MAX_LATERAL_OFFSET);
    expect(s.velocity).toBe(0); // pinned at the edge — no further drift, no bounce
    expect(run(CENTERED, -1, 10).offset).toBe(-MAX_LATERAL_OFFSET);
  });

  it("the offset stays within ±MAX for any input, including out-of-range values", () => {
    let s = CENTERED;
    for (let i = 0; i < 5000; i++) {
      const input = Math.sin(i * 0.37) * 5; // wild, out-of-range input
      s = stepSteer(s, input, Math.abs(Math.sin(i)) * 0.2);
      expect(Math.abs(s.offset)).toBeLessThanOrEqual(MAX_LATERAL_OFFSET);
      const feel = steerFeel(s);
      expect(Math.abs(feel.lean)).toBeLessThanOrEqual(MAX_LEAN_RAD);
      expect(Math.abs(feel.yaw)).toBeLessThanOrEqual(MAX_YAW_RAD);
    }
  });

  it("letting go brings the car back onto the path", () => {
    const off = run(CENTERED, 1, 2);
    expect(off.offset).toBeGreaterThan(0.5);
    expect(Math.abs(run(off, 0, 5).offset)).toBeLessThan(0.01);
  });

  it("a long frame (e.g. a background tab) can't fling the car", () => {
    const s = stepSteer(CENTERED, 1, 30);
    expect(s.offset).toBeLessThanOrEqual(0.1 * 1.6 + 1e-9);
  });

  it("the car leans and turns into the steer, within the caps", () => {
    const right = steerFeel(stepSteer(CENTERED, 1, 1 / 60));
    expect(right.yaw).toBeLessThan(0);
    expect(Math.abs(right.lean)).toBeGreaterThan(0);
    expect(steerFeel(CENTERED)).toEqual({ lean: -0, yaw: -0 });
  });
});

describe("drivePose — the car and chase camera", () => {
  it("puts the camera behind and above the car, looking ahead of it", () => {
    const pose = drivePose({ x: 0, z: 0, heading: 0 }, CENTERED); // travelling +z
    expect(pose.position).toEqual([0, 0, 0]);
    expect(pose.camera.position[2]).toBeCloseTo(-CHASE_DISTANCE);
    expect(pose.camera.position[1]).toBeGreaterThan(1);
    expect(pose.camera.target[2]).toBeGreaterThan(0);
  });

  it("the steering offset moves the car to the right of its travel direction", () => {
    const pose = drivePose({ x: 0, z: 0, heading: 0 }, { offset: 0.5, velocity: 0 }); // travelling +z
    // Travelling +z (seen from behind), right is -x.
    expect(pose.position[0]).toBeCloseTo(-0.5);
  });
});

describe("turning each model to face its direction of travel", () => {
  const MODEL_FORWARD: Record<ForwardAxis, Vector3> = {
    "+x": new Vector3(1, 0, 0),
    "-x": new Vector3(-1, 0, 0),
    "+z": new Vector3(0, 0, 1),
    "-z": new Vector3(0, 0, -1),
  };

  // The same composition ShowroomScene applies: yaw(heading) · lean · align(-modelYaw).
  function facing(axis: ForwardAxis, heading: number): Vector3 {
    const q = new Quaternion()
      .setFromAxisAngle(new Vector3(0, 1, 0), heading)
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), 0.05))
      .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), -forwardYaw(axis)));
    return MODEL_FORWARD[axis].clone().applyQuaternion(q);
  }

  it.each(["+x", "-x", "+z", "-z"] as ForwardAxis[])("a model facing %s ends up facing the travel direction", (axis) => {
    for (const heading of [0, 0.7, Math.PI / 2, -2.4]) {
      const f = facing(axis, heading);
      expect(f.x).toBeCloseTo(Math.sin(heading), 6);
      expect(f.z).toBeCloseTo(Math.cos(heading), 6);
    }
  });

  it("every real model states its verified forward direction", () => {
    expect(getRealGlbVehicleConfig("porsche-992-gt3-r")?.forwardAxis).toBe("+z");
    expect(getRealGlbVehicleConfig("pagani-huayra-codalunga-speedster")?.forwardAxis).toBe("+z");
    expect(getRealGlbVehicleConfig("lamborghini-revuelto")?.forwardAxis).toBe("+z");
    expect(getRealGlbVehicleConfig("mustang-1965")?.forwardAxis).toBe("-z");
  });
});

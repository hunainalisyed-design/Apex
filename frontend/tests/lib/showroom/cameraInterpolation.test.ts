import { describe, expect, it } from "vitest";
import { lerpCameraState } from "../../../src/lib/showroom/cameraInterpolation";
import type { CameraState } from "../../../src/lib/showroom/cameraPresets";

const A: CameraState = { position: { x: 0, y: 0, z: 0 }, target: { x: 0, y: 0, z: 0 } };
const B: CameraState = { position: { x: 10, y: 20, z: -10 }, target: { x: 2, y: 4, z: 6 } };

describe("lerpCameraState (Spec 13, AC-8/AC-9)", () => {
  it("returns a's exact state at t=0", () => {
    expect(lerpCameraState(A, B, 0)).toEqual(A);
  });

  it("returns b's exact state at t=1", () => {
    expect(lerpCameraState(A, B, 1)).toEqual(B);
  });

  it("returns the midpoint at t=0.5", () => {
    expect(lerpCameraState(A, B, 0.5)).toEqual({
      position: { x: 5, y: 10, z: -5 },
      target: { x: 1, y: 2, z: 3 },
    });
  });

  it("clamps t below 0 to a's exact state", () => {
    expect(lerpCameraState(A, B, -0.5)).toEqual(A);
  });

  it("clamps t above 1 to b's exact state", () => {
    expect(lerpCameraState(A, B, 1.5)).toEqual(B);
  });
});

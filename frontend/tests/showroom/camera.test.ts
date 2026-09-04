import { describe, expect, it } from "vitest";
import { clampDistance, SHOWROOM_CAMERA_BOUNDS } from "../../src/lib/showroom/camera";

describe("clampDistance (AC-4)", () => {
  it("never lets the camera clip inside the vehicle", () => {
    expect(clampDistance(0)).toBe(SHOWROOM_CAMERA_BOUNDS.minDistance);
    expect(clampDistance(-10)).toBe(SHOWROOM_CAMERA_BOUNDS.minDistance);
  });

  it("never lets the camera zoom out past the showroom floor", () => {
    expect(clampDistance(999)).toBe(SHOWROOM_CAMERA_BOUNDS.maxDistance);
  });

  it("passes through values already within bounds", () => {
    expect(clampDistance(6)).toBe(6);
  });
});

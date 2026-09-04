import { describe, expect, it } from "vitest";
import { findHotspot, HOTSPOTS } from "../../src/lib/showroom/hotspots";

describe("hotspot registry (AC-7)", () => {
  it("registers all four wheel meshes to the WHEELS category", () => {
    const wheelHotspots = HOTSPOTS.filter((h) => h.category === "WHEELS");
    expect(wheelHotspots.map((h) => h.meshName).sort()).toEqual([
      "wheel_fl",
      "wheel_fr",
      "wheel_rl",
      "wheel_rr",
    ]);
  });

  it("finds a hotspot by mesh name", () => {
    expect(findHotspot("wheel_fl")).toEqual({ meshName: "wheel_fl", category: "WHEELS" });
  });

  it("registers the body mesh to PAINT and every caliper mesh to BRAKE_CALIPER (Spec 6)", () => {
    expect(findHotspot("body")).toEqual({ meshName: "body", category: "PAINT" });

    const caliperHotspots = HOTSPOTS.filter((h) => h.category === "BRAKE_CALIPER");
    expect(caliperHotspots.map((h) => h.meshName).sort()).toEqual([
      "caliper_wheel_fl",
      "caliper_wheel_fr",
      "caliper_wheel_rl",
      "caliper_wheel_rr",
    ]);
  });

  it("returns undefined for a mesh with no registered hotspot", () => {
    expect(findHotspot("cabin")).toBeUndefined();
  });
});

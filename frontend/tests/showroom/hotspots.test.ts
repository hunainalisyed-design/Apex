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

  it("returns undefined for a mesh with no registered hotspot", () => {
    expect(findHotspot("body")).toBeUndefined();
  });
});

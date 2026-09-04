import { describe, expect, it } from "vitest";
import {
  CAMERA_PRESETS,
  getCameraPreset,
  type CameraPresetId,
} from "../../src/lib/showroom/cameraPresets";

describe("getCameraPreset", () => {
  it("resolves every documented preset id (SRS §4: Front, Rear, Left, Right, Side, Top, Interior, Cockpit)", () => {
    const ids: CameraPresetId[] = [
      "front",
      "rear",
      "left",
      "right",
      "side",
      "top",
      "interior",
      "cockpit",
    ];

    for (const id of ids) {
      const preset = getCameraPreset(id);
      expect(preset.id).toBe(id);
      expect(preset.position).toBeDefined();
      expect(preset.target).toBeDefined();
    }
  });

  it("marks only interior/cockpit as isInterior (AC-6)", () => {
    for (const preset of CAMERA_PRESETS) {
      expect(preset.isInterior).toBe(preset.id === "interior" || preset.id === "cockpit");
    }
  });

  it("reset returns the default three-quarter exterior view", () => {
    const preset = getCameraPreset("default");
    expect(preset.isInterior).toBe(false);
  });

  it("throws for an unknown preset id", () => {
    // @ts-expect-error deliberately invalid input
    expect(() => getCameraPreset("not-a-preset")).toThrow();
  });
});

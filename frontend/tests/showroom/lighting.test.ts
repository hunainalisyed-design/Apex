import { describe, expect, it } from "vitest";
import { getBrakeLightEmissive, getHeadlightEmissive } from "../../src/lib/showroom/lighting";

describe("getHeadlightEmissive (AC-9)", () => {
  it("is a real emissive change, not a UI-only flag", () => {
    expect(getHeadlightEmissive(true).intensity).toBeGreaterThan(0);
    expect(getHeadlightEmissive(false).intensity).toBe(0);
  });
});

describe("getBrakeLightEmissive (AC-9)", () => {
  it("pulses brighter than its idle state", () => {
    const idle = getBrakeLightEmissive(false);
    const pulsing = getBrakeLightEmissive(true);
    expect(pulsing.intensity).toBeGreaterThan(idle.intensity);
  });
});

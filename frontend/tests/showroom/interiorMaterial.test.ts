import { describe, expect, it } from "vitest";
import { composeInteriorMaterial } from "../../src/lib/showroom/interiorMaterial";

describe("composeInteriorMaterial", () => {
  it("grade change preserves the passed color (AC-2)", () => {
    const cloth = composeInteriorMaterial("interior-material-standard-cloth", "#5c1a2b");
    const leather = composeInteriorMaterial("interior-material-premium-leather", "#5c1a2b");

    expect(cloth.color).toBe("#5c1a2b");
    expect(leather.color).toBe("#5c1a2b");
    expect(cloth.roughness).not.toBe(leather.roughness);
  });

  it("color change preserves the resolved grade properties (AC-3)", () => {
    const black = composeInteriorMaterial("interior-material-alcantara", "#111111");
    const tan = composeInteriorMaterial("interior-material-alcantara", "#c9a876");

    expect(black.roughness).toBe(tan.roughness);
    expect(black.metalness).toBe(tan.metalness);
    expect(black.color).not.toBe(tan.color);
  });

  it("distinguishes all three seeded grades from each other", () => {
    const cloth = composeInteriorMaterial("interior-material-standard-cloth", "#111111");
    const leather = composeInteriorMaterial("interior-material-premium-leather", "#111111");
    const alcantara = composeInteriorMaterial("interior-material-alcantara", "#111111");

    const roughnessValues = new Set([cloth.roughness, leather.roughness, alcantara.roughness]);
    expect(roughnessValues.size).toBe(3);
  });

  it("falls back to a sensible default for an unknown grade", () => {
    const result = composeInteriorMaterial("not-a-real-grade", "#111111");
    expect(result.color).toBe("#111111");
    expect(typeof result.roughness).toBe("number");
    expect(typeof result.metalness).toBe("number");
  });
});

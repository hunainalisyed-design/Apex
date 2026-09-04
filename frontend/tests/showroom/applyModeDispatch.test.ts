import { describe, expect, it } from "vitest";
import { resolveAppearance } from "../../src/lib/showroom/applyModeDispatch";
import type { CustomizationOptionDto } from "../../src/types/catalog";

function makeOption(overrides: Partial<CustomizationOptionDto> = {}): CustomizationOptionDto {
  return {
    id: "opt-1",
    category: "PAINT",
    name: "Racing Red",
    description: null,
    priceDeltaCents: 150000,
    assetRef: "paint-racing-red",
    swatchColor: "#b3121b",
    applyMode: "MATERIAL_SWAP",
    isDefault: false,
    sortOrder: 0,
    ...overrides,
  };
}

describe("resolveAppearance", () => {
  it("MATERIAL_SWAP resolves to the option's swatch color", () => {
    const result = resolveAppearance(makeOption({ applyMode: "MATERIAL_SWAP", swatchColor: "#b3121b" }));
    expect(result).toEqual({ kind: "material", color: "#b3121b" });
  });

  it("MATERIAL_SWAP falls back to a default color when swatchColor is null", () => {
    const result = resolveAppearance(
      makeOption({ applyMode: "MATERIAL_SWAP", swatchColor: null, assetRef: "paint-custom" }),
    );
    expect(result.kind).toBe("material");
  });

  it("MESH_VARIANT_SWAP resolves to the option's assetRef as the variant key", () => {
    const result = resolveAppearance(
      makeOption({ category: "WHEELS", applyMode: "MESH_VARIANT_SWAP", assetRef: "wheel-sport-20" }),
    );
    expect(result).toEqual({ kind: "variant", variant: "wheel-sport-20" });
  });

  it("MESH_VISIBILITY hides the '-none' seeded default and shows everything else", () => {
    const hidden = resolveAppearance(
      makeOption({ category: "SPOILER", applyMode: "MESH_VISIBILITY", assetRef: "spoiler-none", isDefault: true }),
    );
    expect(hidden).toMatchObject({ kind: "visibility", visible: false });

    const shown = resolveAppearance(
      makeOption({ category: "SPOILER", applyMode: "MESH_VISIBILITY", assetRef: "spoiler-carbon" }),
    );
    expect(shown).toMatchObject({ kind: "visibility", visible: true });
  });

  it("MESH_VISIBILITY hides the '-standard' seeded default (BODY_PACKAGE)", () => {
    const hidden = resolveAppearance(
      makeOption({
        category: "BODY_PACKAGE",
        applyMode: "MESH_VISIBILITY",
        assetRef: "body-package-standard",
        isDefault: true,
      }),
    );
    expect(hidden).toMatchObject({ kind: "visibility", visible: false });
  });

  it("MESH_VISIBILITY carries the option's swatch color through when present", () => {
    const result = resolveAppearance(
      makeOption({
        category: "BRAKE_CALIPER",
        applyMode: "MESH_VISIBILITY",
        assetRef: "brake-caliper-red",
        swatchColor: "#c81e2c",
      }),
    );
    expect(result).toMatchObject({ kind: "visibility", visible: true, color: "#c81e2c" });
  });
});

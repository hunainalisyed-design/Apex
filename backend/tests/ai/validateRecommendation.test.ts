import type { CustomizationOptionDto } from "../../src/types/catalog.js";
import { describe, expect, it } from "vitest";
import { validateRecommendation } from "../../src/services/ai/validateRecommendation.js";

function makeOption(overrides: Partial<CustomizationOptionDto> = {}): CustomizationOptionDto {
  return {
    id: "opt_1",
    category: "PAINT",
    name: "Obsidian Black",
    description: null,
    priceDeltaCents: 0,
    assetRef: "paint-obsidian-black",
    swatchColor: "#0a0a0c",
    applyMode: "MATERIAL_SWAP",
    isDefault: true,
    sortOrder: 0,
    ...overrides,
  };
}

describe("validateRecommendation (Spec 14, AC-2)", () => {
  const options = [
    makeOption({ id: "paint-a", category: "PAINT" }),
    makeOption({ id: "wheels-a", category: "WHEELS" }),
    makeOption({ id: "acc-a", category: "ACCESSORY" }),
    makeOption({ id: "acc-b", category: "ACCESSORY" }),
  ];

  it("keeps a valid single-select pair", () => {
    const result = validateRecommendation({ PAINT: "paint-a" }, options);
    expect(result.singleSelections.PAINT).toBe("paint-a");
  });

  it("drops a single-select id that doesn't exist in the catalog at all", () => {
    const result = validateRecommendation({ PAINT: "does-not-exist" }, options);
    expect(result.singleSelections.PAINT).toBeUndefined();
  });

  it("drops a single-select id that exists but belongs to a different category", () => {
    // "wheels-a" is real, but the model claimed it under PAINT.
    const result = validateRecommendation({ PAINT: "wheels-a" }, options);
    expect(result.singleSelections.PAINT).toBeUndefined();
  });

  it("drops a single-select field whose value isn't a string (e.g. a stray number/object)", () => {
    const result = validateRecommendation({ PAINT: 42 }, options);
    expect(result.singleSelections.PAINT).toBeUndefined();
  });

  it("treats null as no change, not an error", () => {
    const result = validateRecommendation({ PAINT: null }, options);
    expect(result.singleSelections.PAINT).toBeUndefined();
  });

  it("keeps valid multi-select ids and drops invalid ones from the same array", () => {
    const result = validateRecommendation({ ACCESSORY: ["acc-a", "does-not-exist", "acc-b"] }, options);
    expect(result.multiSelections.ACCESSORY).toEqual(["acc-a", "acc-b"]);
  });

  it("drops a multi-select category entirely when every id in it is invalid", () => {
    const result = validateRecommendation({ ACCESSORY: ["does-not-exist"] }, options);
    expect(result.multiSelections.ACCESSORY).toBeUndefined();
  });

  it("drops a multi-select id that belongs to a different category", () => {
    const result = validateRecommendation({ ACCESSORY: ["paint-a"] }, options);
    expect(result.multiSelections.ACCESSORY).toBeUndefined();
  });

  it("returns empty single/multi selections for a fully-null (no recommendation) input", () => {
    const raw = { PAINT: null, WHEELS: null, ACCESSORY: null };
    const result = validateRecommendation(raw, options);
    expect(result.singleSelections).toEqual({});
    expect(result.multiSelections).toEqual({});
  });

  it("never throws, regardless of how malformed the input is", () => {
    expect(() => validateRecommendation({ PAINT: { nested: true }, ACCESSORY: "not-an-array" }, options)).not.toThrow();
  });
});

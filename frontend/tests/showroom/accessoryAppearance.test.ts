import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAccessoryAppearance } from "../../src/lib/showroom/accessoryAppearance";
import type { CustomizationOptionDto, OptionCategory, VehicleDetailDto } from "../../src/types/catalog";

function makeOption(overrides: Partial<CustomizationOptionDto>): CustomizationOptionDto {
  return {
    id: "opt-1",
    category: "ACCESSORY",
    name: "Test Accessory",
    description: null,
    priceDeltaCents: 100000,
    assetRef: "accessory-test",
    swatchColor: null,
    applyMode: "MATERIAL_SWAP",
    isDefault: false,
    sortOrder: 0,
    ...overrides,
  };
}

const PAINT_COLOR = "#1f4b8f";

function makeVehicle(options: CustomizationOptionDto[]): VehicleDetailDto {
  const grouped = {
    ACCESSORY: options.filter((o) => o.category === "ACCESSORY"),
    PACKAGE: options.filter((o) => o.category === "PACKAGE"),
  } as Record<OptionCategory, CustomizationOptionDto[]>;

  return {
    slug: "apex-gt",
    name: "Apex GT",
    tagline: "Performance sports car.",
    basePriceCents: 8_500_000,
    currency: "EUR",
    horsepower: 450,
    topSpeedKph: 280,
    zeroToHundredSec: 4.2,
    thumbnailUrl: "/thumb.jpg",
    heroModelUrl: "/hero.glb",
    showroomModelUrl: "/showroom.glb",
    options: grouped,
  };
}

const carbonRoof = makeOption({
  id: "roof-1",
  assetRef: "accessory-carbon-roof",
  swatchColor: "#0d0d10",
});
const mirrorCaps = makeOption({
  id: "mirror-1",
  assetRef: "accessory-carbon-mirror-caps",
  swatchColor: "#0d0d10",
});
const sportExhaust = makeOption({
  id: "exhaust-1",
  assetRef: "accessory-sport-exhaust",
  applyMode: "MESH_VISIBILITY",
});
const unmapped = makeOption({
  id: "lighting-1",
  name: "Premium Lighting Package",
  assetRef: "accessory-premium-lighting",
});

describe("resolveAccessoryAppearance", () => {
  it("defaults roof and mirror caps to the current paint color when nothing is active (AC-3)", () => {
    const vehicle = makeVehicle([carbonRoof, mirrorCaps]);
    const result = resolveAccessoryAppearance(vehicle, { ACCESSORY: [], PACKAGE: [] }, PAINT_COLOR);

    expect(result.roofColor).toBe(PAINT_COLOR);
    expect(result.mirrorCapsColor).toBe(PAINT_COLOR);
    expect(result.exhaustTipVisible).toBe(false);
  });

  it("switches the roof and mirror caps to carbon when their accessory is active (AC-3)", () => {
    const vehicle = makeVehicle([carbonRoof, mirrorCaps]);
    const result = resolveAccessoryAppearance(
      vehicle,
      { ACCESSORY: [carbonRoof.id, mirrorCaps.id], PACKAGE: [] },
      PAINT_COLOR,
    );

    expect(result.roofColor).toBe("#0d0d10");
    expect(result.mirrorCapsColor).toBe("#0d0d10");
  });

  it("reverts to the current paint (not a hardcoded default) when toggled back off (AC-3)", () => {
    const vehicle = makeVehicle([carbonRoof]);
    const active = resolveAccessoryAppearance(vehicle, { ACCESSORY: [carbonRoof.id], PACKAGE: [] }, PAINT_COLOR);
    expect(active.roofColor).toBe("#0d0d10");

    const inactive = resolveAccessoryAppearance(vehicle, { ACCESSORY: [], PACKAGE: [] }, PAINT_COLOR);
    expect(inactive.roofColor).toBe(PAINT_COLOR);
  });

  it("shows the exhaust tip only while Sport Exhaust is active (AC-2)", () => {
    const vehicle = makeVehicle([sportExhaust]);

    expect(
      resolveAccessoryAppearance(vehicle, { ACCESSORY: [], PACKAGE: [] }, PAINT_COLOR).exhaustTipVisible,
    ).toBe(false);
    expect(
      resolveAccessoryAppearance(vehicle, { ACCESSORY: [sportExhaust.id], PACKAGE: [] }, PAINT_COLOR)
        .exhaustTipVisible,
    ).toBe(true);
  });

  it("applies multiple active accessories simultaneously with no conflict (AC-5)", () => {
    const vehicle = makeVehicle([carbonRoof, mirrorCaps, sportExhaust]);
    const result = resolveAccessoryAppearance(
      vehicle,
      { ACCESSORY: [carbonRoof.id, mirrorCaps.id, sportExhaust.id], PACKAGE: [] },
      PAINT_COLOR,
    );

    expect(result.roofColor).toBe("#0d0d10");
    expect(result.mirrorCapsColor).toBe("#0d0d10");
    expect(result.exhaustTipVisible).toBe(true);
  });

  describe("AC-6: no visual for an option with no asset mapping", () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      vi.stubEnv("NODE_ENV", "development");
      vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      vi.stubEnv("NODE_ENV", originalEnv ?? "test");
      vi.restoreAllMocks();
    });

    it("warns exactly once in dev and applies no visual, without throwing", () => {
      const vehicle = makeVehicle([unmapped]);

      expect(() =>
        resolveAccessoryAppearance(vehicle, { ACCESSORY: [unmapped.id], PACKAGE: [] }, PAINT_COLOR),
      ).not.toThrow();

      expect(console.warn).toHaveBeenCalledOnce();
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Premium Lighting"));
    });

    it("does not warn when the option is inactive", () => {
      const vehicle = makeVehicle([unmapped]);
      resolveAccessoryAppearance(vehicle, { ACCESSORY: [], PACKAGE: [] }, PAINT_COLOR);

      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});

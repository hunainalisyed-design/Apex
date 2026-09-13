import { describe, expect, it } from "vitest";
import { seedVehicles } from "../prisma/seedData.js";
import { validateSingleSelectDefaults } from "../src/services/catalog.js";
import type { OptionCategory } from "../src/types/catalog.js";

// Minimum row counts from docs/specs/02-vehicle-catalog-data-model.md §4.
const MINIMUM_ROWS: Record<OptionCategory, number> = {
  PAINT: 6,
  WHEELS: 4,
  BRAKE_CALIPER: 5,
  WINDOW_TINT: 2,
  SPOILER: 2,
  FRONT_ACCESSORY: 1,
  REAR_ACCESSORY: 1,
  BODY_PACKAGE: 2,
  CARBON_COMPONENT: 1,
  INTERIOR_MATERIAL: 3,
  INTERIOR_LIGHTING: 4,
  INTERIOR_SEATS: 2,
  INTERIOR_DASHBOARD: 2,
  INTERIOR_STEERING_WHEEL: 2,
  INTERIOR_DOOR_PANELS: 2,
  INTERIOR_FLOOR: 2,
  ACCESSORY: 1,
  PACKAGE: 1,
};

describe("seed data", () => {
  it("seeds at least the two example vehicles from SRS §6 ('Support multiple vehicles' — Apex GT/RS are its examples, not an exhaustive list)", () => {
    expect(seedVehicles.map((v) => v.slug)).toEqual(expect.arrayContaining(["apex-gt", "apex-rs"]));
  });

  for (const vehicle of [
    { slug: "apex-gt", basePriceCents: 8_500_000, horsepower: 450, zeroToHundredSec: 4.2 },
    { slug: "apex-rs", basePriceCents: 10_500_000, horsepower: 510, zeroToHundredSec: 3.8 },
  ]) {
    it(`matches SRS §6 specs for ${vehicle.slug}`, () => {
      const seeded = seedVehicles.find((v) => v.slug === vehicle.slug);
      expect(seeded).toMatchObject(vehicle);
    });
  }

  it.each(seedVehicles.map((v) => v.slug))(
    "%s has exactly one default per single-select category (AC-4)",
    (slug) => {
      const vehicle = seedVehicles.find((v) => v.slug === slug)!;
      expect(validateSingleSelectDefaults(vehicle.options)).toEqual([]);
    },
  );

  it.each(seedVehicles.map((v) => v.slug))("%s meets every category's minimum row count", (slug) => {
    const vehicle = seedVehicles.find((v) => v.slug === slug)!;

    for (const [category, minimum] of Object.entries(MINIMUM_ROWS) as [OptionCategory, number][]) {
      const count = vehicle.options.filter((o) => o.category === category).length;
      expect(count, `${slug} / ${category}`).toBeGreaterThanOrEqual(minimum);
    }
  });

  it("stores every price as an integer number of cents (AC-5)", () => {
    for (const vehicle of seedVehicles) {
      expect(Number.isInteger(vehicle.basePriceCents)).toBe(true);
      for (const option of vehicle.options) {
        expect(Number.isInteger(option.priceDeltaCents), `${vehicle.slug} / ${option.name}`).toBe(
          true,
        );
      }
    }
  });

  it("gives every option a valid applyMode (Spec 6)", () => {
    const validModes = new Set(["MATERIAL_SWAP", "MESH_VARIANT_SWAP", "MESH_VISIBILITY"]);
    for (const vehicle of seedVehicles) {
      for (const option of vehicle.options) {
        expect(validModes.has(option.applyMode), `${vehicle.slug} / ${option.name}`).toBe(true);
      }
    }
  });

  it("gives every WHEELS option MESH_VARIANT_SWAP and every PAINT option MATERIAL_SWAP", () => {
    for (const vehicle of seedVehicles) {
      for (const option of vehicle.options.filter((o) => o.category === "WHEELS")) {
        expect(option.applyMode, option.name).toBe("MESH_VARIANT_SWAP");
      }
      for (const option of vehicle.options.filter((o) => o.category === "PAINT")) {
        expect(option.applyMode, option.name).toBe("MATERIAL_SWAP");
      }
    }
  });
});

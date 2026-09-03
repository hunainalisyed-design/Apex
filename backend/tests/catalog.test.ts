import { Prisma, type CustomizationOption, type Vehicle } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  mapOptionToDto,
  mapVehicleToDetailDto,
  mapVehicleToSummaryDto,
  validateSingleSelectDefaults,
} from "../src/services/catalog.js";
import { ALL_CATEGORIES } from "../src/types/catalog.js";

function makeVehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: "vehicle_1",
    slug: "apex-gt",
    name: "Apex GT",
    tagline: "Performance sports car.",
    basePriceCents: 8_500_000,
    currency: "EUR",
    horsepower: 450,
    topSpeedKph: 280,
    zeroToHundredSec: new Prisma.Decimal("4.2"),
    heroModelUrl: "/models/apex-gt/hero.glb",
    showroomModelUrl: "/models/apex-gt/showroom.glb",
    thumbnailUrl: "/models/apex-gt/thumbnail.jpg",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeOption(overrides: Partial<CustomizationOption> = {}): CustomizationOption {
  return {
    id: "option_1",
    vehicleId: "vehicle_1",
    category: "PAINT",
    name: "Obsidian Black",
    description: null,
    priceDeltaCents: 0,
    assetRef: "paint-obsidian-black",
    swatchColor: "#0a0a0c",
    isDefault: true,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("mapOptionToDto", () => {
  it("maps every field, including nullable ones", () => {
    const dto = mapOptionToDto(makeOption({ description: "A deep black finish." }));

    expect(dto).toEqual({
      id: "option_1",
      category: "PAINT",
      name: "Obsidian Black",
      description: "A deep black finish.",
      priceDeltaCents: 0,
      assetRef: "paint-obsidian-black",
      swatchColor: "#0a0a0c",
      isDefault: true,
      sortOrder: 0,
    });
  });
});

describe("mapVehicleToSummaryDto", () => {
  it("converts the Prisma Decimal zeroToHundredSec into a plain number", () => {
    const dto = mapVehicleToSummaryDto(makeVehicle());

    expect(dto.zeroToHundredSec).toBe(4.2);
    expect(typeof dto.zeroToHundredSec).toBe("number");
  });
});

describe("mapVehicleToDetailDto", () => {
  it("groups options by category and pre-seeds every category, including empty ones", () => {
    const dto = mapVehicleToDetailDto(makeVehicle(), [
      makeOption({ id: "a", category: "PAINT" }),
      makeOption({ id: "b", category: "WHEELS", isDefault: true }),
    ]);

    expect(Object.keys(dto.options).sort()).toEqual([...ALL_CATEGORIES].sort());
    expect(dto.options.PAINT).toHaveLength(1);
    expect(dto.options.WHEELS).toHaveLength(1);
    expect(dto.options.BRAKE_CALIPER).toEqual([]);
  });
});

describe("validateSingleSelectDefaults", () => {
  it("reports no violations when every single-select category has exactly one default", () => {
    const options = ALL_CATEGORIES.map((category, index) =>
      makeOption({ id: `opt_${index}`, category, isDefault: true }),
    );

    expect(validateSingleSelectDefaults(options)).toEqual([]);
  });

  it("flags a category with zero defaults", () => {
    const options = [makeOption({ category: "PAINT", isDefault: false })];

    const violations = validateSingleSelectDefaults(options);
    expect(violations.find((v) => v.category === "PAINT")).toEqual({
      category: "PAINT",
      defaultCount: 0,
    });
  });

  it("flags a category with more than one default", () => {
    const options = [
      makeOption({ id: "a", category: "PAINT", isDefault: true }),
      makeOption({ id: "b", category: "PAINT", isDefault: true }),
    ];

    const violations = validateSingleSelectDefaults(options);
    expect(violations.find((v) => v.category === "PAINT")).toEqual({
      category: "PAINT",
      defaultCount: 2,
    });
  });

  it("does not require a default for multi-select categories", () => {
    const options = ALL_CATEGORIES.filter(
      (c) => c !== "ACCESSORY" && c !== "PACKAGE",
    ).map((category, index) => makeOption({ id: `opt_${index}`, category, isDefault: true }));

    expect(validateSingleSelectDefaults(options)).toEqual([]);
  });
});

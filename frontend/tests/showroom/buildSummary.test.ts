import { describe, expect, it } from "vitest";
import { deriveBuildSummary } from "../../src/lib/showroom/buildSummary";
import { DEFAULT_EXTERIOR_APPEARANCE } from "../../src/lib/showroom/exteriorAppearance";
import { CUSTOM_COLOR_ASSET_REF } from "../../src/lib/showroom/paintCustomColor";
import { ALL_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog";
import type { CustomizationOptionDto, OptionCategory, VehicleDetailDto } from "../../src/types/catalog";
import type { MultiSelectCategory, SingleSelectCategory } from "../../src/types/pricing";

function makeOption(
  overrides: Partial<CustomizationOptionDto> & { category: OptionCategory; id: string },
): CustomizationOptionDto {
  return {
    name: "Default",
    description: null,
    priceDeltaCents: 0,
    assetRef: overrides.id.toLowerCase(),
    swatchColor: null,
    applyMode: "MATERIAL_SWAP",
    isDefault: false,
    sortOrder: 0,
    ...overrides,
  };
}

function defaultCatalog(): Partial<Record<OptionCategory, CustomizationOptionDto[]>> {
  const catalog: Partial<Record<OptionCategory, CustomizationOptionDto[]>> = {};
  for (const category of SINGLE_SELECT_CATEGORIES) {
    catalog[category] = [makeOption({ category, id: `${category}-default`, isDefault: true })];
  }
  catalog.ACCESSORY = [];
  catalog.PACKAGE = [];
  return catalog;
}

function makeVehicle(optionsByCategory: Partial<Record<OptionCategory, CustomizationOptionDto[]>>): VehicleDetailDto {
  const options = Object.fromEntries(
    ALL_CATEGORIES.map((category) => [category, optionsByCategory[category] ?? []]),
  ) as Record<OptionCategory, CustomizationOptionDto[]>;

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
    fallbackImageUrl: "/fallback.jpg",
    heroModelUrl: "/hero.glb",
    showroomModelUrl: "/showroom.glb",
    options,
  };
}

function defaultSingleSelections(): Record<SingleSelectCategory, string> {
  return Object.fromEntries(SINGLE_SELECT_CATEGORIES.map((c) => [c, `${c}-default`])) as Record<
    SingleSelectCategory,
    string
  >;
}

function emptyMulti(): Record<MultiSelectCategory, string[]> {
  return { ACCESSORY: [], PACKAGE: [] };
}

describe("deriveBuildSummary", () => {
  it("always includes paint, wheels, and interior finish regardless of default status (AC-1)", () => {
    const vehicle = makeVehicle(defaultCatalog());
    const summary = deriveBuildSummary(vehicle, defaultSingleSelections(), emptyMulti(), null);

    expect(summary.alwaysShown.map((l) => l.category)).toEqual(["PAINT", "WHEELS", "INTERIOR_MATERIAL"]);
    expect(summary.alwaysShown.every((l) => l.optionName === "Default")).toBe(true);
  });

  it("shows 'Custom Color' with the stored hex when the custom-color sentinel is selected (AC-2)", () => {
    const catalog = defaultCatalog();
    catalog.PAINT = [
      makeOption({ category: "PAINT", id: "paint-default", isDefault: true }),
      makeOption({
        category: "PAINT",
        id: "paint-custom",
        assetRef: CUSTOM_COLOR_ASSET_REF,
        name: "Custom Color",
        priceDeltaCents: 250000,
      }),
    ];
    const vehicle = makeVehicle(catalog);
    const selections = { ...defaultSingleSelections(), PAINT: "paint-custom" };

    const summary = deriveBuildSummary(vehicle, selections, emptyMulti(), "#ff0000");
    const paintLine = summary.alwaysShown.find((l) => l.category === "PAINT")!;

    expect(paintLine.optionName).toBe("Custom Color");
    expect(paintLine.swatchColor).toBe("#ff0000");
    expect(paintLine.priceDeltaCents).toBe(250000);
  });

  it("falls back to the default exterior paint color when Custom Color is selected but no hex is set yet (AC-2)", () => {
    const catalog = defaultCatalog();
    catalog.PAINT = [
      makeOption({ category: "PAINT", id: "paint-default", isDefault: true }),
      makeOption({ category: "PAINT", id: "paint-custom", assetRef: CUSTOM_COLOR_ASSET_REF, name: "Custom Color" }),
    ];
    const vehicle = makeVehicle(catalog);
    const selections = { ...defaultSingleSelections(), PAINT: "paint-custom" };

    // configurationStore clears customPaintHex to null on every PAINT selection change,
    // including selecting Custom Color itself — the picker only sets a hex once dragged.
    const summary = deriveBuildSummary(vehicle, selections, emptyMulti(), null);
    const paintLine = summary.alwaysShown.find((l) => l.category === "PAINT")!;

    expect(paintLine.swatchColor).toBe(DEFAULT_EXTERIOR_APPEARANCE.paintColor);
  });

  it("omits a category left at its free default (AC-3)", () => {
    const vehicle = makeVehicle(defaultCatalog());
    const summary = deriveBuildSummary(vehicle, defaultSingleSelections(), emptyMulti(), null);

    expect(summary.conditionalLines).toEqual([]);
  });

  it("includes a category holding a non-default option (AC-3)", () => {
    const catalog = defaultCatalog();
    catalog.BRAKE_CALIPER = [
      makeOption({ category: "BRAKE_CALIPER", id: "brake-default", isDefault: true }),
      makeOption({ category: "BRAKE_CALIPER", id: "brake-red", name: "Red", priceDeltaCents: 45000 }),
    ];
    const vehicle = makeVehicle(catalog);
    const selections = { ...defaultSingleSelections(), BRAKE_CALIPER: "brake-red" };

    const summary = deriveBuildSummary(vehicle, selections, emptyMulti(), null);

    expect(summary.conditionalLines).toHaveLength(1);
    expect(summary.conditionalLines[0]).toMatchObject({
      category: "BRAKE_CALIPER",
      optionName: "Red",
      priceDeltaCents: 45000,
    });
  });

  it("includes a default option that still costs money (AC-3)", () => {
    const catalog = defaultCatalog();
    catalog.SPOILER = [makeOption({ category: "SPOILER", id: "SPOILER-default", isDefault: true, priceDeltaCents: 15000 })];
    const vehicle = makeVehicle(catalog);

    const summary = deriveBuildSummary(vehicle, defaultSingleSelections(), emptyMulti(), null);

    expect(summary.conditionalLines).toHaveLength(1);
    expect(summary.conditionalLines[0]).toMatchObject({ category: "SPOILER", priceDeltaCents: 15000 });
  });

  it("shows 'None' for accessories and packages when nothing is active (AC-4)", () => {
    const vehicle = makeVehicle(defaultCatalog());
    const summary = deriveBuildSummary(vehicle, defaultSingleSelections(), emptyMulti(), null);

    expect(summary.accessories).toEqual([
      { category: "ACCESSORY", label: "Accessories", optionName: "None", priceDeltaCents: 0 },
    ]);
    expect(summary.packages).toEqual([
      { category: "PACKAGE", label: "Packages", optionName: "None", priceDeltaCents: 0 },
    ]);
  });

  it("shows 'None' even when the vehicle has zero seeded accessories, unlike AccessoriesPanel's own omit-the-group choice (AC-4)", () => {
    const vehicle = makeVehicle(defaultCatalog()); // ACCESSORY/PACKAGE catalogs are empty arrays
    const summary = deriveBuildSummary(vehicle, defaultSingleSelections(), emptyMulti(), null);

    expect(summary.accessories[0].optionName).toBe("None");
    expect(summary.packages[0].optionName).toBe("None");
  });

  it("lists each active accessory and package individually (AC-5)", () => {
    const catalog = defaultCatalog();
    catalog.ACCESSORY = [
      makeOption({ category: "ACCESSORY", id: "acc-1", name: "Carbon Mirror Caps", priceDeltaCents: 60000 }),
      makeOption({ category: "ACCESSORY", id: "acc-2", name: "Sport Exhaust", priceDeltaCents: 250000 }),
    ];
    catalog.PACKAGE = [makeOption({ category: "PACKAGE", id: "pkg-1", name: "Performance Package", priceDeltaCents: 800000 })];
    const vehicle = makeVehicle(catalog);
    const multiSelections = { ACCESSORY: ["acc-1", "acc-2"], PACKAGE: ["pkg-1"] };

    const summary = deriveBuildSummary(vehicle, defaultSingleSelections(), multiSelections, null);

    expect(summary.accessories.map((l) => l.optionName)).toEqual(["Carbon Mirror Caps", "Sport Exhaust"]);
    expect(summary.packages.map((l) => l.optionName)).toEqual(["Performance Package"]);
  });

  it("returns a breakdown identical to calling calculatePrice directly, with raw (unformatted) cent values (AC-8)", () => {
    const catalog = defaultCatalog();
    const vehicle = makeVehicle(catalog);

    const summary = deriveBuildSummary(vehicle, defaultSingleSelections(), emptyMulti(), null);

    expect(summary.breakdown.basePriceCents).toBe(vehicle.basePriceCents);
    expect(summary.breakdown.totalPriceCents).toBe(vehicle.basePriceCents);
    for (const line of [...summary.alwaysShown, ...summary.conditionalLines]) {
      expect(Number.isInteger(line.priceDeltaCents)).toBe(true);
    }
  });

  it("propagates the same throw as calculatePrice when a selection is unresolved", () => {
    const vehicle = makeVehicle(defaultCatalog());
    const badSelections = { ...defaultSingleSelections(), PAINT: "" };

    expect(() => deriveBuildSummary(vehicle, badSelections, emptyMulti(), null)).toThrow();
  });
});

import { describe, expect, it } from "vitest";
import { deriveOgImageContent } from "../../src/lib/seo/ogImageContent";
import { ALL_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog";
import type { CustomizationOptionDto, OptionCategory, VehicleDetailDto } from "../../src/types/catalog";
import type { SavedConfigurationDto } from "../../src/types/configuration";
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

function makeVehicle(optionsByCategory = defaultCatalog()): VehicleDetailDto {
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

function makeSaved(overrides: Partial<SavedConfigurationDto> = {}): SavedConfigurationDto {
  return {
    publicId: "APEX-AAAA-BBBB",
    vehicleSlug: "apex-gt",
    singleSelections: defaultSingleSelections(),
    multiSelections: emptyMulti(),
    customPaintHex: null,
    environmentId: null,
    breakdown: {
      vehicleSlug: "apex-gt",
      basePriceCents: 8_500_000,
      lineItems: [],
      totalPriceCents: 8_500_000,
      currency: "EUR",
    },
    createdAt: new Date().toISOString(),
    ownerId: null,
    isPublished: false,
    publishedAt: null,
    ...overrides,
  };
}

describe("deriveOgImageContent", () => {
  it("falls back to vehicle name/tagline/starting price when there's no saved build (AC-2 default state)", () => {
    const content = deriveOgImageContent(makeVehicle(), null);

    expect(content).toEqual({
      vehicleName: "Apex GT",
      tagline: "Performance sports car.",
      priceLabel: "Starting at €85,000",
      lines: [],
    });
  });

  it("includes up to 3 build-summary lines and the saved build's total price for a matching build", () => {
    const content = deriveOgImageContent(makeVehicle(), makeSaved({ breakdown: { ...makeSaved().breakdown, totalPriceCents: 9_000_000 } }));

    expect(content.priceLabel).toBe("€90,000");
    expect(content.lines).toHaveLength(3);
    expect(content.lines).toEqual(["Paint: Default", "Wheels: Default", "Overall Finish: Default"]);
  });

  it("falls back to the vehicle's default content when the saved build belongs to a different vehicle", () => {
    const content = deriveOgImageContent(makeVehicle(), makeSaved({ vehicleSlug: "apex-rs" }));

    expect(content.lines).toEqual([]);
    expect(content.priceLabel).toBe("Starting at €85,000");
  });

  it("still returns the build's price even if its selections no longer resolve against the live catalog", () => {
    // e.g. an option referenced by this saved build was deactivated since (Spec 21, AC-3) —
    // deriveBuildSummary would throw; this must degrade gracefully, never crash the OG route.
    const saved = makeSaved({ singleSelections: { ...defaultSingleSelections(), PAINT: "no-longer-exists" } });
    const content = deriveOgImageContent(makeVehicle(), saved);

    expect(content.priceLabel).toBe("€85,000");
    expect(content.vehicleName).toBe("Apex GT");
  });
});

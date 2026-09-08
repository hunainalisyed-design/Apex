import { beforeEach, describe, expect, it } from "vitest";
import {
  emptyMultiSelections,
  emptySingleSelections,
  useConfigurationStore,
} from "../../src/state/configurationStore";
import { ALL_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog";
import type { CustomizationOptionDto, OptionCategory, VehicleDetailDto } from "../../src/types/catalog";

function makeOption(
  category: OptionCategory,
  suffix: string,
  isDefault: boolean,
): CustomizationOptionDto {
  return {
    id: `${category}-${suffix}`,
    category,
    name: `${category} ${suffix}`,
    description: null,
    priceDeltaCents: 0,
    assetRef: `${category}-${suffix}`.toLowerCase(),
    swatchColor: null,
    applyMode: "MATERIAL_SWAP",
    isDefault,
    sortOrder: 0,
  };
}

function makeVehicle(slug: string): VehicleDetailDto {
  const options = Object.fromEntries(
    ALL_CATEGORIES.map((category) => [
      category,
      [makeOption(category, "default", true), makeOption(category, "alt", false)],
    ]),
  ) as Record<OptionCategory, CustomizationOptionDto[]>;

  return {
    slug,
    name: "Test Vehicle",
    tagline: "For tests.",
    basePriceCents: 1_000_000,
    currency: "EUR",
    horsepower: 400,
    topSpeedKph: 250,
    zeroToHundredSec: 4.5,
    thumbnailUrl: "/thumb.jpg",
    fallbackImageUrl: "/fallback.jpg",
    heroModelUrl: "/hero.glb",
    showroomModelUrl: "/showroom.glb",
    options,
  };
}

describe("configurationStore", () => {
  beforeEach(() => {
    useConfigurationStore.setState({
      vehicleSlug: "",
      singleSelections: emptySingleSelections(),
      customPaintHex: null,
      multiSelections: emptyMultiSelections(),
    });
  });

  it("hydrateDefaults populates every single-select category from isDefault options, never empty (AC-10)", () => {
    const vehicle = makeVehicle("apex-gt");
    useConfigurationStore.getState().hydrateDefaults(vehicle);

    const state = useConfigurationStore.getState();
    expect(state.vehicleSlug).toBe("apex-gt");
    for (const category of SINGLE_SELECT_CATEGORIES) {
      expect(state.singleSelections[category], category).toBe(`${category}-default`);
    }
    expect(state.multiSelections).toEqual({ ACCESSORY: [], PACKAGE: [] });
    expect(state.customPaintHex).toBeNull();
  });

  it("setSingleSelection updates only the given category", () => {
    useConfigurationStore.getState().hydrateDefaults(makeVehicle("apex-gt"));
    useConfigurationStore.getState().setSingleSelection("PAINT", "PAINT-alt");

    const state = useConfigurationStore.getState();
    expect(state.singleSelections.PAINT).toBe("PAINT-alt");
    expect(state.singleSelections.WHEELS).toBe("WHEELS-default");
  });

  it("clears customPaintHex whenever the PAINT selection changes", () => {
    useConfigurationStore.getState().hydrateDefaults(makeVehicle("apex-gt"));
    useConfigurationStore.getState().setCustomPaintHex("#ff0000");
    expect(useConfigurationStore.getState().customPaintHex).toBe("#ff0000");

    useConfigurationStore.getState().setSingleSelection("PAINT", "PAINT-alt");
    expect(useConfigurationStore.getState().customPaintHex).toBeNull();
  });

  it("does not clear customPaintHex when a different category changes", () => {
    useConfigurationStore.getState().hydrateDefaults(makeVehicle("apex-gt"));
    useConfigurationStore.getState().setCustomPaintHex("#ff0000");
    useConfigurationStore.getState().setSingleSelection("WHEELS", "WHEELS-alt");

    expect(useConfigurationStore.getState().customPaintHex).toBe("#ff0000");
  });

  it("toggleMultiSelection adds then removes an id", () => {
    useConfigurationStore.getState().hydrateDefaults(makeVehicle("apex-gt"));

    useConfigurationStore.getState().toggleMultiSelection("ACCESSORY", "acc-1");
    expect(useConfigurationStore.getState().multiSelections.ACCESSORY).toEqual(["acc-1"]);

    useConfigurationStore.getState().toggleMultiSelection("ACCESSORY", "acc-1");
    expect(useConfigurationStore.getState().multiSelections.ACCESSORY).toEqual([]);
  });

  it("toggleMultiSelection lets multiple different ids coexist in one category (Spec 8, AC-4)", () => {
    useConfigurationStore.getState().hydrateDefaults(makeVehicle("apex-gt"));

    useConfigurationStore.getState().toggleMultiSelection("ACCESSORY", "acc-1");
    useConfigurationStore.getState().toggleMultiSelection("ACCESSORY", "acc-2");
    useConfigurationStore.getState().toggleMultiSelection("ACCESSORY", "acc-3");

    expect(useConfigurationStore.getState().multiSelections.ACCESSORY).toEqual([
      "acc-1",
      "acc-2",
      "acc-3",
    ]);

    // Turning one off never touches the others (Spec 8, AC-4).
    useConfigurationStore.getState().toggleMultiSelection("ACCESSORY", "acc-2");
    expect(useConfigurationStore.getState().multiSelections.ACCESSORY).toEqual(["acc-1", "acc-3"]);
  });

  it("toggleMultiSelection keeps ACCESSORY and PACKAGE independent", () => {
    useConfigurationStore.getState().hydrateDefaults(makeVehicle("apex-gt"));

    useConfigurationStore.getState().toggleMultiSelection("ACCESSORY", "acc-1");
    useConfigurationStore.getState().toggleMultiSelection("PACKAGE", "pkg-1");

    const state = useConfigurationStore.getState();
    expect(state.multiSelections.ACCESSORY).toEqual(["acc-1"]);
    expect(state.multiSelections.PACKAGE).toEqual(["pkg-1"]);
  });

  it("reset reverts to the last-hydrated defaults", () => {
    useConfigurationStore.getState().hydrateDefaults(makeVehicle("apex-gt"));
    useConfigurationStore.getState().setSingleSelection("PAINT", "PAINT-alt");
    useConfigurationStore.getState().toggleMultiSelection("PACKAGE", "pkg-1");

    useConfigurationStore.getState().reset();

    const state = useConfigurationStore.getState();
    expect(state.singleSelections.PAINT).toBe("PAINT-default");
    expect(state.multiSelections.PACKAGE).toEqual([]);
    expect(state.customPaintHex).toBeNull();
  });

  it("re-hydrating for a different vehicle fully replaces the previous selections", () => {
    useConfigurationStore.getState().hydrateDefaults(makeVehicle("apex-gt"));
    useConfigurationStore.getState().setSingleSelection("PAINT", "PAINT-alt");

    useConfigurationStore.getState().hydrateDefaults(makeVehicle("apex-rs"));

    const state = useConfigurationStore.getState();
    expect(state.vehicleSlug).toBe("apex-rs");
    expect(state.singleSelections.PAINT).toBe("PAINT-default");
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AccessoriesPanel } from "../../src/components/configurator/AccessoriesPanel/AccessoriesPanel";
import { useConfigurationStore } from "../../src/state/configurationStore";
import type { CustomizationOptionDto, OptionCategory, VehicleDetailDto } from "../../src/types/catalog";

function makeOption(category: OptionCategory, id: string, name: string): CustomizationOptionDto {
  return {
    id,
    category,
    name,
    description: null,
    priceDeltaCents: 100000,
    assetRef: `${category}-${id}`.toLowerCase(),
    swatchColor: null,
    applyMode: "MATERIAL_SWAP",
    isDefault: false,
    sortOrder: 0,
  };
}

function makeVehicle(overrides: Partial<Record<OptionCategory, CustomizationOptionDto[]>> = {}): VehicleDetailDto {
  const empty = {} as Record<OptionCategory, CustomizationOptionDto[]>;
  for (const category of [
    "PAINT",
    "WHEELS",
    "BRAKE_CALIPER",
    "WINDOW_TINT",
    "SPOILER",
    "FRONT_ACCESSORY",
    "REAR_ACCESSORY",
    "BODY_PACKAGE",
    "CARBON_COMPONENT",
    "INTERIOR_MATERIAL",
    "INTERIOR_LIGHTING",
    "INTERIOR_SEATS",
    "INTERIOR_DASHBOARD",
    "INTERIOR_STEERING_WHEEL",
    "INTERIOR_DOOR_PANELS",
    "INTERIOR_FLOOR",
    "ACCESSORY",
    "PACKAGE",
  ] as OptionCategory[]) {
    empty[category] = [];
  }

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
    options: { ...empty, ...overrides },
  };
}

const vehicle = makeVehicle({
  ACCESSORY: [
    makeOption("ACCESSORY", "acc-1", "Carbon Mirror Caps"),
    makeOption("ACCESSORY", "acc-2", "Sport Exhaust"),
  ],
  PACKAGE: [makeOption("PACKAGE", "pkg-1", "Performance Package")],
});

describe("AccessoriesPanel", () => {
  beforeEach(() => {
    useConfigurationStore.getState().hydrateDefaults(vehicle);
  });

  it("renders both groups as toggles with name and price (AC-1)", () => {
    render(<AccessoriesPanel vehicle={vehicle} />);

    // "Accessories"/"Packages" each appear twice — once as the group title, once as the
    // (identical) category label — there's exactly one category per group in this spec.
    expect(screen.getAllByText("Accessories")).toHaveLength(2);
    expect(screen.getAllByText("Packages")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /Accessories: Carbon Mirror Caps, \+€1,000/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Packages: Performance Package, \+€1,000/ }),
    ).toBeInTheDocument();
  });

  it("starts with nothing active, since accessories have no default", () => {
    render(<AccessoriesPanel vehicle={vehicle} />);

    for (const button of screen.getAllByRole("button")) {
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });

  it("toggling one accessory never affects another (AC-4)", () => {
    render(<AccessoriesPanel vehicle={vehicle} />);

    const mirrorCaps = screen.getByRole("button", { name: /Carbon Mirror Caps/ });
    const exhaust = screen.getByRole("button", { name: /Sport Exhaust/ });

    fireEvent.click(mirrorCaps);

    expect(mirrorCaps).toHaveAttribute("aria-pressed", "true");
    expect(exhaust).toHaveAttribute("aria-pressed", "false");
    expect(useConfigurationStore.getState().multiSelections.ACCESSORY).toEqual(["acc-1"]);
  });

  it("allows multiple toggles active at once within the same group (unlike single-select panels)", () => {
    render(<AccessoriesPanel vehicle={vehicle} />);

    fireEvent.click(screen.getByRole("button", { name: /Carbon Mirror Caps/ }));
    fireEvent.click(screen.getByRole("button", { name: /Sport Exhaust/ }));

    expect(screen.getByRole("button", { name: /Carbon Mirror Caps/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Sport Exhaust/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("omits a group entirely when the vehicle has zero options for it", () => {
    const noPackages = makeVehicle({
      ACCESSORY: [makeOption("ACCESSORY", "acc-1", "Carbon Mirror Caps")],
      PACKAGE: [],
    });
    useConfigurationStore.getState().hydrateDefaults(noPackages);
    render(<AccessoriesPanel vehicle={noPackages} />);

    expect(screen.getAllByText("Accessories")).toHaveLength(2);
    expect(screen.queryByText("Packages")).not.toBeInTheDocument();
  });

  it("every toggle is a real, focusable button exposing aria-pressed (AC-7)", () => {
    render(<AccessoriesPanel vehicle={vehicle} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      expect(button).not.toHaveAttribute("tabindex", "-1");
      expect(button).toHaveAttribute("aria-pressed");
    }
  });
});

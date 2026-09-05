import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { InteriorPanel } from "../../src/components/configurator/InteriorPanel/InteriorPanel";
import { useConfigurationStore } from "../../src/state/configurationStore";
import type { CustomizationOptionDto, OptionCategory, VehicleDetailDto } from "../../src/types/catalog";

const INTERIOR_CATEGORIES: OptionCategory[] = [
  "INTERIOR_MATERIAL",
  "INTERIOR_LIGHTING",
  "INTERIOR_SEATS",
  "INTERIOR_DASHBOARD",
  "INTERIOR_STEERING_WHEEL",
  "INTERIOR_DOOR_PANELS",
  "INTERIOR_FLOOR",
];

const OTHER_CATEGORIES: OptionCategory[] = [
  "PAINT",
  "WHEELS",
  "BRAKE_CALIPER",
  "WINDOW_TINT",
  "SPOILER",
  "FRONT_ACCESSORY",
  "REAR_ACCESSORY",
  "BODY_PACKAGE",
  "CARBON_COMPONENT",
  "ACCESSORY",
  "PACKAGE",
];

function makeOption(category: OptionCategory, suffix: string, isDefault: boolean): CustomizationOptionDto {
  return {
    id: `${category}-${suffix}`,
    category,
    name: suffix === "default" ? "Black" : "Burgundy",
    description: null,
    priceDeltaCents: suffix === "default" ? 0 : 40000,
    assetRef: `${category}-${suffix}`.toLowerCase(),
    swatchColor: "#111111",
    applyMode: "MATERIAL_SWAP",
    isDefault,
    sortOrder: suffix === "default" ? 0 : 1,
  };
}

const vehicle: VehicleDetailDto = {
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
  options: Object.fromEntries(
    [...INTERIOR_CATEGORIES, ...OTHER_CATEGORIES].map((category) => [
      category,
      [makeOption(category, "default", true), makeOption(category, "alt", false)],
    ]),
  ) as Record<OptionCategory, CustomizationOptionDto[]>,
};

describe("InteriorPanel", () => {
  beforeEach(() => {
    useConfigurationStore.getState().hydrateDefaults(vehicle);
  });

  it("renders all seven interior categories grouped into two sections (AC-1)", () => {
    render(<InteriorPanel vehicle={vehicle} />);

    // "Overall Finish" is deliberately both the group title and the INTERIOR_MATERIAL
    // category label (matching the spec's own AC-1 wording and aria-label example), so
    // it appears twice — every other label appears exactly once.
    expect(screen.getAllByText("Overall Finish")).toHaveLength(2);
    expect(screen.getByText("Surface Colors")).toBeInTheDocument();

    for (const label of ["Interior Lighting", "Seats", "Dashboard", "Steering Wheel", "Door Panels", "Floor"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("does not render exterior or multi-select categories", () => {
    render(<InteriorPanel vehicle={vehicle} />);

    expect(screen.queryByText("Paint")).not.toBeInTheDocument();
    expect(screen.queryByText("Wheels")).not.toBeInTheDocument();
  });

  it("marks the currently selected option for each category (AC-1)", () => {
    render(<InteriorPanel vehicle={vehicle} />);

    const selected = screen.getByRole("button", { name: /Seats: Black/ });
    expect(selected).toHaveAttribute("aria-pressed", "true");

    const unselected = screen.getByRole("button", { name: /Seats: Burgundy/ });
    expect(unselected).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking a swatch updates the store and the visual selected state (AC-2/AC-3)", () => {
    render(<InteriorPanel vehicle={vehicle} />);

    const target = screen.getByRole("button", { name: /Seats: Burgundy/ });
    fireEvent.click(target);

    expect(useConfigurationStore.getState().singleSelections.INTERIOR_SEATS).toBe(
      "INTERIOR_SEATS-alt",
    );
    expect(target).toHaveAttribute("aria-pressed", "true");
  });

  it("recoloring one surface does not change another surface's selection", () => {
    render(<InteriorPanel vehicle={vehicle} />);

    fireEvent.click(screen.getByRole("button", { name: /Seats: Burgundy/ }));

    expect(useConfigurationStore.getState().singleSelections.INTERIOR_DASHBOARD).toBe(
      "INTERIOR_DASHBOARD-default",
    );
  });

  it("every swatch is a real, focusable button (AC-8)", () => {
    render(<InteriorPanel vehicle={vehicle} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      expect(button).not.toHaveAttribute("tabindex", "-1");
    }
  });
});

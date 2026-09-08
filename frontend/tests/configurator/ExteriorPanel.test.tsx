import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ExteriorPanel } from "../../src/components/configurator/ExteriorPanel/ExteriorPanel";
import { useConfigurationStore } from "../../src/state/configurationStore";
import type { CustomizationOptionDto, OptionCategory, VehicleDetailDto } from "../../src/types/catalog";

const EXTERIOR_CATEGORIES: OptionCategory[] = [
  "PAINT",
  "WHEELS",
  "BRAKE_CALIPER",
  "WINDOW_TINT",
  "SPOILER",
  "FRONT_ACCESSORY",
  "REAR_ACCESSORY",
  "BODY_PACKAGE",
  "CARBON_COMPONENT",
];

const OTHER_CATEGORIES: OptionCategory[] = [
  "INTERIOR_MATERIAL",
  "INTERIOR_LIGHTING",
  "INTERIOR_SEATS",
  "INTERIOR_DASHBOARD",
  "INTERIOR_STEERING_WHEEL",
  "INTERIOR_DOOR_PANELS",
  "INTERIOR_FLOOR",
  "ACCESSORY",
  "PACKAGE",
];

function makeOption(category: OptionCategory, suffix: string, isDefault: boolean): CustomizationOptionDto {
  return {
    id: `${category}-${suffix}`,
    category,
    name: suffix === "default" ? "Obsidian Black" : "Racing Red",
    description: null,
    priceDeltaCents: suffix === "default" ? 0 : 150000,
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
  fallbackImageUrl: "/fallback.jpg",
  heroModelUrl: "/hero.glb",
  showroomModelUrl: "/showroom.glb",
  options: Object.fromEntries(
    [...EXTERIOR_CATEGORIES, ...OTHER_CATEGORIES].map((category) => [
      category,
      [makeOption(category, "default", true), makeOption(category, "alt", false)],
    ]),
  ) as Record<OptionCategory, CustomizationOptionDto[]>,
};

describe("ExteriorPanel", () => {
  beforeEach(() => {
    useConfigurationStore.getState().hydrateDefaults(vehicle);
  });

  it("renders all nine exterior categories grouped into three sections (AC-1)", () => {
    render(<ExteriorPanel vehicle={vehicle} />);

    for (const title of ["Paint & Finish", "Wheels & Brakes", "Aero & Body"]) {
      expect(screen.getByText(title)).toBeInTheDocument();
    }

    for (const label of [
      "Paint",
      "Wheels",
      "Brake Calipers",
      "Window Tint",
      "Spoiler",
      "Front Accessory",
      "Rear Accessory",
      "Body Package",
      "Carbon Components",
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("does not render interior or multi-select categories", () => {
    render(<ExteriorPanel vehicle={vehicle} />);

    expect(screen.queryByText("Overall Finish")).not.toBeInTheDocument();
    expect(screen.queryByText("Seats")).not.toBeInTheDocument();
  });

  it("marks the currently selected option for each category (AC-1)", () => {
    render(<ExteriorPanel vehicle={vehicle} />);

    const selected = screen.getByRole("button", { name: /Paint: Obsidian Black/ });
    expect(selected).toHaveAttribute("aria-pressed", "true");

    const unselected = screen.getByRole("button", { name: /Paint: Racing Red/ });
    expect(unselected).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking a swatch updates the store and the visual selected state (AC-2)", () => {
    render(<ExteriorPanel vehicle={vehicle} />);

    const target = screen.getByRole("button", { name: /Paint: Racing Red/ });
    fireEvent.click(target);

    expect(useConfigurationStore.getState().singleSelections.PAINT).toBe("PAINT-alt");
    expect(target).toHaveAttribute("aria-pressed", "true");
  });

  it("every swatch is a real, focusable button (AC-11)", () => {
    render(<ExteriorPanel vehicle={vehicle} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      expect(button).not.toHaveAttribute("tabindex", "-1");
    }
  });

  it("shows the custom color picker only when Custom Color is the selected paint", () => {
    const vehicleWithCustom: VehicleDetailDto = {
      ...vehicle,
      options: {
        ...vehicle.options,
        PAINT: [
          makeOption("PAINT", "default", true),
          { ...makeOption("PAINT", "custom", false), name: "Custom Color", assetRef: "paint-custom", swatchColor: null },
        ],
      },
    };
    useConfigurationStore.getState().hydrateDefaults(vehicleWithCustom);
    const { rerender } = render(<ExteriorPanel vehicle={vehicleWithCustom} />);

    expect(screen.queryByLabelText("Custom paint color")).not.toBeInTheDocument();

    fireEvent.click(within(screen.getByText("Paint").closest("div")!).getByRole("button", { name: /Custom Color/ }));
    rerender(<ExteriorPanel vehicle={vehicleWithCustom} />);

    expect(screen.getByLabelText("Custom paint color")).toBeInTheDocument();
  });
});

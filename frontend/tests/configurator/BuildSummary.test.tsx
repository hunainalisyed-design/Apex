import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { BuildSummary } from "../../src/components/configurator/BuildSummary/BuildSummary";
import { formatPriceCents } from "../../src/lib/format/currency";
import { useConfigurationStore } from "../../src/state/configurationStore";
import { ALL_CATEGORIES } from "../../src/types/catalog";
import type { CustomizationOptionDto, OptionCategory, VehicleDetailDto } from "../../src/types/catalog";

function makeOption(
  category: OptionCategory,
  suffix: string,
  isDefault: boolean,
  priceDeltaCents = 0,
): CustomizationOptionDto {
  return {
    id: `${category}-${suffix}`,
    category,
    name: `${category} ${suffix}`,
    description: null,
    priceDeltaCents,
    assetRef: `${category}-${suffix}`.toLowerCase(),
    swatchColor: null,
    applyMode: "MATERIAL_SWAP",
    isDefault,
    sortOrder: 0,
  };
}

function makeVehicle(): VehicleDetailDto {
  const options = Object.fromEntries(
    ALL_CATEGORIES.map((category) => [
      category,
      [makeOption(category, "default", true), makeOption(category, "alt", false, 45000)],
    ]),
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

const vehicle = makeVehicle();

describe("BuildSummary", () => {
  it("renders nothing before the store has hydrated", () => {
    useConfigurationStore.setState({
      vehicleSlug: "",
      singleSelections: Object.fromEntries(ALL_CATEGORIES.map((c) => [c, ""])) as never,
      multiSelections: { ACCESSORY: [], PACKAGE: [] },
      customPaintHex: null,
    });

    const { container } = render(<BuildSummary vehicle={vehicle} />);
    expect(container).toBeEmptyDOMElement();
  });

  describe("once hydrated", () => {
    beforeEach(() => {
      useConfigurationStore.getState().hydrateDefaults(vehicle);
    });

    it("shows the vehicle name and the base price total at defaults", () => {
      render(<BuildSummary vehicle={vehicle} />);

      expect(screen.getByText("Apex GT")).toBeInTheDocument();
      const total = screen.getByTestId("build-summary-total");
      expect(total).toHaveTextContent(formatPriceCents(vehicle.basePriceCents, "EUR"));
    });

    it("shows 'Accessories: None' and 'Packages: None' at defaults (AC-4)", () => {
      render(<BuildSummary vehicle={vehicle} />);

      expect(screen.getByText("Accessories: None")).toBeInTheDocument();
      expect(screen.getByText("Packages: None")).toBeInTheDocument();
    });

    it("updates a line item and the total in the same render when the store changes (AC-6)", () => {
      render(<BuildSummary vehicle={vehicle} />);

      expect(screen.queryByText(/Brake Calipers/)).not.toBeInTheDocument();

      act(() => {
        useConfigurationStore.getState().setSingleSelection("BRAKE_CALIPER", "BRAKE_CALIPER-alt");
      });

      expect(screen.getByText("Brake Calipers: BRAKE_CALIPER alt")).toBeInTheDocument();
      const total = screen.getByTestId("build-summary-total");
      expect(total).toHaveTextContent(formatPriceCents(vehicle.basePriceCents + 45000, "EUR"));
    });

    it("toggling an accessory replaces the 'None' line with the active item (AC-5)", () => {
      render(<BuildSummary vehicle={vehicle} />);

      act(() => {
        useConfigurationStore.getState().toggleMultiSelection("ACCESSORY", "ACCESSORY-alt");
      });

      expect(screen.queryByText("Accessories: None")).not.toBeInTheDocument();
      expect(screen.getByText("Accessories: ACCESSORY alt")).toBeInTheDocument();
    });

    it("has exactly one aria-live region, scoped to the total only (AC-7)", () => {
      const { container } = render(<BuildSummary vehicle={vehicle} />);

      const liveRegions = container.querySelectorAll('[aria-live="polite"]');
      expect(liveRegions).toHaveLength(1);
      expect(liveRegions[0]).toBe(screen.getByTestId("build-summary-total"));
      expect(liveRegions[0].textContent).not.toMatch(/None/);
    });

    it("formats every price through Intl.NumberFormat, never a raw cents integer (AC-8)", () => {
      act(() => {
        useConfigurationStore.getState().setSingleSelection("SPOILER", "SPOILER-alt");
      });
      render(<BuildSummary vehicle={vehicle} />);

      expect(screen.getByText(`+${formatPriceCents(45000, "EUR")}`)).toBeInTheDocument();
      expect(screen.queryByText("45000")).not.toBeInTheDocument();
    });
  });
});

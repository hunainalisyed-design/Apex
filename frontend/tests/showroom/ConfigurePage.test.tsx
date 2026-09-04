import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ALL_CATEGORIES, type CustomizationOptionDto, type OptionCategory, type VehicleDetailDto } from "../../src/types/catalog";

const showroomSceneMock = vi.fn((_props: unknown) => <div data-testid="showroom-scene-mock" />);
vi.mock("../../src/components/showroom/ShowroomScene", () => ({
  ShowroomScene: (props: unknown) => showroomSceneMock(props),
}));

const { ConfigureShowroom } = await import("../../src/components/showroom/ConfigureShowroom");
const { default: VehicleNotFound } = await import("../../src/app/configure/[slug]/not-found");

function buildOption(category: OptionCategory): CustomizationOptionDto {
  return {
    id: `${category}-default`,
    category,
    name: `Standard ${category}`,
    description: null,
    priceDeltaCents: 0,
    assetRef: `${category}-default`,
    swatchColor: null,
    applyMode: "MATERIAL_SWAP",
    isDefault: true,
    sortOrder: 0,
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
  thumbnailUrl: "/models/apex-gt/thumbnail.jpg",
  heroModelUrl: "/models/apex-gt/hero.glb",
  showroomModelUrl: "/models/apex-gt/showroom.glb",
  options: Object.fromEntries(
    ALL_CATEGORIES.map((category) => [category, [buildOption(category)]]),
  ) as Record<OptionCategory, CustomizationOptionDto[]>,
};

describe("ConfigureShowroom", () => {
  it("shows the loading placeholder before the 3D scene resolves, then swaps it in", async () => {
    showroomSceneMock.mockImplementation(() => <div data-testid="showroom-scene-mock" />);
    render(<ConfigureShowroom vehicle={vehicle} />);

    expect(screen.getByText(/Initializing Showroom/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("showroom-scene-mock")).toBeInTheDocument());
  });

  it("shows the vehicle name/spec sheet immediately, independent of the 3D scene", () => {
    showroomSceneMock.mockImplementation(() => <div data-testid="showroom-scene-mock" />);
    render(<ConfigureShowroom vehicle={vehicle} />);

    expect(screen.getByRole("heading", { name: "Apex GT" })).toBeInTheDocument();
    expect(screen.getByText(/€85,000/)).toBeInTheDocument();
  });

  it("hides camera/lighting controls but keeps the spec sheet visible when the scene errors", async () => {
    showroomSceneMock.mockImplementation(() => {
      throw new Error("WebGL unavailable");
    });

    render(<ConfigureShowroom vehicle={vehicle} />);

    await waitFor(() => expect(screen.getByText(/3D preview unavailable/i)).toBeInTheDocument());
    expect(screen.queryByRole("group", { name: "Camera presets" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Apex GT" })).toBeInTheDocument();
  });
});

describe("VehicleNotFound (invalid slug, per spec §5 error state)", () => {
  it("shows the not-in-our-lineup message with a link back to /models", () => {
    render(<VehicleNotFound />);

    expect(screen.getByText(/isn't in our lineup/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to models/i })).toHaveAttribute(
      "href",
      "/models",
    );
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Static3DFallback } from "../../src/components/shell/Static3DFallback";
import type { VehicleSummaryDto } from "../../src/types/catalog";

// The image is decorative (alt=""), so it carries the ARIA "presentation" role rather than
// "img" — the vehicle name is announced via the adjacent heading instead.

const vehicle: VehicleSummaryDto = {
  slug: "apex-gt",
  name: "Apex GT",
  tagline: "Performance sports car.",
  basePriceCents: 8_500_000,
  currency: "EUR",
  horsepower: 650,
  topSpeedKph: 330,
  zeroToHundredSec: 2.9,
  thumbnailUrl: "/models/apex-gt/thumbnail.jpg",
  fallbackImageUrl: "/models/apex-gt/fallback.jpg",
  heroModelUrl: "",
  showroomModelUrl: "",
};

describe("Static3DFallback", () => {
  it("shows the vehicle's fallback image, name, and spec sheet (Spec 12 AC-1)", () => {
    render(<Static3DFallback vehicle={vehicle} />);

    expect(screen.getByText(/3D preview unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Apex GT" })).toBeInTheDocument();
    expect(document.querySelector("img")).toHaveAttribute("src", vehicle.fallbackImageUrl);
    expect(screen.getByText("650 hp")).toBeInTheDocument();
    expect(screen.getByText("330 km/h")).toBeInTheDocument();
    expect(screen.getByText("2.9s")).toBeInTheDocument();
  });
});

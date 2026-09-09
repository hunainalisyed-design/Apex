import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildShowcaseStages } from "../../src/components/landing/ScrollShowcase/showcaseStages";

const sceneMock = vi.fn((_props: unknown) => <div data-testid="scroll-showcase-scene-mock" />);
vi.mock("../../src/components/landing/ScrollShowcase/ScrollShowcaseScene", () => ({
  ScrollShowcaseScene: (props: unknown) => sceneMock(props),
}));

const useIsDesktopViewportMock = vi.fn(() => true);
vi.mock("@/hooks/useIsDesktopViewport", () => ({
  useIsDesktopViewport: () => useIsDesktopViewportMock(),
}));

const useReducedMotionMock = vi.fn(() => false);
vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => useReducedMotionMock(),
}));

const { ScrollShowcase } = await import("../../src/components/landing/ScrollShowcase/ScrollShowcase");
const { ScrollShowcaseClient } = await import("../../src/components/landing/ScrollShowcase/ScrollShowcaseClient");

const vehicle = {
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
};

describe("ScrollShowcaseClient (Spec 13, AC-8 through AC-12)", () => {
  beforeEach(() => {
    sceneMock.mockClear();
    useIsDesktopViewportMock.mockReturnValue(true);
    useReducedMotionMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the live scroll-driven scene on a desktop viewport with motion allowed", async () => {
    render(<ScrollShowcaseClient vehicle={vehicle} />);

    await waitFor(() => expect(screen.getByTestId("scroll-showcase-scene-mock")).toBeInTheDocument());
  });

  it("renders the static fallback instead of the live scene under prefers-reduced-motion (AC-10)", () => {
    useReducedMotionMock.mockReturnValue(true);
    render(<ScrollShowcaseClient vehicle={vehicle} />);

    expect(screen.queryByTestId("scroll-showcase-scene-mock")).not.toBeInTheDocument();
    for (const stage of buildShowcaseStages(vehicle.name)) {
      expect(screen.getByText(stage.caption)).toBeInTheDocument();
    }
  });

  it("renders the static fallback instead of the live scene below the lg viewport, even with motion allowed (AC-12)", () => {
    useIsDesktopViewportMock.mockReturnValue(false);
    render(<ScrollShowcaseClient vehicle={vehicle} />);

    expect(screen.queryByTestId("scroll-showcase-scene-mock")).not.toBeInTheDocument();
    for (const stage of buildShowcaseStages(vehicle.name)) {
      expect(screen.getByText(stage.caption)).toBeInTheDocument();
    }
  });

  it("the static fallback's CTA links into the configurator (AC-11)", () => {
    useReducedMotionMock.mockReturnValue(true);
    render(<ScrollShowcaseClient vehicle={vehicle} />);

    expect(screen.getByRole("link", { name: "Configure Your Car" })).toHaveAttribute(
      "href",
      "/configure/apex-gt",
    );
  });
});

describe("ScrollShowcase (ssr:false wrapper)", () => {
  beforeEach(() => {
    sceneMock.mockClear();
    useIsDesktopViewportMock.mockReturnValue(true);
    useReducedMotionMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("eventually renders ScrollShowcaseClient's content through its dynamic import", async () => {
    render(<ScrollShowcase vehicle={vehicle} />);

    await waitFor(() => expect(screen.getByTestId("scroll-showcase-scene-mock")).toBeInTheDocument());
  });
});

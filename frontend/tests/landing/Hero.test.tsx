import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const heroSceneMock = vi.fn((_props: unknown) => <div data-testid="hero-scene-mock" />);
vi.mock("../../src/components/landing/HeroScene", () => ({
  HeroScene: (props: unknown) => heroSceneMock(props),
}));

const useReducedMotionMock = vi.fn(() => false);
vi.mock("@/hooks/useReducedMotion", () => ({
  useReducedMotion: () => useReducedMotionMock(),
}));

const { Hero } = await import("../../src/components/landing/Hero");

const vehicle = {
  slug: "apex-gt",
  name: "Apex GT",
  tagline: "Performance sports car.",
  basePriceCents: 8500000,
  currency: "EUR",
  horsepower: 650,
  topSpeedKph: 330,
  zeroToHundredSec: 2.9,
  thumbnailUrl: "/models/apex-gt/thumbnail.jpg",
  fallbackImageUrl: "/models/apex-gt/fallback.jpg",
  heroModelUrl: "",
  showroomModelUrl: "",
};

describe("Hero", () => {
  beforeEach(() => {
    heroSceneMock.mockClear();
    heroSceneMock.mockImplementation(() => <div data-testid="hero-scene-mock" />);
    useReducedMotionMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows the shared loading screen (not a spinner) before the 3D scene loads, then swaps it in", async () => {
    render(<Hero vehicle={vehicle} />);

    // The dynamic import hasn't resolved on the first synchronous render pass.
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByTestId("hero-scene-mock")).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByTestId("hero-scene-mock")).toBeInTheDocument());
  });

  it("headline and CTAs are present and interactive immediately, independent of the 3D scene (AC-4)", () => {
    render(<Hero vehicle={vehicle} />);

    expect(screen.getByText("BUILD YOUR VISION.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configure Your Car" })).toHaveAttribute(
      "href",
      "/configure/apex-gt",
    );
    expect(screen.getByRole("link", { name: "Explore Models" })).toHaveAttribute(
      "href",
      "/models",
    );
  });

  it("renders the final state directly under prefers-reduced-motion, skipping the staged reveal (AC-3)", () => {
    useReducedMotionMock.mockReturnValue(true);
    render(<Hero vehicle={vehicle} />);

    expect(screen.getByRole("main")).toHaveAttribute("data-hero-stage", "idle");
  });

  it("renders the static fallback instead of crashing when the 3D scene fails (AC-5)", async () => {
    heroSceneMock.mockImplementation(() => {
      throw new Error("WebGL unavailable");
    });

    render(<Hero vehicle={vehicle} />);

    await waitFor(() => expect(screen.getByText(/3D preview unavailable/i)).toBeInTheDocument());
    expect(screen.queryByTestId("hero-scene-mock")).not.toBeInTheDocument();
    // The rest of the page must stay usable even though the 3D scene errored.
    expect(screen.getByRole("link", { name: "Configure Your Car" })).toBeInTheDocument();
  });
});

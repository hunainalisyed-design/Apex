import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "../src/app/page";

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
}

describe("shell layout", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "ok" }) }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the base shell without throwing", async () => {
    mockMatchMedia(false);
    render(<Home />);

    expect(screen.getByText("BUILD YOUR VISION.")).toBeInTheDocument();
    expect(screen.getByTestId("system-status")).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByTestId("system-status")).not.toHaveAttribute("data-state", "checking"),
    );
  });

  it("reflects backend connectivity once the health check resolves", async () => {
    mockMatchMedia(false);
    render(<Home />);

    await waitFor(() =>
      expect(screen.getByTestId("system-status")).toHaveAttribute("data-state", "connected"),
    );
  });

  it("respects prefers-reduced-motion by skipping the pulse animation", async () => {
    mockMatchMedia(true);
    render(<Home />);

    await waitFor(() =>
      expect(screen.getByTestId("system-status")).not.toHaveAttribute("data-state", "checking"),
    );

    const dot = screen.getByTestId("system-status").querySelector("span");
    expect(dot).not.toHaveClass("animate-pulse");
  });
});

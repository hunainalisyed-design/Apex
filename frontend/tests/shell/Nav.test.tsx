import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const pathnameMock = vi.fn(() => "/");
vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

const getDefaultVehicleSlugMock = vi.fn();
vi.mock("../../src/lib/api/vehicles", () => ({
  getDefaultVehicleSlug: () => getDefaultVehicleSlugMock(),
}));

const { Nav } = await import("../../src/components/shell/Nav/Nav");
const { NavClient } = await import("../../src/components/shell/Nav/NavClient");

describe("NavClient (Spec 13, AC-1 through AC-7)", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/");
  });

  it("shows working links to Home, Models, Configurator, About, and Compare (AC-1; Spec 18 AC-7)", () => {
    render(<NavClient configureHref="/configure/apex-gt" />);

    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Models" })).toHaveAttribute("href", "/models");
    expect(screen.getAllByRole("link", { name: "Configurator" })[0]).toHaveAttribute(
      "href",
      "/configure/apex-gt",
    );
    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(screen.getAllByRole("link", { name: "Compare" })[0]).toHaveAttribute("href", "/compare");
  });

  it("marks Compare active when on /compare, even with query params (Spec 18, AC-7)", () => {
    pathnameMock.mockReturnValue("/compare");
    render(<NavClient configureHref="/configure/apex-gt" />);

    expect(screen.getAllByRole("link", { name: "Compare" })[0]).toHaveAttribute("aria-current", "page");
  });

  it("the hamburger toggle opens and closes the mobile menu, and is a real reachable button (AC-3, AC-5)", async () => {
    render(<NavClient configureHref="/configure/apex-gt" />);

    const toggle = screen.getByRole("button", { name: "Open menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("dialog", { name: "Site menu" })).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByRole("dialog", { name: "Site menu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close menu" })).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("button", { name: "Close menu" }));
    // AnimatePresence keeps the panel mounted through its exit transition, so absence is
    // asserted asynchronously rather than immediately after the click.
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Site menu" })).not.toBeInTheDocument());
  });

  it("Escape closes the mobile menu and returns focus to the toggle (AC-5)", async () => {
    render(<NavClient configureHref="/configure/apex-gt" />);

    const toggle = screen.getByRole("button", { name: "Open menu" });
    fireEvent.click(toggle);
    expect(screen.getByRole("dialog", { name: "Site menu" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Site menu" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Open menu" })).toHaveFocus();
  });

  it("marks the active route's nav item with aria-current=page (AC-7)", () => {
    pathnameMock.mockReturnValue("/models");
    render(<NavClient configureHref="/configure/apex-gt" />);

    expect(screen.getByRole("link", { name: "Models" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("aria-current matches the Configurator link for any vehicle slug's route, not just the default (AC-7)", () => {
    pathnameMock.mockReturnValue("/configure/apex-rs");
    render(<NavClient configureHref="/configure/apex-gt" />);

    expect(screen.getAllByRole("link", { name: "Configurator" })[0]).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("renders arbitrary content passed as the right-side extension slot (AC-4)", () => {
    render(<NavClient configureHref="/configure/apex-gt" rightSlot={<button type="button">Sign in</button>} />);

    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});

describe("Nav (server wrapper, Spec 13, AC-1)", () => {
  it("resolves the Configurator link to the default vehicle's slug", async () => {
    getDefaultVehicleSlugMock.mockResolvedValueOnce("apex-gt");

    render(await Nav());

    expect(screen.getAllByRole("link", { name: "Configurator" })[0]).toHaveAttribute(
      "href",
      "/configure/apex-gt",
    );
  });

  it("falls back to /models when no default vehicle could be resolved", async () => {
    getDefaultVehicleSlugMock.mockResolvedValueOnce(null);

    render(await Nav());

    expect(screen.getAllByRole("link", { name: "Configurator" })[0]).toHaveAttribute("href", "/models");
  });
});

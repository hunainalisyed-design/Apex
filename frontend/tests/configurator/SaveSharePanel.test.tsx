import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_CATEGORIES } from "../../src/types/catalog";
import type { CustomizationOptionDto, OptionCategory, VehicleDetailDto } from "../../src/types/catalog";

const saveConfigurationMock = vi.fn();

class MockApiRequestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

vi.mock("../../src/lib/api/configurations", () => ({
  saveConfiguration: (...args: unknown[]) => saveConfigurationMock(...args),
  ApiRequestError: MockApiRequestError,
}));

const { SaveSharePanel } = await import("../../src/components/configurator/SaveSharePanel/SaveSharePanel");
const { useConfigurationStore } = await import("../../src/state/configurationStore");

function makeOption(category: OptionCategory, suffix: string, isDefault: boolean): CustomizationOptionDto {
  return {
    id: `${category}-${suffix}`,
    category,
    name: `${category} ${suffix}`,
    description: null,
    priceDeltaCents: 0,
    assetRef: `${category}-${suffix}`.toLowerCase(),
    swatchColor: null,
    applyMode: "MATERIAL_SWAP",
    isDefault,
    sortOrder: 0,
  };
}

function makeVehicle(): VehicleDetailDto {
  const options = Object.fromEntries(
    ALL_CATEGORIES.map((category) => [category, [makeOption(category, "default", true), makeOption(category, "alt", false)]]),
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
    heroModelUrl: "/hero.glb",
    showroomModelUrl: "/showroom.glb",
    options,
  };
}

const vehicle = makeVehicle();

const mockSavedResponse = {
  publicId: "APEX-7F82-K91X",
  vehicleSlug: "apex-gt",
  singleSelections: {},
  multiSelections: { ACCESSORY: [], PACKAGE: [] },
  customPaintHex: null,
  breakdown: { vehicleSlug: "apex-gt", basePriceCents: 8_500_000, lineItems: [], totalPriceCents: 9_999_900, currency: "EUR" },
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("SaveSharePanel", () => {
  beforeEach(() => {
    saveConfigurationMock.mockReset();
    useConfigurationStore.getState().hydrateDefaults(vehicle);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
    });
  });

  it("shows only Save (and Reset) at idle — no publicId, error, or copy actions", () => {
    render(<SaveSharePanel vehicle={vehicle} />);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.queryByTestId("saved-public-id")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy Configuration ID" })).not.toBeInTheDocument();
  });

  it("disables Save and shows a saving state while the request is in flight", async () => {
    let resolveSave!: (value: typeof mockSavedResponse) => void;
    saveConfigurationMock.mockReturnValue(new Promise((resolve) => (resolveSave = resolve)));

    render(<SaveSharePanel vehicle={vehicle} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled());

    await act(async () => {
      resolveSave(mockSavedResponse);
    });
  });

  it("on success, shows the publicId, Copy/Share actions, and the server response's total, not the local estimate (AC-9)", async () => {
    saveConfigurationMock.mockResolvedValueOnce(mockSavedResponse);

    render(<SaveSharePanel vehicle={vehicle} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByTestId("saved-public-id")).toHaveTextContent("APEX-7F82-K91X"));
    expect(screen.getByRole("button", { name: "Copy Configuration ID" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toBeInTheDocument();
    // 9,999,900 cents ($99,999) — deliberately different from the store's live default
    // total ($85,000) to prove this reads the server response, not a local recalculation.
    expect(screen.getByText(/99,999/)).toBeInTheDocument();
  });

  it("on failure (AC-10), shows an inline error and leaves store selections exactly as they were", async () => {
    saveConfigurationMock.mockRejectedValueOnce(new MockApiRequestError("VALIDATION_ERROR", "Something went wrong."));
    const before = useConfigurationStore.getState().singleSelections;

    render(<SaveSharePanel vehicle={vehicle} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(screen.getByText("Something went wrong.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(useConfigurationStore.getState().singleSelections).toEqual(before);
  });

  it("Copy Configuration ID writes exactly the raw publicId and shows a toast (AC-6)", async () => {
    saveConfigurationMock.mockResolvedValueOnce(mockSavedResponse);
    render(<SaveSharePanel vehicle={vehicle} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByTestId("saved-public-id")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Copy Configuration ID" }));

    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith("APEX-7F82-K91X"));
    expect(await screen.findByRole("status")).toHaveTextContent(/copied/i);
  });

  it("Share writes the full shareable URL, a distinct payload from Copy ID (AC-7)", async () => {
    saveConfigurationMock.mockResolvedValueOnce(mockSavedResponse);
    render(<SaveSharePanel vehicle={vehicle} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(screen.getByTestId("saved-public-id")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Share" }));

    await waitFor(() =>
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining("/configure/apex-gt?build=APEX-7F82-K91X"),
      ),
    );
  });

  it("Reset reverts to vehicle defaults and never calls save (AC-8)", () => {
    useConfigurationStore.getState().setSingleSelection("BRAKE_CALIPER", "BRAKE_CALIPER-alt");
    render(<SaveSharePanel vehicle={vehicle} />);

    fireEvent.click(screen.getByRole("button", { name: "Reset configuration" }));

    expect(useConfigurationStore.getState().singleSelections.BRAKE_CALIPER).toBe("BRAKE_CALIPER-default");
    expect(saveConfigurationMock).not.toHaveBeenCalled();
  });
});

import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_CATEGORIES } from "../../src/types/catalog";
import type { CustomizationOptionDto, OptionCategory, VehicleDetailDto } from "../../src/types/catalog";
import type { SavedConfigurationDto } from "../../src/types/configuration";

const getMyConfigurationsMock = vi.fn();
vi.mock("../../src/lib/api/me", () => ({
  getMyConfigurations: () => getMyConfigurationsMock(),
  updateProfile: vi.fn(),
  changePassword: vi.fn(),
}));

const getVehicleDetailMock = vi.fn();
vi.mock("../../src/lib/api/vehicles", () => ({
  getVehicles: vi.fn(),
  getDefaultVehicleSlug: vi.fn(),
  getVehicleDetail: (...args: unknown[]) => getVehicleDetailMock(...args),
}));

class MockApiRequestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

const deleteConfigurationMock = vi.fn();
vi.mock("../../src/lib/api/configurations", () => ({
  ApiRequestError: MockApiRequestError,
  saveConfiguration: vi.fn(),
  fetchConfiguration: vi.fn(),
  claimConfiguration: vi.fn(),
  deleteConfiguration: (...args: unknown[]) => deleteConfigurationMock(...args),
}));

const { GarageList } = await import("../../src/components/garage/GarageList/GarageList");
const { useGarageStore } = await import("../../src/state/garageStore");

function makeVehicle(slug = "apex-gt"): VehicleDetailDto {
  const options = Object.fromEntries(ALL_CATEGORIES.map((category) => [category, []])) as unknown as Record<
    OptionCategory,
    CustomizationOptionDto[]
  >;

  return {
    slug,
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

function makeConfiguration(overrides: Partial<SavedConfigurationDto> = {}): SavedConfigurationDto {
  return {
    publicId: "APEX-AAAA-BBBB",
    vehicleSlug: "apex-gt",
    singleSelections: {} as SavedConfigurationDto["singleSelections"],
    multiSelections: { ACCESSORY: [], PACKAGE: [] },
    customPaintHex: null,
    breakdown: {
      vehicleSlug: "apex-gt",
      basePriceCents: 8_500_000,
      lineItems: [],
      totalPriceCents: 8_500_000,
      currency: "EUR",
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    ownerId: "user-1",
    ...overrides,
  };
}

const RESET_STATE = {
  status: "idle" as const,
  configurations: [],
  vehiclesBySlug: {},
  error: null,
  deletingPublicIds: {},
  deleteErrors: {},
};

describe("GarageList (Spec 17)", () => {
  beforeEach(() => {
    getMyConfigurationsMock.mockReset();
    getVehicleDetailMock.mockReset();
    deleteConfigurationMock.mockReset();
    useGarageStore.setState(RESET_STATE);
  });

  it("shows a loading skeleton while the list is being fetched", () => {
    getMyConfigurationsMock.mockReturnValueOnce(new Promise(() => {})); // never resolves
    render(<GarageList />);
    expect(screen.getByTestId("garage-skeleton")).toBeInTheDocument();
  });

  it("shows the empty state with a CTA into the configurator (AC-11)", async () => {
    getMyConfigurationsMock.mockResolvedValueOnce([]);
    render(<GarageList />);

    await waitFor(() => expect(screen.getByText("You haven't saved any builds yet.")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Start Configuring" })).toHaveAttribute("href", "/models");
  });

  it("shows an inline error with Retry on a failed fetch, and Retry re-attempts the load", async () => {
    getMyConfigurationsMock.mockRejectedValueOnce(new MockApiRequestError("VALIDATION_ERROR", "raw"));
    render(<GarageList />);

    const retry = await screen.findByRole("button", { name: "Retry" });
    expect(getMyConfigurationsMock).toHaveBeenCalledTimes(1);

    getMyConfigurationsMock.mockResolvedValueOnce([]);
    fireEvent.click(retry);

    await waitFor(() => expect(screen.getByText("You haven't saved any builds yet.")).toBeInTheDocument());
    expect(getMyConfigurationsMock).toHaveBeenCalledTimes(2);
  });

  it("renders a card with the vehicle's name once its detail loads (AC-2)", async () => {
    getMyConfigurationsMock.mockResolvedValueOnce([makeConfiguration()]);
    getVehicleDetailMock.mockResolvedValueOnce(makeVehicle());
    render(<GarageList />);

    expect(await screen.findByText("Apex GT")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Load" })).toHaveAttribute(
      "href",
      "/configure/apex-gt?build=APEX-AAAA-BBBB",
    );
  });

  it("never renders a placeholder section for quote requests or the gallery (AC-10)", async () => {
    getMyConfigurationsMock.mockResolvedValueOnce([makeConfiguration()]);
    getVehicleDetailMock.mockResolvedValueOnce(makeVehicle());
    render(<GarageList />);

    await screen.findByText("Apex GT");
    expect(screen.queryByText(/quote request/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/gallery/i)).not.toBeInTheDocument();
  });

  it("Delete requires confirmation before removing the row (AC-5), and Cancel leaves it untouched", async () => {
    getMyConfigurationsMock.mockResolvedValueOnce([makeConfiguration()]);
    getVehicleDetailMock.mockResolvedValueOnce(makeVehicle());
    render(<GarageList />);
    await screen.findByText("Apex GT");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Apex GT")).toBeInTheDocument();
    expect(deleteConfigurationMock).not.toHaveBeenCalled();
  });

  it("Escape closes the delete confirmation dialog (keyboard-operable, AC-12)", async () => {
    getMyConfigurationsMock.mockResolvedValueOnce([makeConfiguration()]);
    getVehicleDetailMock.mockResolvedValueOnce(makeVehicle());
    render(<GarageList />);
    await screen.findByText("Apex GT");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("confirming delete removes the row only after the server confirms (AC-5)", async () => {
    getMyConfigurationsMock.mockResolvedValueOnce([makeConfiguration()]);
    getVehicleDetailMock.mockResolvedValueOnce(makeVehicle());
    deleteConfigurationMock.mockResolvedValueOnce(undefined);
    render(<GarageList />);
    await screen.findByText("Apex GT");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.queryByText("Apex GT")).not.toBeInTheDocument());
    expect(deleteConfigurationMock).toHaveBeenCalledWith("APEX-AAAA-BBBB");
  });

  it("a failed delete shows an inline error and does NOT remove the row (§5)", async () => {
    getMyConfigurationsMock.mockResolvedValueOnce([makeConfiguration()]);
    getVehicleDetailMock.mockResolvedValueOnce(makeVehicle());
    deleteConfigurationMock.mockRejectedValueOnce(new MockApiRequestError("CONFIGURATION_NOT_FOUND", "raw"));
    render(<GarageList />);
    await screen.findByText("Apex GT");

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(screen.getByText("This build could not be found.")).toBeInTheDocument());
    expect(screen.getByText("Apex GT")).toBeInTheDocument();
  });
});

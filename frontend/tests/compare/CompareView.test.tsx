import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_CATEGORIES } from "../../src/types/catalog";
import type { CustomizationOptionDto, OptionCategory, VehicleDetailDto, VehicleSummaryDto } from "../../src/types/catalog";

const routerReplaceMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: routerReplaceMock }),
}));

const useReducedMotionMock = vi.fn(() => false);
vi.mock("../../src/hooks/useReducedMotion", () => ({
  useReducedMotion: () => useReducedMotionMock(),
}));

const getVehiclesMock = vi.fn();
const getVehicleDetailMock = vi.fn();
vi.mock("../../src/lib/api/vehicles", () => ({
  getVehicles: () => getVehiclesMock(),
  getVehicleDetail: (slug: string) => getVehicleDetailMock(slug),
  getDefaultVehicleSlug: vi.fn(),
}));

const compareSceneMock = vi.fn((_props: unknown) => <div data-testid="compare-scene-mock" />);
vi.mock("../../src/components/compare/CompareScene", () => ({
  CompareScene: (props: unknown) => compareSceneMock(props),
}));

const { CompareView } = await import("../../src/components/compare/CompareView");
const { useCompareStore } = await import("../../src/state/compareStore");

function makeVehicle(slug: string, name: string): VehicleSummaryDto {
  return {
    slug,
    name,
    tagline: `${name} tagline`,
    basePriceCents: 8500000,
    currency: "EUR",
    horsepower: 650,
    topSpeedKph: 330,
    zeroToHundredSec: 2.9,
    thumbnailUrl: "",
    fallbackImageUrl: "",
  };
}

function makeVehicleDetail(slug: string, name: string): VehicleDetailDto {
  const options = Object.fromEntries(ALL_CATEGORIES.map((c): [OptionCategory, CustomizationOptionDto[]] => [c, []])) as Record<
    OptionCategory,
    CustomizationOptionDto[]
  >;
  return { ...makeVehicle(slug, name), heroModelUrl: "", showroomModelUrl: "", options };
}

const GT = makeVehicle("apex-gt", "Apex GT");
const RS = makeVehicle("apex-rs", "Apex RS");
const SPYDER = makeVehicle("apex-spyder", "Apex Spyder");

const INITIAL_STORE_STATE = {
  status: "loading" as const,
  vehicles: [],
  leftSlug: "",
  rightSlug: "",
  view: "table" as const,
  threeDUnavailable: false,
  leftAppearance: null,
  rightAppearance: null,
  detailsLoading: false,
};

describe("CompareView (Spec 18)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReducedMotionMock.mockReturnValue(false);
    useCompareStore.setState(INITIAL_STORE_STATE);
    compareSceneMock.mockImplementation(() => <div data-testid="compare-scene-mock" />);
    getVehiclesMock.mockResolvedValue([GT, RS, SPYDER]);
    getVehicleDetailMock.mockImplementation(async (slug: string) => {
      const vehicle = [GT, RS, SPYDER].find((v) => v.slug === slug);
      return vehicle ? makeVehicleDetail(vehicle.slug, vehicle.name) : null;
    });
  });

  it("shows a loading skeleton while the vehicle list resolves", () => {
    getVehiclesMock.mockReturnValue(new Promise(() => {})); // never resolves
    render(<CompareView />);
    expect(screen.getByTestId("compare-skeleton")).toBeInTheDocument();
  });

  it("shows an error state with retry when fewer than 2 vehicles are available", async () => {
    getVehiclesMock.mockResolvedValueOnce([GT]);
    render(<CompareView />);

    await waitFor(() => expect(screen.getByText(/unable to load vehicles/i)).toBeInTheDocument());

    getVehiclesMock.mockResolvedValueOnce([GT, RS, SPYDER]);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByRole("columnheader", { name: "Apex GT" })).toBeInTheDocument());
  });

  it("defaults to the first two vehicles and renders their spec values in the table (AC-1, AC-2)", async () => {
    render(<CompareView />);

    await waitFor(() => expect(screen.getByRole("columnheader", { name: "Apex GT" })).toBeInTheDocument());
    expect(screen.getByRole("columnheader", { name: "Apex RS" })).toBeInTheDocument();
    expect(screen.getAllByText("650 hp")).toHaveLength(2);
  });

  it("excludes the other side's selection from each selector's own options (AC-4)", async () => {
    render(<CompareView />);
    await waitFor(() => expect(screen.getByLabelText("Vehicle 1")).toBeInTheDocument());

    const leftSelect = screen.getByLabelText("Vehicle 1") as HTMLSelectElement;
    const rightSelect = screen.getByLabelText("Vehicle 2") as HTMLSelectElement;

    // Left is Apex GT, right is Apex RS by default — neither selector offers the value
    // already chosen on the other side.
    expect(Array.from(leftSelect.options).map((o) => o.value)).not.toContain("apex-rs");
    expect(Array.from(rightSelect.options).map((o) => o.value)).not.toContain("apex-gt");
  });

  it("a real selector change updates the URL via router.replace, without a full reload (AC-3)", async () => {
    render(<CompareView />);
    await waitFor(() => expect(screen.getByLabelText("Vehicle 1")).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Vehicle 1"), { target: { value: "apex-spyder" } });

    expect(routerReplaceMock).toHaveBeenCalledWith("/compare?left=apex-spyder&right=apex-rs", { scroll: false });
  });

  it("toggling 3D View fetches each vehicle's detail and renders the shared scene, threading reducedMotion through (AC-5, AC-8)", async () => {
    useReducedMotionMock.mockReturnValue(true);
    render(<CompareView />);
    await waitFor(() => expect(screen.getByRole("columnheader", { name: "Apex GT" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("tab", { name: "3D View" }));

    await waitFor(() => expect(screen.getByTestId("compare-scene-mock")).toBeInTheDocument());
    expect(getVehicleDetailMock).toHaveBeenCalledWith("apex-gt");
    expect(getVehicleDetailMock).toHaveBeenCalledWith("apex-rs");
    expect(compareSceneMock).toHaveBeenLastCalledWith(expect.objectContaining({ reducedMotion: true }));
  });

  it("falls back to the table and disables the toggle when the 3D scene fails (AC-6)", async () => {
    compareSceneMock.mockImplementation(() => {
      throw new Error("WebGL unavailable");
    });

    render(<CompareView />);
    await waitFor(() => expect(screen.getByRole("columnheader", { name: "Apex GT" })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("tab", { name: "3D View" }));

    await waitFor(() => expect(screen.getByRole("tab", { name: "3D View" })).toBeDisabled());
    // Reverted to the table — its content is visible again, the failed scene isn't.
    expect(screen.getByRole("columnheader", { name: "Apex GT" })).toBeInTheDocument();
    expect(screen.queryByTestId("compare-scene-mock")).not.toBeInTheDocument();
  });
});

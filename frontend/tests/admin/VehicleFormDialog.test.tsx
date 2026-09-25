import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiRequestError } from "../../src/lib/api/configurations";
import { saveErrorBanner } from "../../src/lib/admin/saveErrorBanner";
import type { VehicleAdminDto } from "../../src/types/admin";

const updateVehicle = vi.fn();
vi.mock("../../src/lib/api/admin", () => ({
  createVehicle: vi.fn(),
  listVehicles: vi.fn(),
  updateVehicle: (...args: unknown[]) => updateVehicle(...args),
}));

const { VehicleFormDialog } = await import("../../src/components/admin/VehicleFormDialog");
const { useAdminVehiclesStore } = await import("../../src/state/adminVehiclesStore");

const vehicle: VehicleAdminDto = {
  id: "veh_1",
  slug: "porsche-992-gt3-r",
  name: "Porsche 992 GT3 R",
  tagline: "GT3 racing homologation car.",
  basePriceCents: 45_000_000,
  currency: "EUR",
  horsepower: 510,
  topSpeedKph: 296,
  zeroToHundredSec: 3.2,
  thumbnailUrl: "/models/porsche-992-gt3-r/thumbnail.311a7f95.jpg",
  fallbackImageUrl: "/models/porsche-992-gt3-r/fallback.jpg",
  heroModelUrl: "/assets/models/porsche-992-gt3-r.93062210.glb",
  showroomModelUrl: "/assets/models/porsche-992-gt3-r.93062210.glb",
  isActive: true,
};

const UNVERSIONED_MESSAGE = "showroomModelUrl must be a versioned asset URL (e.g. /assets/models/name.a1b2c3d4.glb).";

describe("VehicleFormDialog save errors (Spec 25)", () => {
  beforeEach(() => {
    updateVehicle.mockReset();
    useAdminVehiclesStore.setState({ saveError: null, saveErrorDetails: null, isSaving: false, vehicles: [vehicle] });
  });

  it("shows an unversioned-URL rejection inline on the offending field", async () => {
    updateVehicle.mockRejectedValue(
      new ApiRequestError("VALIDATION_ERROR", "Asset URLs must be versioned.", { showroomModelUrl: [UNVERSIONED_MESSAGE] }),
    );
    render(<VehicleFormDialog vehicle={vehicle} onClose={() => {}} />);

    const field = screen.getByLabelText("Showroom model URL");
    fireEvent.change(field, { target: { value: "/assets/models/porsche-v2.glb" } });
    fireEvent.submit(field.closest("form")!);

    await waitFor(() => expect(screen.getByText(UNVERSIONED_MESSAGE)).toBeInTheDocument());
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Fix the highlighted fields below.");
  });
});

describe("saveErrorBanner", () => {
  it("falls back to the code-based message when there are no field details", () => {
    expect(saveErrorBanner("Something went wrong.", null, ["assetRef"])).toBe("Something went wrong.");
  });

  it("points at inline fields instead of repeating their messages", () => {
    expect(saveErrorBanner("x", { assetRef: ["bad"] }, ["assetRef"])).toBe("Fix the highlighted fields below.");
  });

  it("surfaces details for fields with no inline slot rather than dropping them", () => {
    expect(saveErrorBanner("x", { isDefault: ["Would leave two defaults."], assetRef: ["bad"] }, ["assetRef"])).toBe(
      "Would leave two defaults.",
    );
  });
});

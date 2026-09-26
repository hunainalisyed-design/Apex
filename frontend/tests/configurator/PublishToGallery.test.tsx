import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VehicleDetailDto } from "../../src/types/catalog";
import type { SavedConfigurationDto } from "../../src/types/configuration";

class MockApiRequestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

const saveConfigurationMock = vi.fn();
const claimConfigurationMock = vi.fn();
vi.mock("../../src/lib/api/configurations", () => ({
  ApiRequestError: MockApiRequestError,
  saveConfiguration: (...args: unknown[]) => saveConfigurationMock(...args),
  claimConfiguration: (...args: unknown[]) => claimConfigurationMock(...args),
  fetchConfiguration: vi.fn(),
  deleteConfiguration: vi.fn(),
}));

const publishBuildMock = vi.fn();
const unpublishBuildMock = vi.fn();
vi.mock("../../src/lib/api/gallery", () => ({
  publishBuild: (...args: unknown[]) => publishBuildMock(...args),
  unpublishBuild: (...args: unknown[]) => unpublishBuildMock(...args),
}));

// The capture itself (camera move, WebGL frame, overlay compositing) is Spec 11's, covered there.
const captureBuildImageMock = vi.fn();
vi.mock("../../src/components/showroom/useCaptureBuild", () => ({
  captureBuildImage: (...args: unknown[]) => captureBuildImageMock(...args),
}));

const { PublishToGallery } = await import("../../src/components/configurator/PublishToGallery/PublishToGallery");
const { ToastProvider } = await import("../../src/components/shell/ToastProvider");
const { useAuthStore } = await import("../../src/state/authStore");
const { useConfigurationStore } = await import("../../src/state/configurationStore");

const vehicle = { slug: "apex-gt", name: "Apex GT", currency: "EUR", options: {} } as unknown as VehicleDetailDto;
const controlsRef = { current: {} as never };
const USER = { id: "user-1", name: "Ada", email: "ada@example.com", role: "USER" as const, createdAt: "2026-01-01T00:00:00.000Z" };
const PNG = new Blob(["png"], { type: "image/png" });

function makeSaved(overrides: Partial<SavedConfigurationDto> = {}): SavedConfigurationDto {
  return {
    publicId: "APEX-AAAA-BBBB",
    vehicleSlug: "apex-gt",
    singleSelections: {} as SavedConfigurationDto["singleSelections"],
    multiSelections: { ACCESSORY: [], PACKAGE: [] },
    customPaintHex: null,
    environmentId: null,
    breakdown: { vehicleSlug: "apex-gt", basePriceCents: 1, lineItems: [], totalPriceCents: 1, currency: "EUR" },
    createdAt: "2026-01-01T00:00:00.000Z",
    ownerId: "user-1",
    isPublished: false,
    publishedAt: null,
    ...overrides,
  };
}

/** Loads `saved` as the current, unchanged (not dirty) build. */
function loadBuild(saved: SavedConfigurationDto | null) {
  useConfigurationStore.setState({
    vehicleSlug: "apex-gt",
    savedConfiguration: saved,
    singleSelections: saved?.singleSelections ?? ({} as SavedConfigurationDto["singleSelections"]),
    multiSelections: saved?.multiSelections ?? { ACCESSORY: [], PACKAGE: [] },
    customPaintHex: saved?.customPaintHex ?? null,
    environmentId: saved?.environmentId ?? null,
    saveStatus: saved ? "success" : "idle",
  });
}

function renderPublish(sceneReady = true) {
  return render(
    <ToastProvider>
      <PublishToGallery vehicle={vehicle} showroomControlsRef={controlsRef} currentPreset="default" sceneReady={sceneReady} />
    </ToastProvider>,
  );
}

describe("PublishToGallery (Spec 31)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: USER, hydrated: true });
    loadBuild(makeSaved());
    captureBuildImageMock.mockResolvedValue({ blob: PNG, publicId: "APEX-AAAA-BBBB" });
    publishBuildMock.mockResolvedValue({ publicId: "APEX-AAAA-BBBB", isPublished: true, publishedAt: "2026-09-26T10:00:00.000Z" });
    unpublishBuildMock.mockResolvedValue({ publicId: "APEX-AAAA-BBBB", isPublished: false, publishedAt: null });
  });

  it("renders nothing for a guest — publishing needs an account (AC-1)", () => {
    useAuthStore.setState({ user: null, hydrated: true });
    renderPublish();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing for someone else's unchanged build", () => {
    loadBuild(makeSaved({ ownerId: "someone-else" }));
    renderPublish();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("waits for the scene before it can publish", () => {
    renderPublish(false);
    expect(screen.getByRole("button", { name: "Publish to Gallery" })).toBeDisabled();
  });

  it("captures the build and uploads it, then shows the published state (AC-1)", async () => {
    renderPublish();
    fireEvent.click(screen.getByRole("button", { name: "Publish to Gallery" }));

    expect(await screen.findByText("Published")).toBeInTheDocument();
    expect(captureBuildImageMock).toHaveBeenCalledWith(vehicle, controlsRef.current, "default");
    expect(publishBuildMock).toHaveBeenCalledWith("APEX-AAAA-BBBB", PNG);
    expect(saveConfigurationMock).not.toHaveBeenCalled();
    expect(claimConfigurationMock).not.toHaveBeenCalled();
    expect(useConfigurationStore.getState().savedConfiguration?.isPublished).toBe(true);
    expect(screen.getByRole("link", { name: "View Gallery" })).toHaveAttribute("href", "/gallery");
    expect(screen.getByText("Published to the gallery")).toBeInTheDocument();
  });

  it("claims a guest build first — only owners can publish", async () => {
    loadBuild(makeSaved({ ownerId: null }));
    claimConfigurationMock.mockResolvedValue(makeSaved({ ownerId: "user-1" }));
    renderPublish();
    fireEvent.click(screen.getByRole("button", { name: "Publish to Gallery" }));

    await screen.findByText("Published");
    expect(claimConfigurationMock).toHaveBeenCalledWith("APEX-AAAA-BBBB");
    expect(claimConfigurationMock.mock.invocationCallOrder[0]).toBeLessThan(publishBuildMock.mock.invocationCallOrder[0]);
  });

  it("saves unsaved changes first, then publishes that new build", async () => {
    loadBuild(null);
    const fresh = makeSaved({ publicId: "APEX-NEW1-NEW1" });
    saveConfigurationMock.mockResolvedValue(fresh);
    captureBuildImageMock.mockResolvedValue({ blob: PNG, publicId: "APEX-NEW1-NEW1" });
    publishBuildMock.mockResolvedValue({ publicId: "APEX-NEW1-NEW1", isPublished: true, publishedAt: "2026-09-26T10:00:00.000Z" });
    renderPublish();
    fireEvent.click(screen.getByRole("button", { name: "Publish to Gallery" }));

    await screen.findByText("Published");
    expect(saveConfigurationMock).toHaveBeenCalledOnce();
    expect(publishBuildMock).toHaveBeenCalledWith("APEX-NEW1-NEW1", PNG);
  });

  it("shows the error and stays unpublished when the upload fails", async () => {
    publishBuildMock.mockRejectedValue(new MockApiRequestError("RATE_LIMITED", "slow down"));
    renderPublish();
    fireEvent.click(screen.getByRole("button", { name: "Publish to Gallery" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
    expect(screen.getByRole("button", { name: "Publish to Gallery" })).toBeEnabled();
    expect(useConfigurationStore.getState().savedConfiguration?.isPublished).toBe(false);
  });

  it("a double click publishes once", async () => {
    renderPublish();
    const button = screen.getByRole("button", { name: "Publish to Gallery" });
    fireEvent.click(button);
    fireEvent.click(button);

    await screen.findByText("Published");
    expect(publishBuildMock).toHaveBeenCalledOnce();
  });

  it("unpublishes a published build (AC-6)", async () => {
    loadBuild(makeSaved({ isPublished: true, publishedAt: "2026-09-20T10:00:00.000Z" }));
    renderPublish();
    fireEvent.click(screen.getByRole("button", { name: "Unpublish" }));

    expect(await screen.findByRole("button", { name: "Publish to Gallery" })).toBeInTheDocument();
    expect(unpublishBuildMock).toHaveBeenCalledWith("APEX-AAAA-BBBB");
    expect(useConfigurationStore.getState().savedConfiguration?.isPublished).toBe(false);
  });

  it("offers Publish again once the published build is changed (a new save would be published)", async () => {
    loadBuild(makeSaved({ isPublished: true, publishedAt: "2026-09-20T10:00:00.000Z" }));
    renderPublish();
    expect(screen.getByText("Published")).toBeInTheDocument();

    useConfigurationStore.setState({ customPaintHex: "#123456" });
    await waitFor(() => expect(screen.getByRole("button", { name: "Publish to Gallery" })).toBeInTheDocument());
  });
});

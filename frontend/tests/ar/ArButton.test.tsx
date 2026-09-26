import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Group } from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShowroomControls } from "../../src/components/showroom/ShowroomScene";
import type { VehicleDetailDto } from "../../src/types/catalog";

const detectCurrentArPlatform = vi.fn();
const exportArModel = vi.fn();
const openQuickLook = vi.fn();
const openSceneViewer = vi.fn();
const uploadArModel = vi.fn();

vi.mock("../../src/lib/ar/capability", () => ({ detectCurrentArPlatform: () => detectCurrentArPlatform() }));
vi.mock("../../src/lib/ar/exportModel", () => ({ exportArModel: (...a: unknown[]) => exportArModel(...a) }));
vi.mock("../../src/lib/ar/launch", () => ({
  openQuickLook: (...a: unknown[]) => openQuickLook(...a),
  openSceneViewer: (...a: unknown[]) => openSceneViewer(...a),
}));
vi.mock("../../src/lib/api/ar", () => ({ uploadArModel: (...a: unknown[]) => uploadArModel(...a) }));
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

const { ArButton } = await import("../../src/components/ar/ArButton");

const porsche = { slug: "porsche-992-gt3-r", name: "Porsche 992 GT3 R" } as VehicleDetailDto;
const apexGt = { slug: "apex-gt", name: "Apex GT" } as VehicleDetailDto;
const vehicleObject = new Group();
const GLB_FILE = { bytes: new Uint8Array([1, 2, 3]), mimeType: "model/gltf-binary" };

function controlsRef(object: Group | null = vehicleObject) {
  return { current: { getVehicleObject: () => object } as unknown as ShowroomControls };
}

describe("ArButton (Spec 27)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    URL.createObjectURL = vi.fn(() => "blob:usdz");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.unstubAllEnvs());

  it("isn't rendered on a device without a native AR viewer (AC-1)", () => {
    detectCurrentArPlatform.mockReturnValue(null);
    const { container } = render(<ArButton vehicle={porsche} showroomControlsRef={controlsRef()} sceneReady />);
    expect(container).toBeEmptyDOMElement();
  });

  it("isn't rendered for a placeholder-rig vehicle, even on an AR device", () => {
    detectCurrentArPlatform.mockReturnValue("ios");
    const { container } = render(<ArButton vehicle={apexGt} showroomControlsRef={controlsRef()} sceneReady />);
    expect(container).toBeEmptyDOMElement();
  });

  it("isn't rendered when NEXT_PUBLIC_AR_ENABLED=false", async () => {
    vi.stubEnv("NEXT_PUBLIC_AR_ENABLED", "false");
    vi.resetModules();
    const { ArButton: FlaggedOff } = await import("../../src/components/ar/ArButton");
    detectCurrentArPlatform.mockReturnValue("ios");
    const { container } = render(<FlaggedOff vehicle={porsche} showroomControlsRef={controlsRef()} sceneReady />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is disabled until the 3D scene is ready", () => {
    detectCurrentArPlatform.mockReturnValue("ios");
    render(<ArButton vehicle={porsche} showroomControlsRef={controlsRef()} sceneReady={false} />);
    expect(screen.getByRole("button", { name: "View in Your Driveway" })).toBeDisabled();
  });

  it("on iOS, exports a USDZ at real size and opens Quick Look on it (AC-2, AC-3, AC-4)", async () => {
    detectCurrentArPlatform.mockReturnValue("ios");
    exportArModel.mockResolvedValue({ bytes: new Uint8Array([9]), mimeType: "model/vnd.usdz+zip" });
    render(<ArButton vehicle={porsche} showroomControlsRef={controlsRef()} sceneReady />);

    fireEvent.click(screen.getByRole("button", { name: "View in Your Driveway" }));

    await waitFor(() => expect(openQuickLook).toHaveBeenCalledWith("blob:usdz"));
    expect(exportArModel).toHaveBeenCalledWith(vehicleObject, "ios", { lengthMeters: 4.62, usdzTriangleRatio: 0.35 });
    expect(uploadArModel).not.toHaveBeenCalled();
  });

  it("on Android, uploads the GLB and opens Scene Viewer on the hosted URL (AC-3)", async () => {
    detectCurrentArPlatform.mockReturnValue("android");
    exportArModel.mockResolvedValue(GLB_FILE);
    uploadArModel.mockResolvedValue({ url: "https://api.example.com/api/ar/models/x.glb", expiresAt: "2026-09-26T00:10:00Z" });
    render(<ArButton vehicle={porsche} showroomControlsRef={controlsRef()} sceneReady />);

    fireEvent.click(screen.getByRole("button", { name: "View in Your Driveway" }));

    await waitFor(() => expect(openSceneViewer).toHaveBeenCalledWith("https://api.example.com/api/ar/models/x.glb", "Porsche 992 GT3 R"));
    expect(uploadArModel).toHaveBeenCalledWith(GLB_FILE.bytes);
    expect(openQuickLook).not.toHaveBeenCalled();
  });

  it("shows the preparing state while exporting (AC-5)", async () => {
    detectCurrentArPlatform.mockReturnValue("ios");
    let finish!: (value: unknown) => void;
    exportArModel.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    render(<ArButton vehicle={porsche} showroomControlsRef={controlsRef()} sceneReady />);

    fireEvent.click(screen.getByRole("button", { name: "View in Your Driveway" }));

    const busy = await screen.findByRole("button", { name: "Preparing AR…" });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
    finish({ bytes: new Uint8Array([1]), mimeType: "model/vnd.usdz+zip" });
    await screen.findByRole("button", { name: "View in Your Driveway" });
  });

  it("shows a clear error and stays usable when export fails (AC-5)", async () => {
    detectCurrentArPlatform.mockReturnValue("android");
    exportArModel.mockRejectedValue(new Error("export blew up"));
    render(<ArButton vehicle={porsche} showroomControlsRef={controlsRef()} sceneReady />);

    fireEvent.click(screen.getByRole("button", { name: "View in Your Driveway" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("AR preview unavailable right now.");
    expect(screen.getByRole("button", { name: "View in Your Driveway" })).toBeEnabled();
    expect(openSceneViewer).not.toHaveBeenCalled();
  });

  it("shows the error state when the model hasn't loaded yet", async () => {
    detectCurrentArPlatform.mockReturnValue("ios");
    render(<ArButton vehicle={porsche} showroomControlsRef={controlsRef(null)} sceneReady />);

    fireEvent.click(screen.getByRole("button", { name: "View in Your Driveway" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(exportArModel).not.toHaveBeenCalled();
  });
});

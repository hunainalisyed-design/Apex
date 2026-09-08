import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VehicleDetailDto } from "../../src/types/catalog";

const useCaptureBuildMock = vi.fn();

vi.mock("../../src/components/showroom/useCaptureBuild", () => ({
  useCaptureBuild: (...args: unknown[]) => useCaptureBuildMock(...args),
}));

const { CaptureBuild } = await import("../../src/components/configurator/CaptureBuild/CaptureBuild");
const { ToastProvider } = await import("../../src/components/shell/ToastProvider");

const vehicle: VehicleDetailDto = {
  slug: "apex-gt",
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
  options: {} as VehicleDetailDto["options"],
};

const showroomControlsRef = { current: null };

interface MockCaptureState {
  status: "idle" | "saving" | "capturing" | "success" | "error";
  compositedImage: Blob | null;
  publicId: string | null;
  filename: string | null;
  error: string | null;
  capture: ReturnType<typeof vi.fn>;
  dismiss: ReturnType<typeof vi.fn>;
}

function renderCaptureBuild(overrides: Partial<MockCaptureState> = {}, sceneReady = true) {
  useCaptureBuildMock.mockReturnValue({
    status: "idle",
    compositedImage: null,
    publicId: null,
    filename: null,
    error: null,
    capture: vi.fn(),
    dismiss: vi.fn(),
    ...overrides,
  });
  return render(
    <ToastProvider>
      <CaptureBuild
        vehicle={vehicle}
        showroomControlsRef={showroomControlsRef}
        currentPreset="default"
        sceneReady={sceneReady}
      />
    </ToastProvider>,
  );
}

describe("CaptureBuild", () => {
  beforeEach(() => {
    useCaptureBuildMock.mockReset();
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  it("idle: renders only the Capture Build button, no modal", () => {
    renderCaptureBuild();

    expect(screen.getByRole("button", { name: "Capture Build" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables the button until the scene is ready", () => {
    renderCaptureBuild({}, false);

    expect(screen.getByRole("button", { name: "Capture Build" })).toBeDisabled();
  });

  it("saving/capturing shows loading copy and disables the button (AC-8)", () => {
    renderCaptureBuild({ status: "capturing" });

    expect(screen.getByRole("button", { name: "Capturing your build…" })).toBeDisabled();
  });

  it("clicking the button calls capture() (AC-9, operable via click/Enter/Space like any button)", () => {
    const capture = vi.fn();
    renderCaptureBuild({ capture });

    fireEvent.click(screen.getByRole("button", { name: "Capture Build" }));

    expect(capture).toHaveBeenCalledOnce();
  });

  it("error shows the AC-7 message", () => {
    renderCaptureBuild({ status: "error", error: "Unable to capture image, please try again." });

    expect(screen.getByText("Unable to capture image, please try again.")).toBeInTheDocument();
  });

  it("success renders the modal with the image and both action buttons", () => {
    renderCaptureBuild({
      status: "success",
      compositedImage: new Blob(["fake"], { type: "image/png" }),
      publicId: "APEX-7F82-K91X",
      filename: "apex-gt-APEX-7F82-K91X.png",
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(within(dialog).getByRole("img", { name: /Apex GT build capture/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save Image" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Copy Share Link" })).toBeInTheDocument();
  });

  it("Escape calls dismiss while the modal is open", () => {
    const dismiss = vi.fn();
    renderCaptureBuild({
      status: "success",
      compositedImage: new Blob(["fake"], { type: "image/png" }),
      publicId: "APEX-7F82-K91X",
      filename: "x.png",
      dismiss,
    });

    fireEvent.keyDown(document, { key: "Escape" });

    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("Tab wraps focus from the last to the first focusable element within the modal", () => {
    renderCaptureBuild({
      status: "success",
      compositedImage: new Blob(["fake"], { type: "image/png" }),
      publicId: "APEX-7F82-K91X",
      filename: "x.png",
    });

    const dialog = screen.getByRole("dialog");
    const buttons = within(dialog).getAllByRole("button");
    buttons[buttons.length - 1].focus();

    fireEvent.keyDown(document, { key: "Tab" });

    expect(document.activeElement).toBe(buttons[0]);
  });
});

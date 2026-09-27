import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect, useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DriveOptions, ShowroomControls } from "../../src/components/showroom/ShowroomScene";
import { ALL_CATEGORIES, type CustomizationOptionDto, type OptionCategory, type VehicleDetailDto } from "../../src/types/catalog";

const reducedMotion = { value: false };
vi.mock("../../src/hooks/useReducedMotion", () => ({ useReducedMotion: () => reducedMotion.value }));
vi.mock("../../src/lib/api/comboRarity", () => ({ getComboRarity: () => Promise.resolve(null) }));

/** A stand-in for the 3D scene's drive control: records the options, counts stops. */
const scene = { options: null as DriveOptions | null, stops: 0 };
const startDrive = vi.fn((options: DriveOptions) => {
  scene.options = options;
  return { stop: () => (scene.stops += 1) };
});
const fakeControls = { startDrive } as unknown as ShowroomControls;

const showroomSceneMock = vi.fn((props: { onReady: (c: ShowroomControls) => void; onEnvironmentReady?: () => void }) => {
  useEffect(() => {
    props.onReady(fakeControls);
  }, [props]);
  return <div data-testid="showroom-scene-mock" />;
});
vi.mock("../../src/components/showroom/ShowroomScene", () => ({ ShowroomScene: (props: never) => showroomSceneMock(props) }));

const { useDriveIt, DRIVE_FADE_MS, DRIVE_ENVIRONMENT_TIMEOUT_MS } = await import("../../src/components/showroom/DriveItMode/useDriveIt");
const { DriveItButton, DriveItOverlay } = await import("../../src/components/showroom/DriveItMode/DriveItMode");
const { ConfigureShowroom } = await import("../../src/components/showroom/ConfigureShowroom");
const { ToastProvider } = await import("../../src/components/shell/ToastProvider");

const env = { ready: () => {}, error: () => {} };

function Harness({ hasDriveEnvironment }: { hasDriveEnvironment: boolean }) {
  const controlsRef = useRef<ShowroomControls | null>(fakeControls);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const drive = useDriveIt({ controlsRef, hasDriveEnvironment, returnFocusTo: buttonRef });
  useEffect(() => {
    env.ready = drive.onEnvironmentReady;
    env.error = drive.onEnvironmentError;
  }, [drive.onEnvironmentReady, drive.onEnvironmentError]);
  return (
    <div>
      <DriveItButton ref={buttonRef} onStart={drive.start} disabled={drive.active} />
      <span data-testid="state">{drive.state}</span>
      <span data-testid="drive-env">{String(drive.useDriveEnvironment)}</span>
      <input aria-label="Some text field" />
      <DriveItOverlay drive={drive} />
    </div>
  );
}

const state = () => screen.getByTestId("state").textContent;
const input = () => scene.options!.input.current;

async function passFade() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(DRIVE_FADE_MS);
  });
}

async function startDriving(hasDriveEnvironment = true) {
  render(<Harness hasDriveEnvironment={hasDriveEnvironment} />);
  fireEvent.click(screen.getByRole("button", { name: /Drive It/ }));
  await passFade();
  if (hasDriveEnvironment) act(() => env.ready());
}

describe("Drive It — the mode (Spec 37)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    scene.options = null;
    scene.stops = 0;
    startDrive.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("fades out, switches to the drive's scene, waits for it, then drives (AC-1)", async () => {
    render(<Harness hasDriveEnvironment />);
    fireEvent.click(screen.getByRole("button", { name: /Drive It/ }));
    expect(state()).toBe("entering");
    expect(screen.getByTestId("drive-fade").style.opacity).toBe("1");
    expect(screen.getByRole("status")).toHaveTextContent("Getting ready…");

    await passFade();
    expect(screen.getByTestId("drive-env")).toHaveTextContent("true");
    expect(startDrive).not.toHaveBeenCalled(); // still loading the scene

    act(() => env.ready());
    expect(state()).toBe("driving");
    expect(startDrive).toHaveBeenCalledOnce();
    expect(screen.getByTestId("drive-fade").style.opacity).toBe("0");
    expect(screen.getByTestId("drive-steering")).toHaveFocus();
  });

  it("drives straight away when there's no scene to swap", async () => {
    await startDriving(false);
    expect(state()).toBe("driving");
    expect(screen.getByTestId("drive-env")).toHaveTextContent("false");
  });

  it("if the scene fails to load, drives in the current one; if it's slow, starts anyway", async () => {
    render(<Harness hasDriveEnvironment />);
    fireEvent.click(screen.getByRole("button", { name: /Drive It/ }));
    await passFade();
    act(() => env.error());
    expect(state()).toBe("driving");
    expect(screen.getByTestId("drive-env")).toHaveTextContent("false");
  });

  it("if the scene is too slow, starts anyway in the current scene (never over an unloaded one)", async () => {
    render(<Harness hasDriveEnvironment />);
    fireEvent.click(screen.getByRole("button", { name: /Drive It/ }));
    await passFade();
    expect(screen.getByTestId("drive-env")).toHaveTextContent("true");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRIVE_ENVIRONMENT_TIMEOUT_MS);
    });
    expect(state()).toBe("driving");
    expect(screen.getByTestId("drive-env")).toHaveTextContent("false");
    act(() => env.ready()); // the scene finishing late changes nothing
    expect(startDrive).toHaveBeenCalledOnce();
  });

  it("arrow keys and A/D steer; letting go centres (AC-2)", async () => {
    await startDriving();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(input()).toBe(-1);
    fireEvent.keyUp(window, { key: "ArrowLeft" });
    expect(input()).toBe(0);
    fireEvent.keyDown(window, { key: "d" });
    expect(input()).toBe(1);
    fireEvent.keyDown(window, { key: "a" });
    expect(input()).toBe(0); // both held cancel out
    fireEvent.keyUp(window, { key: "d" });
    expect(input()).toBe(-1);
  });

  it("typing in a text field never steers", async () => {
    await startDriving();
    fireEvent.keyDown(screen.getByLabelText("Some text field"), { key: "a" });
    expect(input()).toBe(0);
  });

  it("hold-to-steer buttons work for touch (AC-7)", async () => {
    await startDriving();
    const right = screen.getByRole("button", { name: "Steer right" });
    fireEvent.pointerDown(right, { pointerId: 1 });
    expect(input()).toBe(1);
    fireEvent.pointerUp(right, { pointerId: 1 });
    expect(input()).toBe(0);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Steer left" }), { pointerId: 2 });
    expect(input()).toBe(-1);
  });

  it("shows progress and the steering position", async () => {
    await startDriving();
    act(() => scene.options!.onUpdate(0.25, -0.5));
    expect(screen.getByRole("progressbar", { name: "Drive progress" })).toHaveAttribute("aria-valuenow", "25");
    const steering = screen.getByRole("slider", { name: "Steering" });
    expect(steering).toHaveAttribute("aria-valuenow", "-50");
    expect(steering).toHaveAttribute("aria-valuetext", "Left of the road line");
  });

  it("Exit leaves at once: fades, puts everything back, returns focus (AC-5)", async () => {
    await startDriving();
    fireEvent.click(screen.getByRole("button", { name: "Exit" }));
    expect(state()).toBe("leaving");
    expect(screen.getByTestId("drive-fade").style.opacity).toBe("1");
    await passFade();
    expect(state()).toBe("idle");
    expect(scene.stops).toBe(1);
    expect(screen.queryByTestId("drive-hud")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Drive It/ })).toHaveFocus();
  });

  it("Escape leaves too", async () => {
    await startDriving();
    fireEvent.keyDown(window, { key: "Escape" });
    await passFade();
    expect(state()).toBe("idle");
    expect(scene.stops).toBe(1);
  });

  it("ends by itself when the path is complete (AC-4)", async () => {
    await startDriving();
    act(() => scene.options!.onComplete());
    await passFade();
    expect(state()).toBe("idle");
    expect(scene.stops).toBe(1);
  });

  it("can be left while it's still getting ready — and never starts afterwards", async () => {
    render(<Harness hasDriveEnvironment />);
    fireEvent.click(screen.getByRole("button", { name: /Drive It/ }));
    await passFade();
    fireEvent.keyDown(window, { key: "Escape" });
    await passFade();
    act(() => env.ready()); // the scene finishing late must not start a drive
    expect(state()).toBe("idle");
    expect(startDrive).not.toHaveBeenCalled();
  });
});

describe("Drive It in the configurator", () => {
  function buildOption(category: OptionCategory): CustomizationOptionDto {
    return { id: `${category}-d`, category, name: `Standard ${category}`, description: null, priceDeltaCents: 0, assetRef: `${category}-d`, swatchColor: null, applyMode: "MATERIAL_SWAP", isDefault: true, sortOrder: 0 };
  }
  const vehicle = {
    slug: "apex-gt",
    name: "Apex GT",
    tagline: "t",
    basePriceCents: 1,
    currency: "EUR",
    horsepower: 1,
    topSpeedKph: 1,
    zeroToHundredSec: 1,
    thumbnailUrl: "/t.jpg",
    fallbackImageUrl: "/f.jpg",
    heroModelUrl: "/h.glb",
    showroomModelUrl: "/s.glb",
    options: Object.fromEntries(ALL_CATEGORIES.map((c) => [c, [buildOption(c)]])),
  } as unknown as VehicleDetailDto;

  function renderShowroom() {
    return render(
      <ToastProvider>
        <ConfigureShowroom vehicle={vehicle} />
      </ToastProvider>,
    );
  }

  beforeEach(() => {
    reducedMotion.value = false;
    startDrive.mockClear();
  });
  afterEach(() => vi.useRealTimers());

  it("is offered once the scene is ready", async () => {
    renderShowroom();
    const button = await screen.findByRole("button", { name: /Drive It/ });
    await waitFor(() => expect(button).toBeEnabled());
  });

  it("is not offered at all with reduced motion (AC-6)", async () => {
    reducedMotion.value = true;
    renderShowroom();
    await screen.findByTestId("showroom-scene-mock");
    expect(screen.queryByRole("button", { name: /Drive It/ })).not.toBeInTheDocument();
  });

  it("while driving, the camera presets and captures are locked", async () => {
    renderShowroom();
    const button = await screen.findByRole("button", { name: /Drive It/ });
    await waitFor(() => expect(button).toBeEnabled());
    vi.useFakeTimers();
    fireEvent.click(button);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(DRIVE_FADE_MS);
    });
    expect(startDrive).toHaveBeenCalled(); // no environments here → nothing to wait for
    expect(screen.getByRole("group", { name: "Camera presets" }).querySelector("button")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Capture Build" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Drive It/ })).toBeDisabled();
  });
});

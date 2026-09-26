import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ShowroomControls } from "../../src/components/showroom/ShowroomScene";
import { ALL_CATEGORIES, SINGLE_SELECT_CATEGORIES, type CustomizationOptionDto, type OptionCategory, type VehicleDetailDto } from "../../src/types/catalog";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn(), captureMessage: vi.fn() }));
// jsdom has no 2D canvas, so the image composer (covered by Spec 11's tests) is stubbed.
vi.mock("../../src/lib/showroom/composeCaptureImage", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  composeCaptureImage: vi.fn(async () => new Blob(["png"], { type: "image/png" })),
}));

const { CaptureVideo, RecordingOverlay } = await import("../../src/components/configurator/CaptureVideo/CaptureVideo");
const { ToastProvider } = await import("../../src/components/shell/ToastProvider");
const { useConfigurationStore } = await import("../../src/state/configurationStore");

const vehicle: VehicleDetailDto = {
  slug: "apex-gt",
  name: "Apex GT",
  tagline: "Test vehicle.",
  basePriceCents: 8_500_000,
  currency: "EUR",
  horsepower: 450,
  topSpeedKph: 280,
  zeroToHundredSec: 4.2,
  thumbnailUrl: "",
  fallbackImageUrl: "",
  heroModelUrl: "/hero.aaaaaaaa.glb",
  showroomModelUrl: "/showroom.aaaaaaaa.glb",
  options: Object.fromEntries(
    ALL_CATEGORIES.map((category: OptionCategory) => [
      category,
      [
        {
          id: `${category}-default`,
          category,
          name: `Standard ${category}`,
          description: null,
          priceDeltaCents: 0,
          assetRef: `${category}-default`,
          swatchColor: null,
          applyMode: "MATERIAL_SWAP",
          isDefault: true,
          sortOrder: 0,
        } satisfies CustomizationOptionDto,
      ],
    ]),
  ) as VehicleDetailDto["options"],
};

const singleSelections = Object.fromEntries(SINGLE_SELECT_CATEGORIES.map((c) => [c, `${c}-default`])) as never;
const multiSelections = { ACCESSORY: [], PACKAGE: [] };

function makeControls(recordOrbit: ShowroomControls["recordOrbit"]) {
  return {
    current: {
      recordOrbit,
      captureFrame: () => "data:image/png;base64,AAAA",
      goToPresetAsync: async () => {},
      goToRaw: async () => {},
      getCurrentCameraState: () => null,
    } as unknown as ShowroomControls,
  };
}

function renderCapture(controlsRef: ReturnType<typeof makeControls>, extra: { reducedMotion?: boolean; onRecordingProgress?: (p: number | null) => void } = {}) {
  return render(
    <ToastProvider>
      <CaptureVideo
        vehicle={vehicle}
        showroomControlsRef={controlsRef}
        currentPreset="default"
        sceneReady
        reducedMotion={extra.reducedMotion ?? false}
        onRecordingProgress={extra.onRecordingProgress ?? (() => {})}
      />
    </ToastProvider>,
  );
}

function supportVideo(supported: boolean) {
  if (supported) {
    vi.stubGlobal("MediaRecorder", { isTypeSupported: (t: string) => t === "video/mp4;codecs=avc1" });
    Object.defineProperty(HTMLCanvasElement.prototype, "captureStream", { value: () => ({}), configurable: true });
  } else {
    vi.stubGlobal("MediaRecorder", undefined);
  }
}

describe("CaptureVideo (Spec 30)", () => {
  beforeEach(() => {
    // An already-saved build, so capture doesn't need to save first.
    useConfigurationStore.setState({
      vehicleSlug: "apex-gt",
      singleSelections,
      multiSelections,
      customPaintHex: null,
      environmentId: null,
      savedConfiguration: {
        publicId: "APEX-AAAA-BBBB",
        vehicleSlug: "apex-gt",
        singleSelections,
        multiSelections,
        customPaintHex: null,
        environmentId: null,
        breakdown: { basePriceCents: 8_500_000, lineItems: [], totalPriceCents: 8_500_000, currency: "EUR" } as never,
        createdAt: "2026-09-26T00:00:00Z",
        ownerId: null,
      },
    });
    URL.createObjectURL = vi.fn(() => "blob:clip");
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("records an MP4 orbit with the build's title cards, reports progress, then offers Save Video (AC-1, AC-3, AC-4)", async () => {
    supportVideo(true);
    const progressUpdates: Array<number | null> = [];
    const recordOrbit = vi.fn<ShowroomControls["recordOrbit"]>(async ({ onProgress }) => {
      onProgress?.(0.5);
      await new Promise((resolve) => setTimeout(resolve, 30)); // a real recording spans many renders
      return new Blob(["mp4"], { type: "video/mp4" });
    });
    renderCapture(makeControls(recordOrbit), { onRecordingProgress: (p) => progressUpdates.push(p) });

    fireEvent.click(screen.getByRole("button", { name: "Capture Video" }));

    const dialog = await screen.findByRole("dialog", { name: "Your Build Video" });
    // jsdom has no WebCodecs, so this exercises the real-time (MediaRecorder) strategy.
    expect(recordOrbit).toHaveBeenCalledWith(
      expect.objectContaining({ strategy: { kind: "realtime", format: { mimeType: "video/mp4;codecs=avc1", extension: "mp4" } } }),
    );
    expect(progressUpdates).toContain(0.5);
    // The overlay is removed after recording (reported by an effect, so it lands just after the dialog).
    await waitFor(() => expect(progressUpdates.at(-1)).toBeNull());
    expect(screen.getByTestId("captured-video")).toHaveAttribute("src", "blob:clip");

    const clicks: string[] = [];
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    fireEvent.click(screen.getByRole("button", { name: "Save Video" }));
    expect(clicks).toEqual(["apex-gt-APEX-AAAA-BBBB.mp4"]);
    expect(dialog).toBeInTheDocument();
  });

  it("draws the vehicle's title cards on the recorded frames", async () => {
    supportVideo(true);
    let drawOverlay: ((ctx: CanvasRenderingContext2D, t: number) => void) | undefined;
    const recordOrbit = vi.fn<ShowroomControls["recordOrbit"]>(async (options) => {
      drawOverlay = options.drawOverlay;
      return new Blob(["mp4"], { type: "video/mp4" });
    });
    renderCapture(makeControls(recordOrbit));
    fireEvent.click(screen.getByRole("button", { name: "Capture Video" }));
    await screen.findByRole("dialog", { name: "Your Build Video" });

    const texts: string[] = [];
    const ctx = new Proxy({ canvas: { width: 720, height: 1280 }, fillText: (t: string) => texts.push(t) }, {
      get: (target, key) => (key in target ? target[key as keyof typeof target] : key === "createLinearGradient" ? () => ({ addColorStop: () => {} }) : () => {}),
      set: () => true,
    }) as unknown as CanvasRenderingContext2D;
    drawOverlay!(ctx, 400); // intro
    drawOverlay!(ctx, 3500); // outro
    expect(texts).toContain("Apex GT");
    expect(texts).toContain("€85,000");
    expect(texts).toContain("APEX-AAAA-BBBB");
  });

  it("falls back to an image, with an explanation, where the browser can't record video (AC-2)", async () => {
    supportVideo(false);
    const recordOrbit = vi.fn();
    renderCapture(makeControls(recordOrbit));

    fireEvent.click(screen.getByRole("button", { name: "Capture Video" }));

    const dialog = await screen.findByRole("dialog", { name: "Your Build" });
    expect(dialog).toHaveTextContent("Video capture isn’t supported in this browser");
    expect(screen.getByRole("button", { name: "Save Image" })).toBeInTheDocument();
    expect(recordOrbit).not.toHaveBeenCalled();
  });

  it("falls back to an image if recording fails partway, instead of leaving nothing (AC-2)", async () => {
    supportVideo(true);
    const recordOrbit = vi.fn<ShowroomControls["recordOrbit"]>(async () => {
      throw new Error("encoder crashed");
    });
    renderCapture(makeControls(recordOrbit));

    fireEvent.click(screen.getByRole("button", { name: "Capture Video" }));

    const dialog = await screen.findByRole("dialog", { name: "Your Build" });
    expect(dialog).toHaveTextContent("The video couldn’t be recorded");
  });

  it("a fast double-click starts only one recording, and the button disables on the click itself", async () => {
    supportVideo(true);
    let finish!: () => void;
    const recordOrbit = vi.fn<ShowroomControls["recordOrbit"]>(
      () => new Promise((resolve) => (finish = () => resolve(new Blob(["mp4"], { type: "video/mp4" })))),
    );
    const busy: boolean[] = [];
    render(
      <ToastProvider>
        <CaptureVideo
          vehicle={vehicle}
          showroomControlsRef={makeControls(recordOrbit)}
          currentPreset="default"
          sceneReady
          reducedMotion={false}
          onRecordingProgress={() => {}}
          onBusyChange={(b) => busy.push(b)}
        />
      </ToastProvider>,
    );
    const button = screen.getByRole("button", { name: "Capture Video" });

    fireEvent.click(button);
    fireEvent.click(button); // lands before any async work has resolved

    await waitFor(() => expect(recordOrbit).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Preparing video…" })).toBeDisabled();
    expect(busy).toContain(true);

    finish();
    await screen.findByRole("dialog", { name: "Your Build Video" });
    expect(recordOrbit).toHaveBeenCalledTimes(1);
  });

  it("leaving the showroom mid-render cancels quietly — no image fallback, nothing reported as a failure", async () => {
    supportVideo(true);
    const { captureException } = await import("@sentry/nextjs");
    let seenSignal: AbortSignal | undefined;
    const recordOrbit = vi.fn<ShowroomControls["recordOrbit"]>(
      ({ signal }) =>
        new Promise((_resolve, reject) => {
          seenSignal = signal;
          signal?.addEventListener("abort", () => reject(new DOMException("cancelled", "AbortError")));
        }),
    );
    const { unmount } = renderCapture(makeControls(recordOrbit));
    fireEvent.click(screen.getByRole("button", { name: "Capture Video" }));
    await waitFor(() => expect(recordOrbit).toHaveBeenCalled());

    unmount();
    expect(seenSignal?.aborted).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(captureException).not.toHaveBeenCalled();
  });

  it("doesn't autoplay the preview with reduced motion, but still offers the capture (AC-5)", async () => {
    supportVideo(true);
    renderCapture(makeControls(async () => new Blob(["mp4"], { type: "video/mp4" })), { reducedMotion: true });
    fireEvent.click(screen.getByRole("button", { name: "Capture Video" }));
    const video = await screen.findByTestId("captured-video");
    expect((video as HTMLVideoElement).autoplay).toBe(false);
  });
});

describe("RecordingOverlay (AC-3, AC-5)", () => {
  it("shows the percentage rendered and a progress bar with no decorative animation", () => {
    render(<RecordingOverlay progress={0.456} />);
    expect(screen.getByRole("status", { name: "Recording your build video" })).toHaveTextContent("Rendering your video… 46%");
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "46");
    expect(bar.innerHTML).not.toMatch(/transition|animate/);
  });
});

describe("feature flag", () => {
  it("renders nothing when NEXT_PUBLIC_VIDEO_CAPTURE_ENABLED=false", async () => {
    vi.stubEnv("NEXT_PUBLIC_VIDEO_CAPTURE_ENABLED", "false");
    vi.resetModules();
    const { CaptureVideo: FlaggedOff } = await import("../../src/components/configurator/CaptureVideo/CaptureVideo");
    const { container } = render(
      <FlaggedOff vehicle={vehicle} showroomControlsRef={{ current: null }} currentPreset="default" sceneReady reducedMotion={false} onRecordingProgress={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
    vi.unstubAllEnvs();
  });
});

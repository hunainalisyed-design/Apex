import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ALL_CATEGORIES, type CustomizationOptionDto, type OptionCategory, type VehicleDetailDto } from "../../src/types/catalog";

// The Web Audio manager is covered by tests/sound/soundManager.test.ts; here it's a spy, so
// these tests check the showroom's wiring: which interaction asks for which cue.
const manager = {
  enabled: false,
  enable: vi.fn(async () => {
    manager.enabled = true;
  }),
  disable: vi.fn(() => {
    manager.enabled = false;
  }),
  isEnabled: () => manager.enabled,
  play: vi.fn(),
  playWhenReady: vi.fn(async () => {}),
  startAmbience: vi.fn(async () => {}),
};
vi.mock("../../src/lib/sound/soundManager", () => ({ getSoundManager: () => manager }));

let capturedSceneProps: { onDoorEvent?: (event: "open" | "close") => void } = {};
vi.mock("../../src/components/showroom/ShowroomScene", () => ({
  ShowroomScene: (props: typeof capturedSceneProps) => {
    capturedSceneProps = props;
    return <div data-testid="showroom-scene-mock" />;
  },
}));

const { SoundToggle } = await import("../../src/components/showroom/SoundToggle");
const { ConfigureShowroom } = await import("../../src/components/showroom/ConfigureShowroom");
const { ToastProvider } = await import("../../src/components/shell/ToastProvider");
const { resetSoundPreferenceForTests, SOUND_PREFERENCE_KEY } = await import("../../src/lib/sound/soundPreference");

function vehicleFor(slug: string, name: string): VehicleDetailDto {
  const options = Object.fromEntries(
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
  ) as VehicleDetailDto["options"];
  return {
    slug,
    name,
    tagline: "Test vehicle.",
    basePriceCents: 1_000_000,
    currency: "EUR",
    horsepower: 400,
    topSpeedKph: 280,
    zeroToHundredSec: 4,
    thumbnailUrl: "",
    fallbackImageUrl: "",
    heroModelUrl: "/hero.aaaaaaaa.glb",
    showroomModelUrl: "/showroom.aaaaaaaa.glb",
    options,
  };
}

function renderShowroom(vehicle: VehicleDetailDto) {
  return render(
    <ToastProvider>
      <ConfigureShowroom vehicle={vehicle} />
    </ToastProvider>,
  );
}

describe("SoundToggle (Spec 29, §5)", () => {
  it("shows the muted state with an accessible 'turn on' name", () => {
    render(<SoundToggle enabled={false} onToggle={() => {}} />);
    const button = screen.getByRole("button", { name: "Turn showroom sound on" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("Sound off");
  });

  it("shows the on state and reports presses", () => {
    const onToggle = vi.fn();
    render(<SoundToggle enabled onToggle={onToggle} />);
    const button = screen.getByRole("button", { name: "Turn showroom sound off" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledOnce();
  });
});

describe("showroom sound wiring (Spec 29)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    manager.enabled = false;
    window.localStorage.clear();
    resetSoundPreferenceForTests();
    capturedSceneProps = {};
  });

  it("is off on a first visit: nothing loads or plays (AC-1)", () => {
    renderShowroom(vehicleFor("apex-gt", "Apex GT"));
    expect(screen.getByRole("button", { name: "Turn showroom sound on" })).toBeInTheDocument();
    expect(manager.enable).not.toHaveBeenCalled();
    expect(manager.playWhenReady).not.toHaveBeenCalled();
  });

  it("turning sound on enables audio in the click itself, starts the engine and ambience, and remembers it (AC-2, AC-3)", async () => {
    renderShowroom(vehicleFor("apex-gt", "Apex GT"));
    fireEvent.click(screen.getByRole("button", { name: "Turn showroom sound on" }));

    expect(manager.enable).toHaveBeenCalled();
    await waitFor(() => expect(manager.playWhenReady).toHaveBeenCalledWith("engineStart"));
    expect(manager.startAmbience).toHaveBeenCalled();
    expect(window.localStorage.getItem(SOUND_PREFERENCE_KEY)).toBe("true");
    expect(screen.getByRole("button", { name: "Turn showroom sound off" })).toHaveAttribute("aria-pressed", "true");
  });

  it("a returning visitor with sound on hears the engine start on entry", async () => {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, "true");
    renderShowroom(vehicleFor("apex-gt", "Apex GT"));
    await waitFor(() => expect(manager.playWhenReady).toHaveBeenCalledWith("engineStart"));
  });

  it("turning sound off silences it and is remembered", async () => {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, "true");
    renderShowroom(vehicleFor("apex-gt", "Apex GT"));
    fireEvent.click(await screen.findByRole("button", { name: "Turn showroom sound off" }));
    expect(manager.disable).toHaveBeenCalled();
    expect(window.localStorage.getItem(SOUND_PREFERENCE_KEY)).toBe("false");
  });

  it("plays light and door cues on a placeholder car, whose lights and doors really animate (AC-2)", async () => {
    window.localStorage.setItem(SOUND_PREFERENCE_KEY, "true");
    renderShowroom(vehicleFor("apex-gt", "Apex GT"));
    await waitFor(() => expect(manager.enable).toHaveBeenCalled());

    fireEvent.click(screen.getByRole("button", { name: /Headlights/ }));
    fireEvent.click(screen.getByRole("button", { name: "Brake Pulse" }));
    capturedSceneProps.onDoorEvent?.("open");
    capturedSceneProps.onDoorEvent?.("close");

    expect(manager.play.mock.calls.map(([id]) => id)).toEqual(["headlightSwitch", "brakeClick", "doorOpen", "doorClose"]);
  });

  it("hides the lighting controls for a real-model car, which doesn't animate its lights", () => {
    renderShowroom(vehicleFor("porsche-992-gt3-r", "Porsche 992 GT3 R"));
    expect(screen.queryByRole("button", { name: /Headlights/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Brake Pulse" })).toBeNull();
    expect(screen.getByRole("button", { name: "Turn showroom sound on" })).toBeInTheDocument();
  });

  it("stays silent while muted even when lights are used", () => {
    renderShowroom(vehicleFor("apex-gt", "Apex GT"));
    fireEvent.click(screen.getByRole("button", { name: /Headlights/ }));
    expect(manager.play).not.toHaveBeenCalled();
  });
});

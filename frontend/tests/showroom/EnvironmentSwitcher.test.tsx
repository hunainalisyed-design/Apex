import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnvironmentSwitcher } from "../../src/components/showroom/EnvironmentSwitcher/EnvironmentSwitcher";
import type { ShowroomControls } from "../../src/components/showroom/ShowroomScene";
import { ENVIRONMENT_FADE_MS, useShowroomEnvironment } from "../../src/components/showroom/useShowroomEnvironment";
import { useConfigurationStore } from "../../src/state/configurationStore";
import type { EnvironmentDto } from "../../src/types/environments";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

function env(id: string, name: string, isStudio = false): EnvironmentDto {
  return {
    id,
    name,
    hdriUrl: `/assets/environments/${id}-2k.aaaaaaaa.hdr`,
    hdriMobileUrl: `/assets/environments/${id}-1k.aaaaaaaa.hdr`,
    thumbnailUrl: `/assets/environments/${id}-thumb.aaaaaaaa.png`,
    isStudio,
    groundHeight: isStudio ? null : 1.6,
    groundRadius: isStudio ? null : 60,
  };
}
const ENVIRONMENTS = [env("studio", "Studio", true), env("night-city", "Night City"), env("coastal-road", "Coastal Road"), env("track", "Track")];

describe("EnvironmentSwitcher (Spec 28, AC-1)", () => {
  it("lists every environment with its thumbnail and marks the selected one", () => {
    render(<EnvironmentSwitcher environments={ENVIRONMENTS} selectedId="coastal-road" onSelect={() => {}} />);

    const group = screen.getByRole("group", { name: "Environment" });
    const buttons = screen.getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Studio", "Night City", "Coastal Road", "Track"]);
    expect(group.querySelectorAll("img")).toHaveLength(4);
    expect(screen.getByRole("button", { name: "Coastal Road" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Studio" })).toHaveAttribute("aria-pressed", "false");
  });

  it("reports the chosen environment", () => {
    const onSelect = vi.fn();
    render(<EnvironmentSwitcher environments={ENVIRONMENTS} selectedId="studio" onSelect={onSelect} />);
    fireEvent.click(screen.getByRole("button", { name: "Track" }));
    expect(onSelect).toHaveBeenCalledWith("track");
  });

  it("is disabled until the scene is ready, and hidden when there's nothing to switch between", () => {
    const { rerender } = render(<EnvironmentSwitcher environments={ENVIRONMENTS} selectedId="studio" onSelect={() => {}} disabled />);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();

    rerender(<EnvironmentSwitcher environments={[ENVIRONMENTS[0]]} selectedId="studio" onSelect={() => {}} />);
    expect(screen.queryByRole("group")).toBeNull();
  });
});

describe("useShowroomEnvironment", () => {
  const controlsRef = { current: { captureFrame: () => "data:image/png;base64,FRAME" } as unknown as ShowroomControls };

  beforeEach(() => {
    vi.useFakeTimers();
    useConfigurationStore.setState({ environmentId: null });
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => vi.useRealTimers());

  it("defaults to Studio and stores a selection in the configuration store (AC-4)", () => {
    const { result } = renderHook(() => useShowroomEnvironment(ENVIRONMENTS, controlsRef, true));
    expect(result.current.selectedId).toBe("studio");

    act(() => result.current.select("night-city"));
    expect(useConfigurationStore.getState().environmentId).toBe("night-city");
    expect(result.current.selectedId).toBe("night-city");
    expect(result.current.settings?.backdrop).toBe("ground");
  });

  it("stores Studio as null, matching how existing builds are saved", () => {
    useConfigurationStore.setState({ environmentId: "track" });
    const { result } = renderHook(() => useShowroomEnvironment(ENVIRONMENTS, controlsRef, true));
    act(() => result.current.select("studio"));
    expect(useConfigurationStore.getState().environmentId).toBeNull();
  });

  it("crossfades: freezes the current frame, then fades it out once the new environment is ready (AC-3)", () => {
    const { result } = renderHook(() => useShowroomEnvironment(ENVIRONMENTS, controlsRef, false));

    act(() => result.current.select("coastal-road"));
    expect(result.current.overlay).toEqual({ src: "data:image/png;base64,FRAME", fading: false });

    act(() => result.current.onReady());
    expect(result.current.overlay?.fading).toBe(true);

    act(() => vi.advanceTimersByTime(ENVIRONMENT_FADE_MS));
    expect(result.current.overlay).toBeNull();
  });

  it("cuts instantly with no crossfade when reduced motion is preferred (AC-3)", () => {
    const { result } = renderHook(() => useShowroomEnvironment(ENVIRONMENTS, controlsRef, true));
    act(() => result.current.select("track"));
    expect(result.current.overlay).toBeNull();
    expect(result.current.selectedId).toBe("track");
  });

  it("never leaves the frozen frame stuck if the new environment never reports ready", () => {
    const { result } = renderHook(() => useShowroomEnvironment(ENVIRONMENTS, controlsRef, false));
    act(() => result.current.select("track"));
    act(() => vi.advanceTimersByTime(10_000));
    expect(result.current.overlay).toBeNull();
  });

  it("falls back to Studio when an HDRI fails to load, without changing the saved choice (§5)", () => {
    useConfigurationStore.setState({ environmentId: "night-city" });
    const { result } = renderHook(() => useShowroomEnvironment(ENVIRONMENTS, controlsRef, true));
    expect(result.current.selectedId).toBe("night-city");

    act(() => result.current.onError(new Error("404")));
    expect(result.current.selectedId).toBe("studio");
    expect(result.current.settings?.backdrop).toBe("studio");
    expect(useConfigurationStore.getState().environmentId).toBe("night-city");
  });

  it("does nothing when the already-shown environment is re-selected", () => {
    const { result } = renderHook(() => useShowroomEnvironment(ENVIRONMENTS, controlsRef, false));
    act(() => result.current.select("studio"));
    expect(result.current.overlay).toBeNull();
  });
});

describe("configuration store (AC-4)", () => {
  it("counts a changed environment as an unsaved change, and Reset leaves it alone", () => {
    useConfigurationStore.setState({
      environmentId: "night-city",
      savedConfiguration: { environmentId: null, singleSelections: {}, multiSelections: {}, customPaintHex: null } as never,
      singleSelections: {} as never,
      multiSelections: {} as never,
      customPaintHex: null,
    });
    expect(useConfigurationStore.getState().isDirtySinceLastSave()).toBe(true);

    useConfigurationStore.getState().reset();
    expect(useConfigurationStore.getState().environmentId).toBe("night-city");
  });
});

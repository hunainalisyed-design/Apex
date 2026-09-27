import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SelectionState } from "../../src/lib/ai/mergeRecommendation";
import type { VehicleDetailDto } from "../../src/types/catalog";

// The real 3D canvas can't run in jsdom (it's covered by e2e/before-after-slider.spec.ts); this
// stand-in "draws" a picture named after the build's paint, or fails, or never finishes.
const studio = { behavior: "ok" as "ok" | "error" | "hang", drawn: [] as SelectionState[], mounts: 0, unmounts: 0 };
vi.mock("../../src/components/ai/RecommendationCard/BeforeAfterSlider/StudioCanvas", async () => {
  const { useEffect } = await vi.importActual<typeof import("react")>("react");
  return {
    COMPARISON_WIDTH: 640,
    COMPARISON_HEIGHT: 360,
    StudioCanvas: ({
      selection,
      captureId,
      onCapture,
      onError,
    }: {
      selection: SelectionState;
      captureId: string;
      onCapture: (id: string, u: string) => void;
      onError: () => void;
    }) => {
      useEffect(() => {
        studio.mounts += 1;
        return () => {
          studio.unmounts += 1;
        };
      }, []);
      useEffect(() => {
        studio.drawn.push(selection);
        if (studio.behavior === "error") onError();
        if (studio.behavior === "ok") setTimeout(() => onCapture(captureId, `data:image/jpeg;base64,${selection.singleSelections.PAINT}`), 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps -- one draw per picture, like the real canvas
      }, [captureId]);
      return null;
    },
  };
});

const { mergeRecommendation } = await import("../../src/lib/ai/mergeRecommendation");
const { ComparisonStudio, COMPARISON_TIMEOUT_MS } = await import("../../src/components/ai/RecommendationCard/BeforeAfterSlider/ComparisonStudio");
const { useComparisonStore } = await import("../../src/state/comparisonStore");
const { useConfigurationStore } = await import("../../src/state/configurationStore");
const { useCarAiChatStore } = await import("../../src/state/carAiChatStore");

const vehicle = { slug: "apex-gt", name: "Apex GT" } as unknown as VehicleDetailDto;

function build(overrides: Partial<Record<string, string>> = {}, multi: { ACCESSORY: string[]; PACKAGE: string[] } = { ACCESSORY: [], PACKAGE: [] }, customPaintHex: string | null = null): SelectionState {
  return {
    singleSelections: { PAINT: "PAINT-a", WHEELS: "WHEELS-a", ...overrides } as SelectionState["singleSelections"],
    multiSelections: multi,
    customPaintHex,
  };
}

function job(messageId: string, before = build(), after = build({ PAINT: "PAINT-b" })) {
  return { messageId, vehicleSlug: "apex-gt", before, after };
}

beforeEach(() => {
  studio.behavior = "ok";
  studio.drawn = [];
  studio.mounts = 0;
  studio.unmounts = 0;
  useComparisonStore.getState().reset();
});

describe("mergeRecommendation — what Apply would do, without applying (Spec 36)", () => {
  const cases: Array<[string, SelectionState, Parameters<typeof mergeRecommendation>[1]]> = [
    ["a new wheel", build(), { singleSelections: { WHEELS: "WHEELS-b" }, multiSelections: {} }],
    ["a paint over a custom color (which it clears)", build({ PAINT: "PAINT-custom" }, undefined, "#123456"), { singleSelections: { PAINT: "PAINT-b" }, multiSelections: {} }],
    ["accessories: added, never removed, no duplicates", build({}, { ACCESSORY: ["acc-1"], PACKAGE: [] }), { singleSelections: {}, multiSelections: { ACCESSORY: ["acc-1", "acc-2"], PACKAGE: ["pkg-1"] } }],
    ["nothing to change", build(), { singleSelections: {}, multiSelections: {} }],
  ];

  it.each(cases)("matches the real Apply exactly: %s", (_name, current, recommendation) => {
    const expected = mergeRecommendation(current, recommendation);

    useConfigurationStore.setState({ ...current });
    useCarAiChatStore.setState({ messages: [{ id: "m1", role: "assistant", content: "", recommendation }] });
    useCarAiChatStore.getState().applyRecommendation("m1");
    const applied = useConfigurationStore.getState();

    expect({ singleSelections: applied.singleSelections, multiSelections: applied.multiSelections, customPaintHex: applied.customPaintHex }).toEqual(expected);
  });

  it("never changes the build it's given", () => {
    const current = build({}, { ACCESSORY: ["acc-1"], PACKAGE: [] });
    const snapshot = JSON.stringify(current);
    mergeRecommendation(current, { singleSelections: { WHEELS: "WHEELS-b" }, multiSelections: { ACCESSORY: ["acc-2"] } });
    expect(JSON.stringify(current)).toBe(snapshot);
  });
});

describe("comparisonStore", () => {
  it("makes one pair at a time, in order, and ignores a repeat request", () => {
    const { request } = useComparisonStore.getState();
    request(job("m1"));
    request(job("m2"));
    request(job("m1"));
    expect(useComparisonStore.getState().current?.messageId).toBe("m1");
    expect(useComparisonStore.getState().queue.map((j) => j.messageId)).toEqual(["m2"]);

    useComparisonStore.getState().complete("m1", "b", "a");
    expect(useComparisonStore.getState().entries.m1).toEqual({ status: "ready", before: "b", after: "a" });
    expect(useComparisonStore.getState().current?.messageId).toBe("m2");
    useComparisonStore.getState().fail("m2");
    expect(useComparisonStore.getState().entries.m2).toEqual({ status: "error" });
    expect(useComparisonStore.getState().current).toBeNull();
  });

  it("ignores a late answer after a reset (another vehicle's chat)", () => {
    useComparisonStore.getState().request(job("m1"));
    useComparisonStore.getState().reset();
    useComparisonStore.getState().complete("m1", "b", "a");
    expect(useComparisonStore.getState().entries).toEqual({});
  });
});

describe("ComparisonStudio — the hidden before/after capture (Spec 36, AC-2)", () => {
  afterEach(() => vi.useRealTimers());

  it("draws 'before' then 'after', hands both over, then goes away", async () => {
    render(<ComparisonStudio vehicle={vehicle} />);
    act(() => useComparisonStore.getState().request(job("m1")));
    expect(screen.getByTestId("comparison-studio")).toHaveAttribute("aria-hidden", "true");

    await waitFor(() => expect(useComparisonStore.getState().entries.m1?.status).toBe("ready"));
    expect(useComparisonStore.getState().entries.m1).toEqual({
      status: "ready",
      before: "data:image/jpeg;base64,PAINT-a",
      after: "data:image/jpeg;base64,PAINT-b",
    });
    expect(studio.drawn.map((s) => s.singleSelections.PAINT)).toEqual(["PAINT-a", "PAINT-b"]);
    expect(screen.queryByTestId("comparison-studio")).not.toBeInTheDocument();
  });

  it("never touches the live build — the showroom keeps exactly what the user has", async () => {
    const live = build({ PAINT: "PAINT-live" }, { ACCESSORY: ["acc-live"], PACKAGE: [] }, null);
    useConfigurationStore.setState({ ...live });
    const before = useConfigurationStore.getState();

    render(<ComparisonStudio vehicle={vehicle} />);
    act(() => useComparisonStore.getState().request(job("m1")));
    await waitFor(() => expect(useComparisonStore.getState().entries.m1?.status).toBe("ready"));

    const after = useConfigurationStore.getState();
    expect(after.singleSelections).toBe(before.singleSelections);
    expect(after.multiSelections).toBe(before.multiSelections);
    expect(after.customPaintHex).toBe(before.customPaintHex);
  });

  it("works through queued pairs one after another", async () => {
    render(<ComparisonStudio vehicle={vehicle} />);
    act(() => {
      useComparisonStore.getState().request(job("m1"));
      useComparisonStore.getState().request(job("m2", build({ PAINT: "PAINT-c" }), build({ PAINT: "PAINT-d" })));
    });
    await waitFor(() => expect(useComparisonStore.getState().entries.m2?.status).toBe("ready"));
    expect(studio.drawn.map((s) => s.singleSelections.PAINT)).toEqual(["PAINT-a", "PAINT-b", "PAINT-c", "PAINT-d"]);
    // One 3D view for the whole batch — never re-created between pictures or pairs.
    expect(studio.mounts).toBe(1);
  });

  it("creates one 3D view for a pair and removes it once the work is done", async () => {
    render(<ComparisonStudio vehicle={vehicle} />);
    act(() => useComparisonStore.getState().request(job("m1")));
    await waitFor(() => expect(useComparisonStore.getState().entries.m1?.status).toBe("ready"));
    expect(studio.mounts).toBe(1);
    expect(studio.unmounts).toBe(1);
  });

  it("after a broken view, the next pair gets a fresh one", async () => {
    studio.behavior = "error";
    render(<ComparisonStudio vehicle={vehicle} />);
    act(() => {
      useComparisonStore.getState().request(job("m1"));
      useComparisonStore.getState().request(job("m2"));
    });
    await waitFor(() => expect(useComparisonStore.getState().entries.m2?.status).toBe("error"));
    expect(useComparisonStore.getState().entries.m1?.status).toBe("error");
    // A broken context can't recover, so m2 got a new view instead of waiting out the timeout.
    expect(studio.mounts).toBe(2);
  });

  it("marks the pair failed if the 3D view can't be made (e.g. no WebGL)", async () => {
    studio.behavior = "error";
    render(<ComparisonStudio vehicle={vehicle} />);
    act(() => useComparisonStore.getState().request(job("m1")));
    await waitFor(() => expect(useComparisonStore.getState().entries.m1?.status).toBe("error"));
  });

  it("gives up after the timeout", async () => {
    vi.useFakeTimers();
    studio.behavior = "hang";
    render(<ComparisonStudio vehicle={vehicle} />);
    act(() => useComparisonStore.getState().request(job("m1")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(COMPARISON_TIMEOUT_MS);
    });
    expect(useComparisonStore.getState().entries.m1?.status).toBe("error");
  });

  it("refuses a pair for a different vehicle", async () => {
    render(<ComparisonStudio vehicle={vehicle} />);
    act(() => useComparisonStore.getState().request({ ...job("m1"), vehicleSlug: "apex-rs" }));
    await waitFor(() => expect(useComparisonStore.getState().entries.m1?.status).toBe("error"));
    expect(studio.drawn).toEqual([]);
  });
});

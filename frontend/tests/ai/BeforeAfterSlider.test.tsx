import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiConfigureRecommendation } from "../../src/types/ai";
import type { PriceBreakdownDto } from "../../src/types/pricing";

// jsdom has no PointerEvent, so fireEvent.pointer* would drop clientX; a MouseEvent-based one keeps it.
if (typeof window.PointerEvent === "undefined") {
  class PointerEventPolyfill extends MouseEvent {
    pointerId: number;
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init);
      this.pointerId = init.pointerId ?? 0;
    }
  }
  vi.stubGlobal("PointerEvent", PointerEventPolyfill);
}

const reducedMotion = { value: false };
vi.mock("../../src/hooks/useReducedMotion", () => ({ useReducedMotion: () => reducedMotion.value }));

const { BeforeAfterSlider } = await import("../../src/components/ai/RecommendationCard/BeforeAfterSlider/BeforeAfterSlider");
const { RecommendationCard } = await import("../../src/components/ai/RecommendationCard/RecommendationCard");
const { useComparisonStore } = await import("../../src/state/comparisonStore");
const { useConfigurationStore } = await import("../../src/state/configurationStore");

const BEFORE = "data:image/jpeg;base64,QkVGT1JF";
const AFTER = "data:image/jpeg;base64,QUZURVI=";

function renderSlider() {
  render(
    <BeforeAfterSlider
      before={BEFORE}
      after={AFTER}
      beforeLabel="Current"
      afterLabel="CarAI's suggestion"
      label="Compare your current build with CarAI's suggestion"
      valueText={(p) => `${p}% of CarAI's suggestion shown`}
      beforeAlt="Your current build"
      afterAlt="Your build with CarAI's suggestion applied"
    />,
  );
  const slider = screen.getByRole("slider", { name: "Compare your current build with CarAI's suggestion" });
  // jsdom has no layout: give the slider a 200px-wide box starting at x=100.
  slider.getBoundingClientRect = () => ({ left: 100, width: 200, top: 0, height: 112, right: 300, bottom: 112, x: 100, y: 0, toJSON: () => ({}) });
  return slider;
}

const clip = () => (screen.getByTestId("before-image") as HTMLImageElement).style.clipPath;

describe("BeforeAfterSlider (Spec 36)", () => {
  beforeEach(() => {
    reducedMotion.value = false;
  });

  it("shows both pictures, split in the middle, as an accessible slider", () => {
    const slider = renderSlider();
    expect(screen.getByRole("img", { name: "Your current build" })).toHaveAttribute("src", BEFORE);
    expect(screen.getByRole("img", { name: "Your build with CarAI's suggestion applied" })).toHaveAttribute("src", AFTER);
    expect(slider).toHaveAttribute("aria-valuenow", "50");
    expect(slider).toHaveAttribute("aria-valuetext", "50% of CarAI's suggestion shown");
    expect(slider).toHaveAttribute("tabindex", "0");
    expect(clip()).toBe("inset(0 50% 0 0)");
  });

  it("follows a mouse or touch drag exactly, with no glide while dragging (AC-3)", () => {
    const slider = renderSlider();
    fireEvent.pointerDown(slider, { clientX: 150, pointerId: 1 }); // 25% across
    expect(clip()).toBe("inset(0 75% 0 0)");
    expect((screen.getByTestId("before-image") as HTMLImageElement).style.transition).toBe("none");
    fireEvent.pointerMove(slider, { clientX: 260, pointerId: 1 }); // 80%
    expect(clip()).toBe("inset(0 20% 0 0)");
    expect(slider).toHaveAttribute("aria-valuenow", "20");
    fireEvent.pointerMove(slider, { clientX: 999, pointerId: 1 }); // past the end: clamped
    expect(clip()).toBe("inset(0 0% 0 0)");
    fireEvent.pointerUp(slider, { pointerId: 1 });
    fireEvent.pointerMove(slider, { clientX: 100, pointerId: 1 }); // not dragging any more
    expect(clip()).toBe("inset(0 0% 0 0)");
  });

  it("works from the keyboard: arrows move 5%, Home and End jump to the ends (AC-3)", () => {
    const slider = renderSlider();
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(slider).toHaveAttribute("aria-valuenow", "55");
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    fireEvent.keyDown(slider, { key: "ArrowUp" });
    expect(slider).toHaveAttribute("aria-valuenow", "45");
    fireEvent.keyDown(slider, { key: "Home" });
    expect(slider).toHaveAttribute("aria-valuenow", "100"); // all suggestion
    fireEvent.keyDown(slider, { key: "End" });
    expect(slider).toHaveAttribute("aria-valuenow", "0"); // all current build
    fireEvent.keyDown(slider, { key: "End" });
    fireEvent.keyDown(slider, { key: "ArrowRight" });
    expect(slider).toHaveAttribute("aria-valuenow", "0"); // clamped
  });

  it("keyboard steps glide — unless the user prefers reduced motion (AC-5)", () => {
    const slider = renderSlider();
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect((screen.getByTestId("before-image") as HTMLImageElement).style.transition).toContain("clip-path");
    expect(screen.getByTestId("slider-divider").style.transition).toContain("left");
  });

  it("with reduced motion, the divider moves without any animation — and still works (AC-5)", () => {
    reducedMotion.value = true;
    const slider = renderSlider();
    fireEvent.keyDown(slider, { key: "ArrowLeft" });
    expect(slider).toHaveAttribute("aria-valuenow", "55");
    expect((screen.getByTestId("before-image") as HTMLImageElement).style.transition).toBe("none");
    expect(screen.getByTestId("slider-divider").style.transition).toBe("none");
  });
});

describe("RecommendationCard with the before/after preview (Spec 36)", () => {
  const recommendation: AiConfigureRecommendation = { singleSelections: { WHEELS: "WHEELS-b" }, multiSelections: {} };
  const breakdown: PriceBreakdownDto = {
    vehicleSlug: "apex-gt",
    basePriceCents: 100,
    lineItems: [{ optionId: "WHEELS-b", category: "WHEELS", name: "Sport Wheels", priceDeltaCents: 50 }],
    totalPriceCents: 150,
    currency: "EUR",
  };

  function renderCard(onApply = vi.fn(), applied = false) {
    render(
      <RecommendationCard recommendation={recommendation} breakdown={breakdown} applied={applied} onApply={onApply} messageId="m1" vehicleSlug="apex-gt" />,
    );
    return onApply;
  }

  beforeEach(() => {
    useComparisonStore.getState().reset();
    useConfigurationStore.setState({
      singleSelections: { PAINT: "PAINT-a", WHEELS: "WHEELS-a" } as never,
      multiSelections: { ACCESSORY: [], PACKAGE: [] },
      customPaintHex: null,
    });
  });

  it("asks for the pair (current build → with the suggestion) and shows it's preparing (AC-1, AC-2)", () => {
    renderCard();
    expect(screen.getByTestId("comparison-preparing")).toHaveTextContent("Preparing a before/after preview…");
    const job = useComparisonStore.getState().current!;
    expect(job).toMatchObject({ messageId: "m1", vehicleSlug: "apex-gt" });
    expect(job.before.singleSelections.WHEELS).toBe("WHEELS-a");
    expect(job.after.singleSelections.WHEELS).toBe("WHEELS-b");
    // The list and Apply are there while it prepares.
    expect(screen.getByText("Sport Wheels")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply Configuration" })).toBeEnabled();
  });

  it("shows the slider once the pictures are ready, alongside the list", () => {
    renderCard();
    act(() => useComparisonStore.getState().complete("m1", BEFORE, AFTER));
    expect(screen.getByRole("slider")).toBeInTheDocument();
    expect(screen.getByText("Sport Wheels")).toBeInTheDocument();
  });

  it("if the pictures can't be made, the card is just the list — no broken slider (§5 Error)", () => {
    renderCard();
    act(() => useComparisonStore.getState().fail("m1"));
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
    expect(screen.queryByTestId("comparison-preparing")).not.toBeInTheDocument();
    expect(screen.getByText("Sport Wheels")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply Configuration" })).toBeEnabled();
  });

  it("Apply behaves exactly as before — the slider is only a preview (AC-4)", () => {
    const onApply = renderCard();
    act(() => useComparisonStore.getState().complete("m1", BEFORE, AFTER));
    fireEvent.keyDown(screen.getByRole("slider"), { key: "Home" });
    expect(onApply).not.toHaveBeenCalled(); // using the slider applies nothing
    fireEvent.click(screen.getByRole("button", { name: "Apply Configuration" }));
    expect(onApply).toHaveBeenCalledOnce();
  });

  it("makes the pair only once per recommendation (e.g. reopening the chat)", () => {
    const { unmount } = render(
      <RecommendationCard recommendation={recommendation} breakdown={breakdown} applied={false} onApply={vi.fn()} messageId="m1" vehicleSlug="apex-gt" />,
    );
    act(() => useComparisonStore.getState().complete("m1", BEFORE, AFTER));
    unmount();
    renderCard();
    expect(useComparisonStore.getState().current).toBeNull();
    expect(screen.getByRole("slider")).toBeInTheDocument();
  });

  it("without a message id it's the plain card, as in Spec 15", () => {
    render(<RecommendationCard recommendation={recommendation} breakdown={breakdown} applied onApply={vi.fn()} />);
    expect(screen.queryByTestId("comparison-preparing")).not.toBeInTheDocument();
    expect(useComparisonStore.getState().current).toBeNull();
    expect(screen.getByRole("button", { name: "Applied" })).toBeDisabled();
  });
});

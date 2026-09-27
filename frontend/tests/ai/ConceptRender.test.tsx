import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VehicleDetailDto } from "../../src/types/catalog";

class MockApiRequestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
vi.mock("../../src/lib/api/configurations", () => ({ ApiRequestError: MockApiRequestError }));

const requestConceptRenderMock = vi.fn();
vi.mock("../../src/lib/api/conceptRender", () => ({
  requestConceptRender: (...args: unknown[]) => requestConceptRenderMock(...args),
  CONCEPT_RENDERS_ENABLED: true,
}));

const { ConceptRender } = await import("../../src/components/ai/ConceptRender/ConceptRender");
const { useConfigurationStore } = await import("../../src/state/configurationStore");

const vehicle = { slug: "apex-gt", name: "Apex GT" } as unknown as VehicleDetailDto;
const IMAGE = "data:image/png;base64,ZmFrZQ==";
const LABEL = "AI Concept — Not a Real Configuration";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** The spec treats these as correctness-critical: always labeled, never applicable (AC-2/AC-3). */
function expectLabeledAndNotApplicable() {
  const dialog = screen.getByRole("dialog");
  expect(within(dialog).getByTestId("concept-label")).toHaveTextContent(LABEL);
  expect(within(dialog).queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();
  expect(within(dialog).queryByText(/apply/i)).not.toBeInTheDocument();
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Imagine the Ultimate Version" }));
}

describe("ConceptRender (Spec 35)", () => {
  beforeEach(() => {
    requestConceptRenderMock.mockReset();
    useConfigurationStore.setState({
      singleSelections: { PAINT: "paint-red", WHEELS: "wheels-sport" } as never,
      multiSelections: { ACCESSORY: ["acc-1"], PACKAGE: [] },
      customPaintHex: null,
    });
  });

  it("asks for a concept of the current build, and shows a labeled loading state (AC-1)", () => {
    requestConceptRenderMock.mockReturnValue(new Promise(() => {}));
    render(<ConceptRender vehicle={vehicle} />);
    openDialog();

    expect(requestConceptRenderMock).toHaveBeenCalledWith(
      {
        vehicleSlug: "apex-gt",
        singleSelections: { PAINT: "paint-red", WHEELS: "wheels-sport" },
        multiSelections: { ACCESSORY: ["acc-1"], PACKAGE: [] },
        customPaintHex: null,
      },
      expect.any(AbortSignal),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Imagining the ultimate version…");
    expectLabeledAndNotApplicable();
  });

  it("shows the image, unmistakably labeled, with no Apply action (AC-2, AC-3)", async () => {
    requestConceptRenderMock.mockResolvedValue({ imageUrl: IMAGE, isPlaceholder: false });
    render(<ConceptRender vehicle={vehicle} />);
    openDialog();

    const image = await screen.findByRole("img", { name: "AI concept image imagining a more extreme Apex GT — not a real configuration" });
    expect(image).toHaveAttribute("src", IMAGE);
    expectLabeledAndNotApplicable();
    expect(screen.getByRole("dialog")).toHaveAccessibleDescription(/can't be ordered or applied/);
    expect(within(screen.getByRole("dialog")).getByText("AI Concept")).toBeInTheDocument(); // on the image
    expect(screen.queryByText(/Development placeholder/)).not.toBeInTheDocument();
  });

  it("says so when the image is the development placeholder", async () => {
    requestConceptRenderMock.mockResolvedValue({ imageUrl: "data:image/svg+xml;base64,PHN2Zy8+", isPlaceholder: true });
    render(<ConceptRender vehicle={vehicle} />);
    openDialog();
    expect(await screen.findByText("Development placeholder — no image provider is connected yet.")).toBeInTheDocument();
    expectLabeledAndNotApplicable();
  });

  it("explains a failure and lets the user try again (AC-4)", async () => {
    requestConceptRenderMock
      .mockRejectedValueOnce(new MockApiRequestError("IMAGE_PROVIDER_ERROR", "raw"))
      .mockResolvedValueOnce({ imageUrl: IMAGE, isPlaceholder: false });
    render(<ConceptRender vehicle={vehicle} />);
    openDialog();

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't generate a concept right now — try again.");
    expectLabeledAndNotApplicable();
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(await screen.findByRole("img")).toHaveAttribute("src", IMAGE);
    expect(requestConceptRenderMock).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["CONCEPT_RENDER_DAILY_LIMIT", "Today's concept renders are used up. Try again tomorrow."],
    ["RATE_LIMITED", "Too many requests. Please wait a moment and try again."],
    ["CONCEPT_RENDERS_DISABLED", "Concept renders aren't available right now."],
  ])("says why it couldn't generate (%s)", async (code, message) => {
    requestConceptRenderMock.mockRejectedValue(new MockApiRequestError(code, "raw"));
    render(<ConceptRender vehicle={vehicle} />);
    openDialog();
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("a network failure gets the AC-4 message", async () => {
    requestConceptRenderMock.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<ConceptRender vehicle={vehicle} />);
    openDialog();
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't generate a concept right now — try again.");
  });

  it("closing cancels the request, ignores a late answer, and returns focus to the button", async () => {
    const pending = deferred<{ imageUrl: string; isPlaceholder: boolean }>();
    requestConceptRenderMock.mockReturnValue(pending.promise);
    render(<ConceptRender vehicle={vehicle} />);
    openDialog();
    const signal = requestConceptRenderMock.mock.calls[0][1] as AbortSignal;

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(signal.aborted).toBe(true);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await act(async () => pending.resolve({ imageUrl: IMAGE, isPlaceholder: false }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Imagine the Ultimate Version" })).toHaveFocus();
  });

  it("Escape closes it", async () => {
    requestConceptRenderMock.mockResolvedValue({ imageUrl: IMAGE, isPlaceholder: false });
    render(<ConceptRender vehicle={vehicle} />);
    openDialog();
    await screen.findByRole("img");
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

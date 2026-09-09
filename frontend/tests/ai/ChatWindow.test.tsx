import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { useCarAiChatStore } from "../../src/state/carAiChatStore";
import { ALL_CATEGORIES } from "../../src/types/catalog";
import type { CustomizationOptionDto, OptionCategory, VehicleDetailDto } from "../../src/types/catalog";

const { ChatWindow } = await import("../../src/components/ai/ChatWindow/ChatWindow");

function makeVehicle(): VehicleDetailDto {
  const options = Object.fromEntries(ALL_CATEGORIES.map((category) => [category, []])) as unknown as Record<
    OptionCategory,
    CustomizationOptionDto[]
  >;

  return {
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
    options,
  };
}

function renderChatWindow(buttonRef = { current: document.createElement("button") }) {
  return render(<ChatWindow vehicle={makeVehicle()} buttonRef={buttonRef} />);
}

describe("ChatWindow (Spec 15)", () => {
  beforeEach(() => {
    useCarAiChatStore.setState({ vehicleSlug: "apex-gt", messages: [], isOpen: false, isLoading: false });
  });

  it("renders nothing when closed", () => {
    renderChatWindow();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows an empty-state greeting with example prompts when open with no messages (§5 Empty state)", () => {
    useCarAiChatStore.setState({ isOpen: true });
    renderChatWindow();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Make it sportier/)).toBeInTheDocument();
  });

  it("shows the loading indicator and disables the input while a request is in flight (AC-4)", () => {
    useCarAiChatStore.setState({ isOpen: true, isLoading: true });
    renderChatWindow();

    expect(screen.getByText("CarAI is thinking…")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Ask CarAI/)).toBeDisabled();
  });

  it("renders user and assistant messages in order (AC-3)", () => {
    useCarAiChatStore.setState({
      isOpen: true,
      messages: [
        { id: "1", role: "user", content: "Make it sportier" },
        { id: "2", role: "assistant", content: "Here's a sportier build." },
      ],
    });
    renderChatWindow();

    const bubbles = screen.getAllByText(/Make it sportier|Here's a sportier build\./);
    expect(bubbles[0]).toHaveTextContent("Make it sportier");
    expect(bubbles[1]).toHaveTextContent("Here's a sportier build.");
  });

  it("renders an inline error bubble for a system-error message, without clearing prior history (AC-8)", () => {
    useCarAiChatStore.setState({
      isOpen: true,
      messages: [
        { id: "1", role: "user", content: "hello" },
        {
          id: "2",
          role: "system-error",
          content: "CarAI is temporarily unavailable. You can continue configuring manually.",
        },
      ],
    });
    renderChatWindow();

    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText(/temporarily unavailable/)).toBeInTheDocument();
  });

  it("renders a recommendation card with the resolved option name and price when recommendation is non-null (AC-5)", () => {
    useCarAiChatStore.setState({
      isOpen: true,
      messages: [
        {
          id: "1",
          role: "assistant",
          content: "Here's a build.",
          recommendation: { singleSelections: { WHEELS: "wheels-alt" }, multiSelections: {} },
          breakdown: {
            vehicleSlug: "apex-gt",
            basePriceCents: 8_500_000,
            lineItems: [{ optionId: "wheels-alt", category: "WHEELS", name: "Sport Wheels", priceDeltaCents: 200_000 }],
            totalPriceCents: 8_700_000,
            currency: "EUR",
          },
        },
      ],
    });
    renderChatWindow();

    expect(screen.getByText("Sport Wheels")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply Configuration" })).toBeInTheDocument();
  });

  it("does not render a recommendation card or Apply button when recommendation is null (AC-6)", () => {
    useCarAiChatStore.setState({
      isOpen: true,
      messages: [{ id: "1", role: "assistant", content: "No changes needed for that." }],
    });
    renderChatWindow();

    expect(screen.queryByRole("button", { name: "Apply Configuration" })).not.toBeInTheDocument();
  });

  it("focus lands in the message input when opened (AC-10)", async () => {
    useCarAiChatStore.setState({ isOpen: true });
    renderChatWindow();

    await waitFor(() => expect(screen.getByPlaceholderText(/Ask CarAI/)).toHaveFocus());
  });

  it("Escape closes the window and returns focus to the floating toggle button (AC-10)", async () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    useCarAiChatStore.setState({ isOpen: true });
    renderChatWindow({ current: button });

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(useCarAiChatStore.getState().isOpen).toBe(false));
    expect(button).toHaveFocus();

    document.body.removeChild(button);
  });

  it("disables Send until the draft has non-whitespace content, and it's operable via a normal click", () => {
    useCarAiChatStore.setState({ isOpen: true });
    renderChatWindow();

    const sendButton = screen.getByRole("button", { name: "Send" });
    expect(sendButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(/Ask CarAI/), { target: { value: "Make it sportier" } });
    expect(sendButton).not.toBeDisabled();
  });
});

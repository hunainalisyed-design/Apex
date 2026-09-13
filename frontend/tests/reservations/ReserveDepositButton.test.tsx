import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedConfigurationDto } from "../../src/types/configuration";

const createCheckoutSessionMock = vi.fn();
vi.mock("../../src/lib/api/reservations", () => ({
  createCheckoutSession: (...args: unknown[]) => createCheckoutSessionMock(...args),
}));

const { ReserveDepositButton } = await import("../../src/components/reservations/ReserveDepositButton");
const { useConfigurationStore } = await import("../../src/state/configurationStore");
const { ApiRequestError } = await import("../../src/lib/api/configurations");

const SAVED: SavedConfigurationDto = {
  publicId: "APEX-AAAA-BBBB",
  vehicleSlug: "apex-gt",
  singleSelections: {} as SavedConfigurationDto["singleSelections"],
  multiSelections: { ACCESSORY: [], PACKAGE: [] },
  customPaintHex: null,
  breakdown: {
    vehicleSlug: "apex-gt",
    basePriceCents: 8500000,
    lineItems: [],
    totalPriceCents: 8500000,
    currency: "EUR",
  },
  createdAt: "2026-01-01T00:00:00.000Z",
  ownerId: null,
};

function resetConfigStore(overrides: Partial<ReturnType<typeof useConfigurationStore.getState>> = {}) {
  useConfigurationStore.setState({
    savedConfiguration: SAVED,
    isDirtySinceLastSave: () => false,
    save: vi.fn(),
    ...overrides,
  });
}

// jsdom doesn't implement real navigation — window.location.href is a plain assignable
// property there, so this simply records the last value assigned instead of erroring.
function captureLocationHref(): { value: string | undefined } {
  const captured: { value: string | undefined } = { value: undefined };
  Object.defineProperty(window, "location", {
    configurable: true,
    value: {
      ...window.location,
      set href(v: string) {
        captured.value = v;
      },
      get href() {
        return captured.value ?? "";
      },
    },
  });
  return captured;
}

describe("ReserveDepositButton (Spec 20, AC-1/AC-2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetConfigStore();
    delete process.env.NEXT_PUBLIC_RESERVATIONS_ENABLED;
  });

  it("does not render when the feature flag is disabled", async () => {
    // RESERVATIONS_ENABLED is read once at module scope (mirrors CarAIAssistant.tsx's own
    // NEXT_PUBLIC_AI_ASSISTANT_ENABLED pattern), so the flag must be set before this module
    // is (re-)imported, not just before render.
    vi.resetModules();
    process.env.NEXT_PUBLIC_RESERVATIONS_ENABLED = "false";
    const { ReserveDepositButton: DisabledButton } = await import(
      "../../src/components/reservations/ReserveDepositButton"
    );

    const { container } = render(<DisabledButton />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the unmissable test-mode disclosure before anything is charged or saved (AC-1)", () => {
    render(<ReserveDepositButton />);
    fireEvent.click(screen.getByRole("button", { name: "Reserve with Deposit" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Test Mode — No Real Payment")).toBeInTheDocument();
    expect(screen.getByText(/no real payment will be processed/i)).toBeInTheDocument();
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("is a real accessible dialog, closable via Cancel", () => {
    render(<ReserveDepositButton />);
    fireEvent.click(screen.getByRole("button", { name: "Reserve with Deposit" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("creates a checkout session for an already-saved build and navigates to Stripe (AC-2)", async () => {
    const captured = captureLocationHref();
    createCheckoutSessionMock.mockResolvedValueOnce({ checkoutUrl: "https://checkout.stripe.com/mock/cs_test" });

    render(<ReserveDepositButton />);
    fireEvent.click(screen.getByRole("button", { name: "Reserve with Deposit" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Stripe Checkout (Test Mode)" }));

    await waitFor(() => expect(captured.value).toBe("https://checkout.stripe.com/mock/cs_test"));
    expect(createCheckoutSessionMock).toHaveBeenCalledWith({ configurationPublicId: "APEX-AAAA-BBBB" });
  });

  it("saves first when the build is dirty, then creates the checkout session (save-if-dirty pattern)", async () => {
    captureLocationHref();
    const saveMock = vi.fn().mockImplementation(async () => {
      useConfigurationStore.setState({ savedConfiguration: SAVED });
      return SAVED;
    });
    resetConfigStore({ isDirtySinceLastSave: () => true, save: saveMock });
    createCheckoutSessionMock.mockResolvedValueOnce({ checkoutUrl: "https://checkout.stripe.com/mock/cs_dirty" });

    render(<ReserveDepositButton />);
    fireEvent.click(screen.getByRole("button", { name: "Reserve with Deposit" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Stripe Checkout (Test Mode)" }));

    await waitFor(() => expect(createCheckoutSessionMock).toHaveBeenCalledTimes(1));
    expect(saveMock).toHaveBeenCalledTimes(1);
  });

  it("shows its own inline error when the save-if-dirty save fails, without ever creating a checkout session", async () => {
    const saveMock = vi.fn().mockRejectedValue(new ApiRequestError("VALIDATION_ERROR", "nope"));
    resetConfigStore({ isDirtySinceLastSave: () => true, save: saveMock });

    render(<ReserveDepositButton />);
    fireEvent.click(screen.getByRole("button", { name: "Reserve with Deposit" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Stripe Checkout (Test Mode)" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("alert")).toHaveTextContent("Something about this build isn't valid");
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("shows the mapped error when checkout-session creation fails (e.g. PAYMENT_PROVIDER_ERROR)", async () => {
    createCheckoutSessionMock.mockRejectedValueOnce(new ApiRequestError("PAYMENT_PROVIDER_ERROR", "nope"));

    render(<ReserveDepositButton />);
    fireEvent.click(screen.getByRole("button", { name: "Reserve with Deposit" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Stripe Checkout (Test Mode)" }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("We couldn't start checkout. Please try again in a moment."),
    );
  });

  it("shows a generic error and never navigates when there is no saved configuration to reserve", async () => {
    resetConfigStore({ savedConfiguration: null });

    render(<ReserveDepositButton />);
    fireEvent.click(screen.getByRole("button", { name: "Reserve with Deposit" }));
    fireEvent.click(screen.getByRole("button", { name: "Continue to Stripe Checkout (Test Mode)" }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });
});

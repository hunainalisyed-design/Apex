import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReservationDto } from "../../src/types/reservations";

const getReservationMock = vi.fn();
vi.mock("../../src/lib/api/reservations", () => ({
  getReservation: (id: string) => getReservationMock(id),
  createCheckoutSession: vi.fn(),
}));

const { ReservationConfirmation } = await import("../../src/components/reservations/ReservationConfirmation");
const { useReservationConfirmationStore } = await import("../../src/state/reservationConfirmationStore");

function makeReservation(overrides: Partial<ReservationDto> = {}): ReservationDto {
  return {
    id: "res_1",
    configurationPublicId: "APEX-AAAA-BBBB",
    vehicleSlug: "apex-gt",
    amountCents: 50000,
    currency: "EUR",
    status: "PENDING",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ReservationConfirmation (Spec 20, AC-4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useReservationConfirmationStore.setState({ status: "loading", reservation: null, errorMessage: null });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a loading state before the reservation resolves", () => {
    getReservationMock.mockReturnValue(new Promise(() => {}));
    render(<ReservationConfirmation id="res_1" />);
    expect(screen.getByText(/loading your reservation/i)).toBeInTheDocument();
  });

  it("renders the PAID confirmation with the deposit amount and a link back to the build", async () => {
    getReservationMock.mockResolvedValue(makeReservation({ status: "PAID" }));
    render(<ReservationConfirmation id="res_1" />);

    await waitFor(() => expect(screen.getByText("You're all set")).toBeInTheDocument());
    expect(screen.getByText(/€500/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Configurator" })).toHaveAttribute(
      "href",
      "/configure/apex-gt?build=APEX-AAAA-BBBB",
    );
  });

  it("renders the FAILED state", async () => {
    getReservationMock.mockResolvedValue(makeReservation({ status: "FAILED" }));
    render(<ReservationConfirmation id="res_1" />);

    await waitFor(() => expect(screen.getByText("Something went wrong")).toBeInTheDocument());
  });

  it("renders the REFUNDED state", async () => {
    getReservationMock.mockResolvedValue(makeReservation({ status: "REFUNDED" }));
    render(<ReservationConfirmation id="res_1" />);

    await waitFor(() => expect(screen.getByText("This reservation was refunded")).toBeInTheDocument());
  });

  it("polls a PENDING reservation, then falls back to an honest message after the max attempts (AC-4)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getReservationMock.mockResolvedValue(makeReservation({ status: "PENDING" }));

    render(<ReservationConfirmation id="res_1" />);

    await vi.waitFor(() => expect(screen.getByText("Almost there")).toBeInTheDocument());
    expect(screen.getByText(/confirming your payment/i)).toBeInTheDocument();

    // 5 poll attempts at 2s each — advance past all of them.
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
    }

    expect(getReservationMock).toHaveBeenCalledTimes(6); // initial load + 5 polls
    expect(screen.getByText(/taking longer than expected/i)).toBeInTheDocument();
  });

  it("shows an error state with retry when the fetch fails", async () => {
    getReservationMock.mockRejectedValueOnce(new Error("network error"));
    render(<ReservationConfirmation id="res_1" />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument());

    getReservationMock.mockResolvedValueOnce(makeReservation({ status: "PAID" }));
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("You're all set")).toBeInTheDocument());
  });
});

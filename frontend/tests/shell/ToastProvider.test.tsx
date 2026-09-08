import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "../../src/components/shell/ToastProvider";

function ToastTrigger() {
  const { show } = useToast();
  return (
    <>
      <button type="button" onClick={() => show("Configuration saved")}>
        Show polite
      </button>
      <button type="button" onClick={() => show("Something failed", "assertive")}>
        Show assertive
      </button>
    </>
  );
}

function renderWithProvider() {
  return render(
    <ToastProvider>
      <ToastTrigger />
    </ToastProvider>,
  );
}

describe("ToastProvider / useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("throws when useToast is called outside a provider", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ToastTrigger />)).toThrow("useToast must be used within a ToastProvider");
    consoleErrorSpy.mockRestore();
  });

  it("show() renders a toast in the polite aria-live region by default", () => {
    renderWithProvider();
    fireEvent.click(screen.getByRole("button", { name: "Show polite" }));

    const toast = screen.getByText("Configuration saved");
    expect(toast).toBeInTheDocument();
    expect(toast.closest('[aria-live="polite"]')).not.toBeNull();
  });

  it("show(message, 'assertive') renders in the assertive aria-live region (Spec 12 AC-8)", () => {
    renderWithProvider();
    fireEvent.click(screen.getByRole("button", { name: "Show assertive" }));

    const toast = screen.getByText("Something failed");
    expect(toast.closest('[aria-live="assertive"]')).not.toBeNull();
  });

  it("auto-dismisses after the toast duration", () => {
    renderWithProvider();
    fireEvent.click(screen.getByRole("button", { name: "Show polite" }));
    expect(screen.getByText("Configuration saved")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(screen.queryByText("Configuration saved")).not.toBeInTheDocument();
  });

  it("is manually dismissible via its dismiss button", () => {
    renderWithProvider();
    fireEvent.click(screen.getByRole("button", { name: "Show polite" }));

    fireEvent.click(screen.getByRole("button", { name: "Dismiss notification" }));

    expect(screen.queryByText("Configuration saved")).not.toBeInTheDocument();
  });
});

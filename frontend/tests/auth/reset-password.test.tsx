import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const resetPasswordMock = vi.fn();
const searchParamsMock = vi.fn(() => new URLSearchParams());

class MockApiRequestError extends Error {
  code: string;
  details?: Record<string, string[]>;
  constructor(code: string, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.details = details;
  }
}

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsMock(),
}));
vi.mock("../../src/lib/api/auth", () => ({
  resetPassword: (...args: unknown[]) => resetPasswordMock(...args),
}));
vi.mock("../../src/lib/api/configurations", () => ({
  ApiRequestError: MockApiRequestError,
}));

const { default: ResetPasswordPage } = await import("../../src/app/(auth)/reset-password/page");
const { useAuthStore } = await import("../../src/state/authStore");

const INITIAL_STATE = { user: null, hydrated: false, isLoading: false, details: null, errorCode: null };

describe("ResetPasswordPage (Spec 16)", () => {
  beforeEach(() => {
    resetPasswordMock.mockReset();
    useAuthStore.setState(INITIAL_STATE);
    searchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("shows an invalid-link message when the URL has no ?token=", () => {
    render(<ResetPasswordPage />);
    expect(screen.getByText(/Invalid reset link/)).toBeInTheDocument();
  });

  it("with a fixture token, rejects a weak new password client-side before calling the API", () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("token=fixture-token-123"));

    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(screen.getByText(/at least 8 characters/)).toBeInTheDocument();
    expect(resetPasswordMock).not.toHaveBeenCalled();
  });

  it("with a valid fixture token and a strong password, submits and shows the success state", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("token=fixture-token-123"));
    resetPasswordMock.mockResolvedValueOnce({ message: "Your password has been updated." });

    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpassword1" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => expect(screen.getByText(/Password updated/)).toBeInTheDocument());
    expect(resetPasswordMock).toHaveBeenCalledWith({ token: "fixture-token-123", newPassword: "newpassword1" });
  });

  it("shows INVALID_OR_EXPIRED_TOKEN as a form-level banner when the token is rejected server-side", async () => {
    searchParamsMock.mockReturnValue(new URLSearchParams("token=stale-token"));
    resetPasswordMock.mockRejectedValueOnce(
      new MockApiRequestError("INVALID_OR_EXPIRED_TOKEN", "This reset link is invalid or has expired."),
    );

    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "newpassword1" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/);
  });
});

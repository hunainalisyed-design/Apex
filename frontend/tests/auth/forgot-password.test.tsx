import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const forgotPasswordMock = vi.fn();

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

vi.mock("../../src/lib/api/auth", () => ({
  forgotPassword: (...args: unknown[]) => forgotPasswordMock(...args),
}));
vi.mock("../../src/lib/api/configurations", () => ({
  ApiRequestError: MockApiRequestError,
}));

const { default: ForgotPasswordPage } = await import("../../src/app/(auth)/forgot-password/page");
const { useAuthStore } = await import("../../src/state/authStore");

const INITIAL_STATE = { user: null, hydrated: false, isLoading: false, details: null, errorCode: null };
const GENERIC_MESSAGE = "If an account exists for that email, we've sent a link to reset your password.";

describe("ForgotPasswordPage (Spec 16)", () => {
  beforeEach(() => {
    forgotPasswordMock.mockReset();
    useAuthStore.setState(INITIAL_STATE);
  });

  it("rejects an invalid email client-side without calling the API", () => {
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "not-an-email" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(screen.getByText(/valid email/)).toBeInTheDocument();
    expect(forgotPasswordMock).not.toHaveBeenCalled();
  });

  it("shows the identical generic confirmation for a registered email (AC-6)", async () => {
    forgotPasswordMock.mockResolvedValueOnce({ message: GENERIC_MESSAGE });

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bob@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(screen.getByText(/Check your email/)).toBeInTheDocument());
  });

  it("shows the identical generic confirmation for an unregistered email — no enumeration (AC-6)", async () => {
    forgotPasswordMock.mockResolvedValueOnce({ message: GENERIC_MESSAGE });

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "nobody@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(screen.getByText(/Check your email/)).toBeInTheDocument());
  });

  it("shows a form-level banner if the request itself fails", async () => {
    forgotPasswordMock.mockRejectedValueOnce(new MockApiRequestError("VALIDATION_ERROR", "raw"));

    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bob@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });
});

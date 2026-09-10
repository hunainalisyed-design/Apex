import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signupMock = vi.fn();

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
  signup: (...args: unknown[]) => signupMock(...args),
}));
vi.mock("../../src/lib/api/configurations", () => ({
  ApiRequestError: MockApiRequestError,
}));

const { default: SignupPage } = await import("../../src/app/(auth)/signup/page");
const { useAuthStore } = await import("../../src/state/authStore");

const INITIAL_STATE = { user: null, hydrated: false, isLoading: false, details: null, errorCode: null };

describe("SignupPage (Spec 16)", () => {
  beforeEach(() => {
    signupMock.mockReset();
    useAuthStore.setState(INITIAL_STATE);
  });

  function fillValidForm() {
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alice Apex" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "alicepass1" } });
    fireEvent.click(screen.getByRole("checkbox"));
  }

  it("every field is reachable by its accessible label (AC-12)", () => {
    render(<SignupPage />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows client-side validation errors and never calls the API when the form is invalid", () => {
    render(<SignupPage />);
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(signupMock).not.toHaveBeenCalled();
  });

  it("rejects a weak password client-side before ever hitting the network", () => {
    render(<SignupPage />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Alice" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(screen.getByText(/at least 8 characters/)).toBeInTheDocument();
    expect(signupMock).not.toHaveBeenCalled();
  });

  it("submits and reflects the loading state while the request is in flight", async () => {
    let resolveSignup: (u: unknown) => void = () => {};
    signupMock.mockReturnValueOnce(new Promise((resolve) => (resolveSignup = resolve)));

    render(<SignupPage />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(await screen.findByRole("button", { name: "Creating account…" })).toBeDisabled();

    resolveSignup({ id: "u1", name: "Alice Apex", email: "alice@example.com", createdAt: "2026-01-01T00:00:00.000Z" });
    await waitFor(() => expect(useAuthStore.getState().user?.email).toBe("alice@example.com"));
  });

  it("shows EMAIL_ALREADY_REGISTERED inline near the email field, not as a form-level banner (AC-2)", async () => {
    signupMock.mockRejectedValueOnce(
      new MockApiRequestError("EMAIL_ALREADY_REGISTERED", "An account with this email already exists.", {
        email: ["An account with this email already exists."],
      }),
    );

    render(<SignupPage />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(await screen.findByText("An account with this email already exists.")).toBeInTheDocument();
    // Field-specific details suppress the redundant form-level banner (Spec 16's
    // ApiError.details resolution).
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows a form-level banner for an error without field-specific details", async () => {
    signupMock.mockRejectedValueOnce(new MockApiRequestError("SOME_OTHER_ERROR", "raw backend message"));

    render(<SignupPage />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    const banner = await screen.findByRole("alert");
    // The raw backend message is never shown, per this app's getErrorMessage convention.
    expect(banner).not.toHaveTextContent("raw backend message");
  });
});

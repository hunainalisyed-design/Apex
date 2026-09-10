import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loginMock = vi.fn();

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
  login: (...args: unknown[]) => loginMock(...args),
}));
vi.mock("../../src/lib/api/configurations", () => ({
  ApiRequestError: MockApiRequestError,
}));

const { default: LoginPage } = await import("../../src/app/(auth)/login/page");
const { useAuthStore } = await import("../../src/state/authStore");

const INITIAL_STATE = { user: null, hydrated: false, isLoading: false, details: null, errorCode: null };

describe("LoginPage (Spec 16)", () => {
  beforeEach(() => {
    loginMock.mockReset();
    useAuthStore.setState(INITIAL_STATE);
  });

  it("every field is reachable by its accessible label (AC-12)", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows client-side validation and never calls the API for an empty form", () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(screen.getByText("Email is required.")).toBeInTheDocument();
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("logs in successfully and updates authStore's user", async () => {
    loginMock.mockResolvedValueOnce({ id: "u1", name: "Alice", email: "alice@example.com", createdAt: "2026-01-01T00:00:00.000Z" });

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "alicepass1" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    await waitFor(() => expect(useAuthStore.getState().user?.email).toBe("alice@example.com"));
  });

  it("shows a generic form-level banner for INVALID_CREDENTIALS — never attributing the error to a specific field (AC-3)", async () => {
    loginMock.mockRejectedValueOnce(new MockApiRequestError("INVALID_CREDENTIALS", "Incorrect email or password."));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrongpassword1" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Incorrect email or password.");
  });

  it("shows a rate-limit banner for TOO_MANY_ATTEMPTS (AC-5)", async () => {
    loginMock.mockRejectedValueOnce(new MockApiRequestError("TOO_MANY_ATTEMPTS", "Too many login attempts."));

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrongpassword1" } });
    fireEvent.click(screen.getByRole("button", { name: "Log In" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/too many attempts/i);
  });
});

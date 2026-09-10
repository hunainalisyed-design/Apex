import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const updateProfileMock = vi.fn();
const changePasswordMock = vi.fn();

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

vi.mock("../../src/lib/api/me", () => ({
  getMyConfigurations: vi.fn(),
  updateProfile: (...args: unknown[]) => updateProfileMock(...args),
  changePassword: (...args: unknown[]) => changePasswordMock(...args),
}));
vi.mock("../../src/lib/api/configurations", () => ({
  ApiRequestError: MockApiRequestError,
}));
vi.mock("../../src/lib/api/auth", () => ({
  signup: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  getMe: vi.fn(),
  forgotPassword: vi.fn(),
  resetPassword: vi.fn(),
}));

const { ProfileSection } = await import("../../src/components/garage/ProfileSection/ProfileSection");
const { useAuthStore } = await import("../../src/state/authStore");
const { ToastProvider } = await import("../../src/components/shell/ToastProvider");

const BASE_USER = { id: "u1", name: "Original Name", email: "user@example.com", createdAt: "2026-01-01T00:00:00.000Z" };
const RESET_STATE = { user: BASE_USER, hydrated: true, isLoading: false, details: null, errorCode: null };

function renderProfileSection() {
  return render(
    <ToastProvider>
      <ProfileSection />
    </ToastProvider>,
  );
}

describe("ProfileSection (Spec 17, AC-9)", () => {
  beforeEach(() => {
    updateProfileMock.mockReset();
    changePasswordMock.mockReset();
    useAuthStore.setState(RESET_STATE);
  });

  it("updates the name on submit", async () => {
    updateProfileMock.mockResolvedValueOnce({ ...BASE_USER, name: "New Name" });
    renderProfileSection();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "New Name" } });
    fireEvent.click(screen.getByRole("button", { name: "Save Name" }));

    await waitFor(() => expect(updateProfileMock).toHaveBeenCalledWith({ name: "New Name" }));
    await waitFor(() => expect(useAuthStore.getState().user?.name).toBe("New Name"));
  });

  it("rejects an empty name client-side before calling the API", () => {
    renderProfileSection();

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save Name" }));

    expect(screen.getByText("Name is required.")).toBeInTheDocument();
    expect(updateProfileMock).not.toHaveBeenCalled();
  });

  it("rejects a weak new password client-side before calling the API", () => {
    renderProfileSection();

    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "originalpass1" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: "Change Password" }));

    expect(screen.getByText(/at least 8 characters/)).toBeInTheDocument();
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("rejects a mismatched confirm-password field before calling the API", () => {
    renderProfileSection();

    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "originalpass1" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "newpassword1" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "different1" } });
    fireEvent.click(screen.getByRole("button", { name: "Change Password" }));

    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();
    expect(changePasswordMock).not.toHaveBeenCalled();
  });

  it("shows a wrong-current-password error inline under Current Password, not a banner", async () => {
    changePasswordMock.mockRejectedValueOnce(
      new MockApiRequestError("INVALID_CREDENTIALS", "Current password is incorrect.", {
        currentPassword: ["Current password is incorrect."],
      }),
    );
    renderProfileSection();

    fireEvent.change(screen.getByLabelText("Current Password"), { target: { value: "wrongpass1" } });
    fireEvent.change(screen.getByLabelText("New Password"), { target: { value: "newpassword1" } });
    fireEvent.change(screen.getByLabelText("Confirm New Password"), { target: { value: "newpassword1" } });
    fireEvent.click(screen.getByRole("button", { name: "Change Password" }));

    expect(await screen.findByText("Current password is incorrect.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("clears the password fields on a successful change", async () => {
    changePasswordMock.mockResolvedValueOnce({ message: "Password updated." });
    renderProfileSection();

    const current = screen.getByLabelText("Current Password") as HTMLInputElement;
    const next = screen.getByLabelText("New Password") as HTMLInputElement;
    const confirm = screen.getByLabelText("Confirm New Password") as HTMLInputElement;

    fireEvent.change(current, { target: { value: "originalpass1" } });
    fireEvent.change(next, { target: { value: "newpassword1" } });
    fireEvent.change(confirm, { target: { value: "newpassword1" } });
    fireEvent.click(screen.getByRole("button", { name: "Change Password" }));

    await waitFor(() => expect(changePasswordMock).toHaveBeenCalled());
    await waitFor(() => expect(current.value).toBe(""));
    expect(next.value).toBe("");
    expect(confirm.value).toBe("");
  });
});

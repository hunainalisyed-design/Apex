import { beforeEach, describe, expect, it, vi } from "vitest";

const logoutMock = vi.fn();

class MockApiRequestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
  }
}

vi.mock("../../src/lib/api/auth", () => ({
  logout: (...args: unknown[]) => logoutMock(...args),
}));
vi.mock("../../src/lib/api/configurations", () => ({
  ApiRequestError: MockApiRequestError,
}));

const { useAuthStore } = await import("../../src/state/authStore");

const SIGNED_IN = {
  user: { id: "u1", email: "a@example.com", name: "A", role: "USER" },
  hydrated: true,
  isLoading: false,
  details: null,
  errorCode: null,
} as unknown as Parameters<typeof useAuthStore.setState>[0];

describe("logout", () => {
  beforeEach(() => {
    logoutMock.mockReset();
    useAuthStore.setState(SIGNED_IN);
  });

  it("signs the user out", async () => {
    logoutMock.mockResolvedValueOnce(undefined);
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState()).toMatchObject({ user: null, hydrated: true, isLoading: false });
  });

  it("when the server no longer has the session, still signs out — without throwing", async () => {
    logoutMock.mockRejectedValueOnce(new MockApiRequestError("UNAUTHENTICATED", "You must be signed in to do this."));
    await expect(useAuthStore.getState().logout()).resolves.toBeUndefined();
    expect(useAuthStore.getState()).toMatchObject({ user: null, hydrated: true, isLoading: false });
  });

  it("when the network fails, still signs out locally — without throwing", async () => {
    logoutMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(useAuthStore.getState().logout()).resolves.toBeUndefined();
    expect(useAuthStore.getState().user).toBeNull();
  });
});

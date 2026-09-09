import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDefaultVehicleSlug } from "../../src/lib/api/vehicles";

describe("getDefaultVehicleSlug (Spec 13, AC-1)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves the first vehicle's slug from the active-vehicle list", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ slug: "apex-gt" }, { slug: "apex-rs" }] }),
    } as Response);

    await expect(getDefaultVehicleSlug()).resolves.toBe("apex-gt");
  });

  it("falls back to null when the list is empty, so the nav can fall back to /models", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    await expect(getDefaultVehicleSlug()).resolves.toBeNull();
  });

  it("falls back to null on a non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);

    await expect(getDefaultVehicleSlug()).resolves.toBeNull();
  });

  it("falls back to null on a network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network down"));

    await expect(getDefaultVehicleSlug()).resolves.toBeNull();
  });
});

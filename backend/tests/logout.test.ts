import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Logout must succeed even when the server no longer has the session (expired, revoked, or
// wiped): the user is signed out either way, so there's nothing to refuse.
vi.mock("../src/lib/prisma.js", () => ({
  prisma: { session: { deleteMany: vi.fn(), findUnique: vi.fn() } },
}));

const { prisma } = await import("../src/lib/prisma.js");
const { createApp } = await import("../src/app.js");

describe("POST /api/auth/logout", () => {
  beforeEach(() => {
    vi.mocked(prisma.session.deleteMany).mockReset().mockResolvedValue({ count: 0 });
    vi.mocked(prisma.session.findUnique).mockReset().mockResolvedValue(null);
  });

  it("with a session the server no longer has: 204, and the stale cookie is cleared", async () => {
    const res = await request(createApp()).post("/api/auth/logout").set("Cookie", "apex_session=stale-token");
    expect(res.status).toBe(204);
    expect(vi.mocked(prisma.session.deleteMany)).toHaveBeenCalledTimes(1);
    expect(String(res.headers["set-cookie"])).toMatch(/apex_session=;.*Expires=Thu, 01 Jan 1970/);
  });

  it("with no cookie at all: 204, nothing to revoke", async () => {
    const res = await request(createApp()).post("/api/auth/logout");
    expect(res.status).toBe(204);
    expect(vi.mocked(prisma.session.deleteMany)).not.toHaveBeenCalled();
  });
});

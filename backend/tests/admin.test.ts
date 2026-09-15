import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    session: { findUnique: vi.fn() },
    lead: { findMany: vi.fn() },
  },
}));

const { prisma: realPrisma } = await import("../src/lib/prisma.js");
const { createApp } = await import("../src/app.js");

// prisma is fully module-mocked above (no real schema to satisfy), but `await import`
// still resolves types against the real module — re-typing here as plain mock functions
// avoids fighting Prisma's strict, overloaded findUnique signature for a fixture that only
// needs to structurally match what mapUserToDto/validateSession actually read.
const prisma = realPrisma as unknown as {
  session: { findUnique: ReturnType<typeof vi.fn> };
  lead: { findMany: ReturnType<typeof vi.fn> };
};

const FUTURE = new Date(Date.now() + 60_000);

function sessionRow(role: "USER" | "ADMIN") {
  return {
    id: "session-1",
    userId: "user-1",
    tokenHash: "irrelevant-mocked-lookup",
    expiresAt: FUTURE,
    createdAt: new Date(),
    user: {
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      role,
      createdAt: new Date(),
    },
  };
}

describe("requireAdmin (Spec 21)", () => {
  beforeEach(() => {
    prisma.session.findUnique.mockReset();
    prisma.lead.findMany.mockReset();
  });

  it("returns a generic 404 — not 401 — when the caller has no session at all", async () => {
    prisma.session.findUnique.mockResolvedValueOnce(null);

    const res = await request(createApp()).get("/api/admin/leads").set("Cookie", "apex_session=none");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("returns a generic 404 — not 403 — when the caller is signed in but not an ADMIN", async () => {
    prisma.session.findUnique.mockResolvedValueOnce(sessionRow("USER"));

    const res = await request(createApp()).get("/api/admin/leads").set("Cookie", "apex_session=user-token");

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("NOT_FOUND");
  });

  it("returns the same 404 shape for no-session and wrong-role, so neither leaks which case it was", async () => {
    prisma.session.findUnique.mockResolvedValueOnce(null);
    const signedOut = await request(createApp()).get("/api/admin/leads").set("Cookie", "apex_session=none");

    prisma.session.findUnique.mockResolvedValueOnce(sessionRow("USER"));
    const wrongRole = await request(createApp()).get("/api/admin/leads").set("Cookie", "apex_session=user-token");

    expect(signedOut.status).toBe(wrongRole.status);
    expect(signedOut.body).toEqual(wrongRole.body);
  });

  it("lets the request through when the caller is an ADMIN", async () => {
    prisma.session.findUnique.mockResolvedValueOnce(sessionRow("ADMIN"));
    prisma.lead.findMany.mockResolvedValueOnce([]);

    const res = await request(createApp()).get("/api/admin/leads").set("Cookie", "apex_session=admin-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: [] });
  });
});

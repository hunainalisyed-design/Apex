import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/prisma.js", () => ({
  prisma: { $queryRaw: vi.fn() },
}));

const { prisma } = await import("../src/lib/prisma.js");
const { createApp } = await import("../src/app.js");

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.mocked(prisma.$queryRaw).mockReset();
  });

  it("returns 200 connected when the database is reachable", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await request(createApp()).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", database: "connected" });
    expect(typeof res.body.uptimeSeconds).toBe("number");
  });

  it("returns 503 degraded when the database is unreachable, without throwing", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("connection refused"));

    const res = await request(createApp()).get("/api/health");

    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ status: "degraded", database: "unreachable" });
  });
});

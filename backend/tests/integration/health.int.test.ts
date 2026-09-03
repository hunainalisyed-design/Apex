import "dotenv/config";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";

// Requires a real Postgres instance reachable via DATABASE_URL (see docker-compose.yml).
// The "unreachable" branch (AC-3) is covered by the mocked unit test instead — forcing a
// genuine connection failure on the shared Prisma singleton mid-test isn't practical without
// restructuring the app for DI, which this simple health endpoint doesn't warrant.
describe("GET /api/health (integration)", () => {
  it("returns 200 connected against a real database", async () => {
    const res = await request(createApp()).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", database: "connected" });
  });
});

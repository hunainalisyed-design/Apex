import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Express 4 doesn't forward a rejected async handler to the error middleware: before these
// routes were wrapped in asyncHandler, one database error (e.g. Postgres still starting) was an
// unhandled rejection that crashed the whole backend. Now it's a clean 500 and the server lives.
vi.mock("../src/lib/prisma.js", () => ({
  prisma: { vehicle: { findMany: vi.fn() } },
}));
vi.mock("../src/services/catalog.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/services/catalog.js")>()),
  getVehicleWithOptions: vi.fn(),
}));

const { prisma } = await import("../src/lib/prisma.js");
const { getVehicleWithOptions } = await import("../src/services/catalog.js");
const { createApp } = await import("../src/app.js");

const unreachable = () => new Error("Can't reach database server at `localhost:5432`");

describe("catalog routes when the database fails", () => {
  beforeEach(() => {
    vi.mocked(prisma.vehicle.findMany).mockReset();
    vi.mocked(getVehicleWithOptions).mockReset();
  });

  it("GET /api/vehicles answers 500, not a crash", async () => {
    vi.mocked(prisma.vehicle.findMany).mockRejectedValueOnce(unreachable());
    const res = await request(createApp()).get("/api/vehicles");
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL_ERROR");
  });

  it.each(["/api/vehicles/apex-gt", "/api/vehicles/apex-gt/options"])("GET %s answers 500, not a crash", async (path) => {
    vi.mocked(getVehicleWithOptions).mockRejectedValueOnce(unreachable());
    const res = await request(createApp()).get(path);
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL_ERROR");
  });
});

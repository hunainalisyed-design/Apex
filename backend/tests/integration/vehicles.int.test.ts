import "dotenv/config";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { seedDatabase } from "../../prisma/seed.js";

describe("Vehicle catalog endpoints (integration)", () => {
  beforeAll(async () => {
    await seedDatabase(prisma);
  }, 30000);

  it("GET /api/vehicles returns both seeded vehicles (AC-1)", async () => {
    const res = await request(createApp()).get("/api/vehicles");

    expect(res.status).toBe(200);
    const slugs = res.body.data.map((v: { slug: string }) => v.slug).sort();
    expect(slugs).toEqual(["apex-gt", "apex-rs"]);

    const gt = res.body.data.find((v: { slug: string }) => v.slug === "apex-gt");
    expect(gt).toMatchObject({ name: "Apex GT", basePriceCents: 8_500_000 });
  });

  it("GET /api/vehicles/:slug returns the full option catalog grouped by category (AC-2)", async () => {
    const res = await request(createApp()).get("/api/vehicles/apex-gt");

    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe("apex-gt");
    expect(res.body.data.options.PAINT.length).toBeGreaterThanOrEqual(6);
    expect(res.body.data.options.PAINT[0]).toHaveProperty("priceDeltaCents");
    expect(res.body.data.options.PAINT[0]).toHaveProperty("assetRef");
  });

  it("GET /api/vehicles/:slug returns 404 VEHICLE_NOT_FOUND for an unknown slug (AC-3)", async () => {
    const res = await request(createApp()).get("/api/vehicles/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ code: "VEHICLE_NOT_FOUND" });
  });

  it("GET /api/vehicles/:slug/options returns a flat option list", async () => {
    const res = await request(createApp()).get("/api/vehicles/apex-rs/options");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(50);
  });
});

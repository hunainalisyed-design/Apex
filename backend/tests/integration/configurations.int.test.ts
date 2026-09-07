import "dotenv/config";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { seedDatabase } from "../../prisma/seed.js";
import { SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog.js";

const PUBLIC_ID_FORMAT = /^[A-Z]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

async function defaultSelectionsFor(vehicleSlug: string) {
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { slug: vehicleSlug } });
  const options = await prisma.customizationOption.findMany({ where: { vehicleId: vehicle.id } });

  const singleSelections: Record<string, string> = {};
  for (const category of SINGLE_SELECT_CATEGORIES) {
    const option = options.find((o) => o.category === category && o.isDefault);
    singleSelections[category] = option!.id;
  }

  return { vehicle, options, singleSelections };
}

describe("Configurations endpoints (integration)", () => {
  let gt: Awaited<ReturnType<typeof defaultSelectionsFor>>;
  let rs: Awaited<ReturnType<typeof defaultSelectionsFor>>;

  beforeAll(async () => {
    await seedDatabase(prisma);
    gt = await defaultSelectionsFor("apex-gt");
    rs = await defaultSelectionsFor("apex-rs");
  }, 30000);

  it("POST creates a configuration and returns a generated publicId (AC-1)", async () => {
    const res = await request(createApp())
      .post("/api/configurations")
      .send({
        vehicleSlug: "apex-gt",
        singleSelections: gt.singleSelections,
        multiSelections: { ACCESSORY: [], PACKAGE: [] },
        customPaintHex: null,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.publicId).toMatch(PUBLIC_ID_FORMAT);
    expect(res.body.data.breakdown.totalPriceCents).toBe(gt.vehicle.basePriceCents);
  });

  it("returns 404 VEHICLE_NOT_FOUND for an unknown vehicle", async () => {
    const res = await request(createApp())
      .post("/api/configurations")
      .send({
        vehicleSlug: "does-not-exist",
        singleSelections: gt.singleSelections,
        multiSelections: { ACCESSORY: [], PACKAGE: [] },
        customPaintHex: null,
      });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("VEHICLE_NOT_FOUND");
  });

  it("returns 400 VALIDATION_ERROR when a required category is missing", async () => {
    const { PAINT: _omitted, ...incomplete } = gt.singleSelections;

    const res = await request(createApp())
      .post("/api/configurations")
      .send({
        vehicleSlug: "apex-gt",
        singleSelections: incomplete,
        multiSelections: { ACCESSORY: [], PACKAGE: [] },
        customPaintHex: null,
      });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 OPTION_VEHICLE_MISMATCH for an option from a different vehicle", async () => {
    const crossVehicleSelections = { ...gt.singleSelections, PAINT: rs.singleSelections.PAINT };

    const res = await request(createApp())
      .post("/api/configurations")
      .send({
        vehicleSlug: "apex-gt",
        singleSelections: crossVehicleSelections,
        multiSelections: { ACCESSORY: [], PACKAGE: [] },
        customPaintHex: null,
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("OPTION_VEHICLE_MISMATCH");
  });

  it("returns 422 DUPLICATE_OPTION_SELECTION for a repeated accessory id", async () => {
    const accessory = gt.options.find((o) => o.category === "ACCESSORY");

    const res = await request(createApp())
      .post("/api/configurations")
      .send({
        vehicleSlug: "apex-gt",
        singleSelections: gt.singleSelections,
        multiSelections: { ACCESSORY: [accessory!.id, accessory!.id], PACKAGE: [] },
        customPaintHex: null,
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("DUPLICATE_OPTION_SELECTION");
  });

  it("recalculates the total server-side rather than trusting a client-sent value (AC-9)", async () => {
    const wheelsAlt = gt.options.find((o) => o.category === "WHEELS" && !o.isDefault)!;
    const selections = { ...gt.singleSelections, WHEELS: wheelsAlt.id };

    const res = await request(createApp())
      .post("/api/configurations")
      .send({
        vehicleSlug: "apex-gt",
        singleSelections: selections,
        multiSelections: { ACCESSORY: [], PACKAGE: [] },
        customPaintHex: null,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.breakdown.totalPriceCents).toBe(gt.vehicle.basePriceCents + wheelsAlt.priceDeltaCents);
  });

  it("POST then GET returns the exact selections and vehicle, with no data loss (AC-2)", async () => {
    const wheelsAlt = gt.options.find((o) => o.category === "WHEELS" && !o.isDefault)!;
    const accessory = gt.options.find((o) => o.category === "ACCESSORY")!;
    const pkg = gt.options.find((o) => o.category === "PACKAGE")!;
    const selections = { ...gt.singleSelections, WHEELS: wheelsAlt.id };
    const multiSelections = { ACCESSORY: [accessory.id], PACKAGE: [pkg.id] };

    const postRes = await request(createApp()).post("/api/configurations").send({
      vehicleSlug: "apex-gt",
      singleSelections: selections,
      multiSelections,
      customPaintHex: "#ff0000",
    });
    expect(postRes.status).toBe(201);
    const { publicId } = postRes.body.data;

    const getRes = await request(createApp()).get(`/api/configurations/${publicId}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.data.vehicleSlug).toBe("apex-gt");
    expect(getRes.body.data.singleSelections).toEqual(selections);
    expect(getRes.body.data.multiSelections.ACCESSORY).toEqual([accessory.id]);
    expect(getRes.body.data.multiSelections.PACKAGE).toEqual([pkg.id]);
    expect(getRes.body.data.customPaintHex).toBe("#ff0000");
  });

  it("returns 404 CONFIGURATION_NOT_FOUND for an unknown or malformed publicId (AC-3)", async () => {
    const unknown = await request(createApp()).get("/api/configurations/APEX-0000-0000");
    expect(unknown.status).toBe(404);
    expect(unknown.body.code).toBe("CONFIGURATION_NOT_FOUND");

    const malformed = await request(createApp()).get("/api/configurations/not-a-real-id");
    expect(malformed.status).toBe(404);
    expect(malformed.body.code).toBe("CONFIGURATION_NOT_FOUND");
  });

  it("stamps a guest save with expiresAt 90 days out (AC-11)", async () => {
    const res = await request(createApp()).post("/api/configurations").send({
      vehicleSlug: "apex-gt",
      singleSelections: gt.singleSelections,
      multiSelections: { ACCESSORY: [], PACKAGE: [] },
      customPaintHex: null,
    });

    const row = await prisma.configuration.findUniqueOrThrow({ where: { publicId: res.body.data.publicId } });
    const expectedMs = Date.now() + 90 * 24 * 60 * 60 * 1000;
    expect(row.expiresAt).not.toBeNull();
    expect(Math.abs(row.expiresAt!.getTime() - expectedMs)).toBeLessThan(60_000);
  });

  it("refreshes expiresAt to another 90 days out on every GET (AC-11)", async () => {
    const postRes = await request(createApp()).post("/api/configurations").send({
      vehicleSlug: "apex-gt",
      singleSelections: gt.singleSelections,
      multiSelections: { ACCESSORY: [], PACKAGE: [] },
      customPaintHex: null,
    });
    const { publicId } = postRes.body.data;

    // Force it clearly earlier so the refresh assertion isn't a flaky near-now comparison.
    const earlier = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day out
    await prisma.configuration.update({ where: { publicId }, data: { expiresAt: earlier } });

    await request(createApp()).get(`/api/configurations/${publicId}`);

    const refreshed = await prisma.configuration.findUniqueOrThrow({ where: { publicId } });
    const expectedMs = Date.now() + 90 * 24 * 60 * 60 * 1000;
    expect(refreshed.expiresAt!.getTime()).toBeGreaterThan(earlier.getTime());
    expect(Math.abs(refreshed.expiresAt!.getTime() - expectedMs)).toBeLessThan(60_000);
  });
});

import "dotenv/config";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import { prisma } from "../../src/lib/prisma.js";
import { seedDatabase } from "../../prisma/seed.js";
import { SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog.js";

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

describe("POST /api/pricing/calculate (integration)", () => {
  let gt: Awaited<ReturnType<typeof defaultSelectionsFor>>;
  let rs: Awaited<ReturnType<typeof defaultSelectionsFor>>;

  beforeAll(async () => {
    await seedDatabase(prisma);
    gt = await defaultSelectionsFor("apex-gt");
    rs = await defaultSelectionsFor("apex-rs");
  }, 30000);

  it("returns 200 with the correct total for the base configuration", async () => {
    const res = await request(createApp()).post("/api/pricing/calculate").send({
      vehicleSlug: "apex-gt",
      singleSelections: gt.singleSelections,
      multiSelections: { ACCESSORY: [], PACKAGE: [] },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.totalPriceCents).toBe(gt.vehicle.basePriceCents);
    expect(res.body.data.lineItems).toHaveLength(SINGLE_SELECT_CATEGORIES.length);
  });

  it("returns 404 VEHICLE_NOT_FOUND for an unknown vehicle", async () => {
    const res = await request(createApp()).post("/api/pricing/calculate").send({
      vehicleSlug: "does-not-exist",
      singleSelections: gt.singleSelections,
      multiSelections: { ACCESSORY: [], PACKAGE: [] },
    });

    expect(res.status).toBe(404);
    expect(res.body.code).toBe("VEHICLE_NOT_FOUND");
  });

  it("returns 422 OPTION_VEHICLE_MISMATCH for an option from a different vehicle (AC-3)", async () => {
    const crossVehicleSelections = { ...gt.singleSelections, PAINT: rs.singleSelections.PAINT };

    const res = await request(createApp()).post("/api/pricing/calculate").send({
      vehicleSlug: "apex-gt",
      singleSelections: crossVehicleSelections,
      multiSelections: { ACCESSORY: [], PACKAGE: [] },
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("OPTION_VEHICLE_MISMATCH");
  });

  it("returns 400 VALIDATION_ERROR when a required category is missing (AC-4)", async () => {
    const { PAINT: _omitted, ...incomplete } = gt.singleSelections;

    const res = await request(createApp()).post("/api/pricing/calculate").send({
      vehicleSlug: "apex-gt",
      singleSelections: incomplete,
      multiSelections: { ACCESSORY: [], PACKAGE: [] },
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 DUPLICATE_OPTION_SELECTION for a repeated accessory id (AC-5)", async () => {
    const accessory = gt.options.find((o) => o.category === "ACCESSORY");

    const res = await request(createApp()).post("/api/pricing/calculate").send({
      vehicleSlug: "apex-gt",
      singleSelections: gt.singleSelections,
      multiSelections: { ACCESSORY: [accessory!.id, accessory!.id], PACKAGE: [] },
    });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe("DUPLICATE_OPTION_SELECTION");
  });
});

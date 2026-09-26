import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog.js";

const { createApp } = await import("../../src/app.js");
const { prisma } = await import("../../src/lib/prisma.js");
const { seedDatabase } = await import("../../prisma/seed.js");

const FRONTEND_PUBLIC = resolve(import.meta.dirname, "../../../frontend/public");

async function defaultSaveBody(vehicleSlug: string, environmentId?: string | null) {
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { slug: vehicleSlug } });
  const options = await prisma.customizationOption.findMany({ where: { vehicleId: vehicle.id, isDefault: true } });
  const singleSelections = Object.fromEntries(
    SINGLE_SELECT_CATEGORIES.map((category) => [category, options.find((o) => o.category === category)!.id]),
  );
  return {
    vehicleSlug,
    singleSelections,
    multiSelections: { ACCESSORY: [], PACKAGE: [] },
    customPaintHex: null,
    ...(environmentId === undefined ? {} : { environmentId }),
  };
}

describe("Dynamic environments (integration, Spec 28)", () => {
  beforeAll(async () => {
    await seedDatabase(prisma);
  });

  it("lists the four environments in switcher order, Studio first (AC-1)", async () => {
    const res = await request(createApp()).get("/api/environments");
    expect(res.status).toBe(200);
    expect(res.body.data.map((e: { id: string }) => e.id)).toEqual(["studio", "night-city", "coastal-road", "track"]);

    const studio = res.body.data[0];
    expect(studio).toMatchObject({ name: "Studio", isStudio: true, groundHeight: null, groundRadius: null });
    const nightCity = res.body.data[1];
    expect(nightCity.isStudio).toBe(false);
    expect(nightCity.groundHeight).toBeGreaterThan(0);
  });

  it("serves only versioned HDRI/thumbnail URLs whose files exist (Spec 25)", async () => {
    const res = await request(createApp()).get("/api/environments");
    for (const env of res.body.data) {
      for (const url of [env.hdriUrl, env.hdriMobileUrl, env.thumbnailUrl]) {
        expect(url).toMatch(/\.[0-9a-f]{8}\.(hdr|png)$/);
        expect(existsSync(resolve(FRONTEND_PUBLIC, `.${url}`))).toBe(true);
      }
    }
  });

  it("saves the chosen environment with the build and returns it on load (AC-4)", async () => {
    const save = await request(createApp()).post("/api/configurations").send(await defaultSaveBody("porsche-992-gt3-r", "night-city"));
    expect(save.status).toBe(201);
    expect(save.body.data.environmentId).toBe("night-city");

    const load = await request(createApp()).get(`/api/configurations/${save.body.data.publicId}`);
    expect(load.status).toBe(200);
    expect(load.body.data.environmentId).toBe("night-city");
  });

  it("treats an omitted or null environment as the default Studio (backwards compatible)", async () => {
    const omitted = await request(createApp()).post("/api/configurations").send(await defaultSaveBody("apex-gt"));
    expect(omitted.status).toBe(201);
    expect(omitted.body.data.environmentId).toBeNull();

    const explicitNull = await request(createApp()).post("/api/configurations").send(await defaultSaveBody("apex-gt", null));
    expect(explicitNull.status).toBe(201);
    expect(explicitNull.body.data.environmentId).toBeNull();
  });

  it("rejects an unknown environment with a field-level VALIDATION_ERROR", async () => {
    const res = await request(createApp()).post("/api/configurations").send(await defaultSaveBody("apex-gt", "moon-base"));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details.environmentId).toBeDefined();
  });

  it("keeps a shared build loadable if its environment is later removed — it reverts to Studio", async () => {
    await prisma.environment.create({
      data: { id: "temp-env", name: "Temporary", hdriUrl: "/x.00000000.hdr", hdriMobileUrl: "/x.00000000.hdr", thumbnailUrl: "/x.00000000.png" },
    });
    const save = await request(createApp()).post("/api/configurations").send(await defaultSaveBody("apex-gt", "temp-env"));
    expect(save.body.data.environmentId).toBe("temp-env");

    await prisma.environment.delete({ where: { id: "temp-env" } });

    const load = await request(createApp()).get(`/api/configurations/${save.body.data.publicId}`);
    expect(load.status).toBe(200);
    expect(load.body.data.environmentId).toBeNull();
  });
});

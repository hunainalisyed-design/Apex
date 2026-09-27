import "dotenv/config";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

const { createApp } = await import("../../src/app.js");
const { prisma } = await import("../../src/lib/prisma.js");
const { seedDatabase } = await import("../../prisma/seed.js");
const { computeComboRarity } = await import("../../src/services/comboRarity.js");
const { insertBuilds, loadRarityVehicle } = await import("../fixtures/rarityBuilds.js");

type Vehicle = Awaited<ReturnType<typeof loadRarityVehicle>>;

const rarity = (slug: string, query = "") => request(createApp()).get(`/api/vehicles/${slug}/combo-rarity${query}`);

describe("Combo rarity badges (integration, Spec 32)", () => {
  let gt: Vehicle;
  let rs: Vehicle;
  let firstRareBuild: string;
  let secondRareBuild: string;

  beforeAll(async () => {
    await seedDatabase(prisma);
    gt = await loadRarityVehicle(prisma, "apex-gt");
    rs = await loadRarityVehicle(prisma, "apex-rs");
    const [paintA, paintB, paintC] = gt.paints;
    const [wheelsA, wheelsB] = gt.wheels;

    // apex-gt: 100 counted builds.
    //   paintA + wheelsA: 94 — common
    //   paintB + wheelsB: 4  — rare (4%); the earlier of its first two is the "first"
    //   paintC + wheelsA: 2  — rare (2%)
    // Plus 30 EXPIRED paintC + wheelsB builds, which must not count at all.
    const early = new Date("2026-01-01T00:00:00.000Z");
    [firstRareBuild] = await insertBuilds(prisma, gt, paintB, wheelsB, 1, { createdAt: early });
    [secondRareBuild] = await insertBuilds(prisma, gt, paintB, wheelsB, 1, { createdAt: new Date("2026-02-01T00:00:00.000Z") });
    await insertBuilds(prisma, gt, paintB, wheelsB, 2);
    await insertBuilds(prisma, gt, paintA, wheelsA, 94);
    await insertBuilds(prisma, gt, paintC, wheelsA, 2);
    await insertBuilds(prisma, gt, paintC, wheelsB, 30, { expiresAt: new Date("2026-03-01T00:00:00.000Z") });

    // apex-rs: 10 builds — far below the 50-build minimum.
    await insertBuilds(prisma, rs, rs.paints[1], rs.wheels[1], 1);
    await insertBuilds(prisma, rs, rs.paints[0], rs.wheels[0], 9);
  });

  it("before any aggregation run there's nothing to show", async () => {
    const res = await rarity("apex-gt");
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ sampleSize: 0, computedAt: null, rareCombos: [], firstOfKind: false });
  });

  describe("after the aggregation job runs (AC-1)", () => {
    beforeAll(async () => {
      const summary = await computeComboRarity(new Date("2026-09-26T12:00:00.000Z"));
      expect(summary.builds).toBe(110);
    });

    it("stores every pair's count per vehicle, excluding expired builds", async () => {
      const stats = await prisma.comboRarityStat.findMany({ where: { vehicleId: gt.vehicleId } });
      expect(stats.map((s) => s.count).sort((a, b) => a - b)).toEqual([2, 4, 94]);
      expect(new Set(stats.map((s) => s.sampleSize))).toEqual(new Set([100]));
      expect(stats.some((s) => s.paintId === gt.paints[2] && s.wheelsId === gt.wheels[1])).toBe(false);
    });

    it("returns only the rare pairs, with accurate percentages, rarest first (AC-2, AC-4)", async () => {
      const res = await rarity("apex-gt");
      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toBe("public, max-age=300");
      expect(res.body.data.sampleSize).toBe(100);
      expect(res.body.data.computedAt).toBe("2026-09-26T12:00:00.000Z");
      expect(res.body.data.rareCombos).toEqual([
        { paintId: gt.paints[2], wheelsId: gt.wheels[0], percentage: 2 },
        { paintId: gt.paints[1], wheelsId: gt.wheels[1], percentage: 4 },
      ]);
    });

    it("shows nothing for a vehicle whose sample is too small, however rare the pair (AC-3)", async () => {
      const res = await rarity("apex-rs");
      expect(res.body.data.sampleSize).toBe(10);
      expect(res.body.data.rareCombos).toEqual([]);
    });

    it("flags only the earliest build with a pair as the first of its kind (AC-5)", async () => {
      expect((await rarity("apex-gt", `?build=${firstRareBuild}`)).body.data.firstOfKind).toBe(true);
      expect((await rarity("apex-gt", `?build=${secondRareBuild}`)).body.data.firstOfKind).toBe(false);
      expect((await rarity("apex-gt", "?build=APEX-NONE-NONE")).body.data.firstOfKind).toBe(false);
    });

    it("never flags a first-of-kind below the minimum sample (AC-3 applies to AC-5 too)", async () => {
      const rsFirst = await prisma.configuration.findFirstOrThrow({ where: { vehicleId: rs.vehicleId }, orderBy: { createdAt: "asc" } });
      expect((await rarity("apex-rs", `?build=${rsFirst.publicId}`)).body.data.firstOfKind).toBe(false);
    });

    it("a build of a different vehicle is never the first of this one", async () => {
      expect((await rarity("apex-rs", `?build=${firstRareBuild}`)).body.data.firstOfKind).toBe(false);
    });

    it("a rerun replaces the previous results rather than adding to them", async () => {
      await insertBuilds(prisma, gt, gt.paints[0], gt.wheels[0], 1);
      await computeComboRarity(new Date("2026-09-26T13:00:00.000Z"));
      const stats = await prisma.comboRarityStat.findMany({ where: { vehicleId: gt.vehicleId } });
      expect(stats).toHaveLength(3);
      expect(new Set(stats.map((s) => s.sampleSize))).toEqual(new Set([101]));
      expect((await rarity("apex-gt")).body.data.rareCombos.map((c: { percentage: number }) => c.percentage)).toEqual([2, 4]);
    });
  });

  it("404s for an unknown or deactivated vehicle", async () => {
    expect((await rarity("no-such-car")).status).toBe(404);
    await prisma.vehicle.update({ where: { slug: "apex-rs" }, data: { isActive: false } });
    try {
      const res = await rarity("apex-rs");
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("VEHICLE_NOT_FOUND");
    } finally {
      await prisma.vehicle.update({ where: { slug: "apex-rs" }, data: { isActive: true } });
    }
  });

  it("rejects a malformed build ID", async () => {
    const res = await rarity("apex-gt", `?build=${"X".repeat(40)}`);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details.build).toBeDefined();
  });
});

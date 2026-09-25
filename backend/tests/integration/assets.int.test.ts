import "dotenv/config";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog.js";

const { createApp } = await import("../../src/app.js");
const { prisma } = await import("../../src/lib/prisma.js");
const { seedDatabase } = await import("../../prisma/seed.js");
const { collectReferencedAssetUrls, findCleanupCandidates, loadSupersessionDates } = await import(
  "../../src/services/assets/cleanup.js"
);

const FRONTEND_PUBLIC = resolve(import.meta.dirname, "../../../frontend/public");
const PORSCHE = "porsche-992-gt3-r";
const NEW_VERSION_URL = "/assets/models/porsche-992-gt3-r.feedc0de.glb";

async function signupAdminAgent(email: string) {
  const agent = request.agent(createApp());
  const res = await agent.post("/api/auth/signup").send({ name: "Asset Admin", email, password: "assetadmin1", acceptedTerms: true });
  expect(res.status).toBe(201);
  await prisma.user.update({ where: { id: res.body.data.id }, data: { role: "ADMIN" } });
  return agent;
}

async function saveDefaultBuild(vehicleSlug: string): Promise<string> {
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { slug: vehicleSlug } });
  const options = await prisma.customizationOption.findMany({ where: { vehicleId: vehicle.id, isDefault: true } });
  const singleSelections = Object.fromEntries(
    SINGLE_SELECT_CATEGORIES.map((category) => [category, options.find((o) => o.category === category)!.id]),
  );
  const res = await request(createApp())
    .post("/api/configurations")
    .send({ vehicleSlug, singleSelections, multiSelections: { ACCESSORY: [], PACKAGE: [] }, customPaintHex: null });
  expect(res.status).toBe(201);
  return res.body.data.publicId;
}

describe("Asset versioning (integration, Spec 25)", () => {
  let admin: ReturnType<typeof request.agent>;
  let porscheId: string;
  let originalShowroomUrl: string;

  beforeAll(async () => {
    await seedDatabase(prisma);
    await prisma.auditLogEntry.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    admin = await signupAdminAgent("asset-admin@example.com");
    const porsche = await prisma.vehicle.findFirstOrThrow({ where: { slug: PORSCHE } });
    porscheId = porsche.id;
    originalShowroomUrl = porsche.showroomModelUrl;
  });

  it("seeds real-model vehicles with versioned URLs whose files exist on disk (AC-1)", async () => {
    expect(originalShowroomUrl).toMatch(/\.[0-9a-f]{8}\.glb$/);
    expect(existsSync(resolve(FRONTEND_PUBLIC, `.${originalShowroomUrl}`))).toBe(true);
  });

  it("exposes the model URLs on the public vehicle list the /models page renders from", async () => {
    const res = await request(createApp()).get("/api/vehicles");
    const porsche = res.body.data.find((v: { slug: string }) => v.slug === PORSCHE);
    expect(porsche.showroomModelUrl).toBe(originalShowroomUrl);
    expect(porsche.heroModelUrl).toMatch(/\.[0-9a-f]{8}\.glb$/);
  });

  it("rejects an unversioned model URL with VALIDATION_ERROR details (AC-1)", async () => {
    const res = await admin.put(`/api/admin/vehicles/${porscheId}`).send({ showroomModelUrl: "/assets/models/porsche-v2.glb" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details.showroomModelUrl[0]).toMatch(/versioned asset URL/);

    const unchanged = await prisma.vehicle.findUniqueOrThrow({ where: { id: porscheId } });
    expect(unchanged.showroomModelUrl).toBe(originalShowroomUrl);
  });

  it("rejects an unversioned URL on create too", async () => {
    const res = await admin.post("/api/admin/vehicles").send({
      slug: "apex-unversioned",
      name: "Apex Unversioned",
      tagline: "x",
      basePriceCents: 1,
      currency: "EUR",
      horsepower: 1,
      topSpeedKph: 1,
      zeroToHundredSec: 1,
      heroModelUrl: "/models/x/hero.glb",
      showroomModelUrl: "/models/x/showroom.a1b2c3d4.glb",
      thumbnailUrl: "/models/x/thumbnail.a1b2c3d4.jpg",
      fallbackImageUrl: "/models/x/fallback.a1b2c3d4.jpg",
    });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details)).toEqual(["heroModelUrl"]);
    expect(await prisma.vehicle.findUnique({ where: { slug: "apex-unversioned" } })).toBeNull();
  });

  it("still lets an admin edit a pre-policy vehicle whose placeholder URLs are resent unchanged", async () => {
    const gt = await prisma.vehicle.findFirstOrThrow({ where: { slug: "apex-gt" } });
    const res = await admin.put(`/api/admin/vehicles/${gt.id}`).send({
      name: "Apex GT",
      heroModelUrl: gt.heroModelUrl, // "/models/apex-gt/hero.glb" — unversioned, but unchanged
      fallbackImageUrl: gt.fallbackImageUrl,
    });
    expect(res.status).toBe(200);
  });

  describe("replacing a vehicle's model (AC-2, AC-4)", () => {
    let savedBeforeUpdate: string;

    beforeAll(async () => {
      savedBeforeUpdate = await saveDefaultBuild(PORSCHE);
      const res = await admin.put(`/api/admin/vehicles/${porscheId}`).send({ showroomModelUrl: NEW_VERSION_URL });
      expect(res.status).toBe(200);
      expect(res.body.data.showroomModelUrl).toBe(NEW_VERSION_URL);
    });

    it("stores the new versioned URL and leaves the old file in place", async () => {
      const row = await prisma.vehicle.findUniqueOrThrow({ where: { id: porscheId } });
      expect(row.showroomModelUrl).toBe(NEW_VERSION_URL);
      expect(existsSync(resolve(FRONTEND_PUBLIC, `.${originalShowroomUrl}`))).toBe(true);
    });

    it("logs the change old → new in the audit trail", async () => {
      const entry = await prisma.auditLogEntry.findFirstOrThrow({
        where: { action: "asset.version_change", targetId: porscheId },
      });
      expect(entry.targetType).toBe("Vehicle");
      expect(entry.metadata).toEqual({ field: "showroomModelUrl", oldUrl: originalShowroomUrl, newUrl: NEW_VERSION_URL });
    });

    it("does not log a version change for a field resent unchanged", async () => {
      await admin.put(`/api/admin/vehicles/${porscheId}`).send({ showroomModelUrl: NEW_VERSION_URL, name: "Porsche 992 GT3 R" });
      const count = await prisma.auditLogEntry.count({ where: { action: "asset.version_change", targetId: porscheId } });
      expect(count).toBe(1);
    });

    it("still loads a build saved before the update, rendered with the current asset (AC-4)", async () => {
      const saved = await request(createApp()).get(`/api/configurations/${savedBeforeUpdate}`);
      expect(saved.status).toBe(200);
      expect(saved.body.data.vehicleSlug).toBe(PORSCHE);

      const vehicle = await request(createApp()).get(`/api/vehicles/${PORSCHE}`);
      expect(vehicle.body.data.showroomModelUrl).toBe(NEW_VERSION_URL);
    });

    it("makes the old version a cleanup candidate only after the grace period (AC-5)", async () => {
      const referenced = await collectReferencedAssetUrls(prisma);
      const supersededAt = await loadSupersessionDates(prisma);
      // The seed points heroModelUrl at the same file, so it's still referenced; drop that one
      // reference here to exercise the grace-period timing on its own (the next test covers
      // the still-referenced case).
      referenced.delete(originalShowroomUrl);
      expect(supersededAt.has(originalShowroomUrl)).toBe(true);

      const params = { fileUrls: [originalShowroomUrl, NEW_VERSION_URL], referencedUrls: referenced, supersededAt };
      const tomorrow = findCleanupCandidates({ ...params, now: new Date(Date.now() + 24 * 60 * 60 * 1000) });
      expect(tomorrow.eligible).toEqual([]);
      expect(tomorrow.inGracePeriod.map((r) => r.url)).toEqual([originalShowroomUrl]);

      const later = findCleanupCandidates({ ...params, now: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000) });
      expect(later.eligible).toEqual([originalShowroomUrl]);
    });

    it("never offers a URL another row still references, even past the grace period", async () => {
      const referenced = await collectReferencedAssetUrls(prisma);
      // The Porsche's heroModelUrl still points at the original file.
      expect(referenced.has(originalShowroomUrl)).toBe(true);
      const report = findCleanupCandidates({
        fileUrls: [originalShowroomUrl],
        referencedUrls: referenced,
        supersededAt: await loadSupersessionDates(prisma),
        now: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      expect(report.eligible).toEqual([]);
    });
  });

  describe("CustomizationOption.assetRef", () => {
    it("accepts key-style refs without any version segment", async () => {
      const option = await prisma.customizationOption.findFirstOrThrow({ where: { assetRef: "wheel-sport-20" } });
      const res = await admin.put(`/api/admin/options/${option.id}`).send({ assetRef: "wheel-sport-20b" });
      expect(res.status).toBe(200);
      expect(await prisma.auditLogEntry.count({ where: { action: "asset.version_change", targetId: option.id } })).toBe(0);
    });

    it("rejects an unversioned file URL and accepts a versioned one, logging the change", async () => {
      const option = await prisma.customizationOption.findFirstOrThrow({ where: { assetRef: "wheel-carbon" } });

      const bad = await admin.put(`/api/admin/options/${option.id}`).send({ assetRef: "/assets/wheels/carbon.glb" });
      expect(bad.status).toBe(400);
      expect(bad.body.details.assetRef).toBeDefined();

      const good = await admin.put(`/api/admin/options/${option.id}`).send({ assetRef: "/assets/wheels/carbon.a1b2c3d4.glb" });
      expect(good.status).toBe(200);
      const entry = await prisma.auditLogEntry.findFirstOrThrow({ where: { action: "asset.version_change", targetId: option.id } });
      expect(entry.metadata).toEqual({ field: "assetRef", oldUrl: "wheel-carbon", newUrl: "/assets/wheels/carbon.a1b2c3d4.glb" });
    });

    it("rejects an unversioned file URL on option create", async () => {
      const res = await admin.post(`/api/admin/vehicles/${porscheId}/options`).send({
        category: "ACCESSORY",
        name: "Roof Box",
        description: null,
        priceDeltaCents: 1000,
        assetRef: "/assets/accessories/roof-box.glb",
        swatchColor: null,
        applyMode: "MESH_VISIBILITY",
        isDefault: false,
      });
      expect(res.status).toBe(400);
      expect(res.body.details.assetRef).toBeDefined();
    });
  });
});

import "dotenv/config";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog.js";

const { createApp } = await import("../../src/app.js");
const { prisma } = await import("../../src/lib/prisma.js");
const { seedDatabase } = await import("../../prisma/seed.js");

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

function saveBody(gt: Awaited<ReturnType<typeof defaultSelectionsFor>>, overrides: Record<string, string> = {}) {
  return {
    vehicleSlug: "apex-gt",
    singleSelections: { ...gt.singleSelections, ...overrides },
    multiSelections: { ACCESSORY: [], PACKAGE: [] },
    customPaintHex: null,
  };
}

async function signupAgent(email: string, name: string, password: string) {
  const agent = request.agent(createApp());
  const res = await agent.post("/api/auth/signup").send({ name, email, password, acceptedTerms: true });
  expect(res.status).toBe(201);
  return { agent, userId: res.body.data.id as string };
}

async function signupAdminAgent(email: string, name: string, password: string) {
  const { agent, userId } = await signupAgent(email, name, password);
  await prisma.user.update({ where: { id: userId }, data: { role: "ADMIN" } });
  return { agent, userId };
}

describe("Admin endpoints (integration, Spec 21)", () => {
  let gt: Awaited<ReturnType<typeof defaultSelectionsFor>>;

  beforeAll(async () => {
    await seedDatabase(prisma);
    gt = await defaultSelectionsFor("apex-gt");
    await prisma.lead.deleteMany();
    await prisma.reservation.deleteMany();
    await prisma.auditLogEntry.deleteMany();
    await prisma.configurationSelection.deleteMany();
    await prisma.configuration.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  describe("authorization (AC-1)", () => {
    const ADMIN_ROUTES: Array<[string, string]> = [
      ["get", "/api/admin/vehicles"],
      ["get", "/api/admin/leads"],
      ["get", "/api/admin/reservations"],
    ];

    it.each(ADMIN_ROUTES)("returns 404, not 401, for a signed-out caller on %s %s", async (method, path) => {
      const res = await (request(createApp()) as unknown as Record<string, (p: string) => request.Test>)[method](path);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });

    it.each(ADMIN_ROUTES)("returns 404, not 403, for a signed-in non-admin caller on %s %s", async (method, path) => {
      const { agent } = await signupAgent(`nonadmin-${method}-${path.replace(/\W/g, "")}@example.com`, "Regular User", "regularpass1");
      const res = await (agent as unknown as Record<string, (p: string) => request.Test>)[method](path);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("NOT_FOUND");
    });
  });

  describe("Vehicles (AC-2)", () => {
    it("creates a vehicle and reflects it in the public GET /api/vehicles immediately", async () => {
      const { agent } = await signupAdminAgent("vehicleadmin@example.com", "Vehicle Admin", "vehicleadminpass1");

      const res = await agent.post("/api/admin/vehicles").send({
        slug: "apex-concept",
        name: "Apex Concept",
        tagline: "A test vehicle.",
        basePriceCents: 1_000_000,
        currency: "EUR",
        horsepower: 400,
        topSpeedKph: 260,
        zeroToHundredSec: 4.5,
        heroModelUrl: "/models/apex-concept/hero.0a1b2c3d.glb",
        showroomModelUrl: "/models/apex-concept/showroom.0a1b2c3d.glb",
        thumbnailUrl: "/models/apex-concept/thumbnail.0a1b2c3d.jpg",
        fallbackImageUrl: "/models/apex-concept/fallback.0a1b2c3d.jpg",
      });

      expect(res.status).toBe(201);
      expect(res.body.data.slug).toBe("apex-concept");

      const publicList = await request(createApp()).get("/api/vehicles");
      expect(publicList.body.data.some((v: { slug: string }) => v.slug === "apex-concept")).toBe(true);

      const auditRow = await prisma.auditLogEntry.findFirst({ where: { targetId: "apex-concept", action: "vehicle.create" } });
      expect(auditRow).not.toBeNull();
      expect(auditRow!.adminUserId).toBeTruthy();
    });

    it("returns 400 VALIDATION_ERROR for a malformed vehicle payload", async () => {
      const { agent } = await signupAdminAgent("vehiclebadadmin@example.com", "Vehicle Bad Admin", "vehiclebadpass1");

      const res = await agent.post("/api/admin/vehicles").send({ slug: "" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("deactivating a vehicle (isActive:false) removes it from GET /api/vehicles", async () => {
      const { agent } = await signupAdminAgent("vehicledeactivate@example.com", "Vehicle Deactivator", "vehicledeactivatepass1");

      const create = await agent.post("/api/admin/vehicles").send({
        slug: "apex-to-deactivate",
        name: "Temp Vehicle",
        tagline: "Will be deactivated.",
        basePriceCents: 500_000,
        currency: "EUR",
        horsepower: 300,
        topSpeedKph: 220,
        zeroToHundredSec: 5.0,
        heroModelUrl: "/x/hero.0a1b2c3d.glb",
        showroomModelUrl: "/x/showroom.0a1b2c3d.glb",
        thumbnailUrl: "/x/thumbnail.0a1b2c3d.jpg",
        fallbackImageUrl: "/x/fallback.0a1b2c3d.jpg",
      });
      const vehicleId = (await prisma.vehicle.findUniqueOrThrow({ where: { slug: "apex-to-deactivate" } })).id;
      expect(create.status).toBe(201);

      const deactivate = await agent.put(`/api/admin/vehicles/${vehicleId}`).send({ isActive: false });
      expect(deactivate.status).toBe(200);
      expect(deactivate.body.data.isActive).toBe(false);

      const publicList = await request(createApp()).get("/api/vehicles");
      expect(publicList.body.data.some((v: { slug: string }) => v.slug === "apex-to-deactivate")).toBe(false);

      const adminList = await agent.get("/api/admin/vehicles");
      expect(adminList.body.data.some((v: { slug: string; isActive: boolean }) => v.slug === "apex-to-deactivate" && !v.isActive)).toBe(
        true,
      );
    });
  });

  describe("CustomizationOptions (AC-3)", () => {
    it("creates and edits an option's price", async () => {
      const { agent } = await signupAdminAgent("optionadmin@example.com", "Option Admin", "optionadminpass1");

      const create = await agent.post(`/api/admin/vehicles/${gt.vehicle.id}/options`).send({
        category: "ACCESSORY",
        name: "Test Accessory",
        description: null,
        priceDeltaCents: 10_000,
        assetRef: "accessory-test",
        swatchColor: null,
        applyMode: "MATERIAL_SWAP",
        isDefault: false,
      });
      expect(create.status).toBe(201);
      const optionId = create.body.data.id as string;

      const update = await agent.put(`/api/admin/options/${optionId}`).send({ priceDeltaCents: 25_000 });
      expect(update.status).toBe(200);
      expect(update.body.data.priceDeltaCents).toBe(25_000);
    });

    it("rejects a create that would leave a single-select category with two active defaults", async () => {
      const { agent } = await signupAdminAgent("defaultguard@example.com", "Default Guard Admin", "defaultguardpass1");

      const res = await agent.post(`/api/admin/vehicles/${gt.vehicle.id}/options`).send({
        category: "PAINT",
        name: "Second Default Paint",
        description: null,
        priceDeltaCents: 0,
        assetRef: "paint-second-default",
        swatchColor: "#ffffff",
        applyMode: "MATERIAL_SWAP",
        isDefault: true,
      });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("allows creating the first (non-default) option in a category on a brand-new vehicle with no options yet", async () => {
      const { agent } = await signupAdminAgent("freshvehicleadmin@example.com", "Fresh Vehicle Admin", "freshvehiclepass1");

      const createVehicle = await agent.post("/api/admin/vehicles").send({
        slug: "fresh-empty-vehicle",
        name: "Fresh Empty Vehicle",
        tagline: "Has zero options yet.",
        basePriceCents: 100_000,
        currency: "EUR",
        horsepower: 200,
        topSpeedKph: 200,
        zeroToHundredSec: 6.0,
        heroModelUrl: "/x/hero.0a1b2c3d.glb",
        showroomModelUrl: "/x/showroom.0a1b2c3d.glb",
        thumbnailUrl: "/x/thumbnail.0a1b2c3d.jpg",
        fallbackImageUrl: "/x/fallback.0a1b2c3d.jpg",
      });
      expect(createVehicle.status).toBe(201);
      const vehicleId = createVehicle.body.data.id as string;

      // No existing PAINT options at all on this vehicle — creating one non-default must not
      // be rejected just because the category "only" has zero defaults so far (a category
      // that's still being built up is not the same as one being regressed away from valid).
      const res = await agent.post(`/api/admin/vehicles/${vehicleId}/options`).send({
        category: "PAINT",
        name: "First Paint Option",
        description: null,
        priceDeltaCents: 0,
        assetRef: "paint-first",
        swatchColor: "#000000",
        applyMode: "MATERIAL_SWAP",
        isDefault: false,
      });

      expect(res.status).toBe(201);
    });

    it(
      "deactivating an option already used in a saved Configuration keeps that build intact, and removes it from public listing (AC-3 integrity)",
      async () => {
        const { agent } = await signupAdminAgent("integrityadmin@example.com", "Integrity Admin", "integrityadminpass1");

        // A non-default WHEELS option so deactivating it doesn't touch the default-invariant path.
        const nonDefaultWheel = gt.options.find((o) => o.category === "WHEELS" && !o.isDefault)!;

        const saveRes = await request(createApp())
          .post("/api/configurations")
          .send(saveBody(gt, { WHEELS: nonDefaultWheel.id }));
        expect(saveRes.status).toBe(201);
        const { publicId } = saveRes.body.data;

        const deactivate = await agent.delete(`/api/admin/options/${nonDefaultWheel.id}`);
        expect(deactivate.status).toBe(204);

        // The saved build still resolves and still reflects the (now-deactivated) selection.
        const configRes = await request(createApp()).get(`/api/configurations/${publicId}`);
        expect(configRes.status).toBe(200);
        expect(configRes.body.data.singleSelections.WHEELS).toBe(nonDefaultWheel.id);

        // Gone from the public catalog...
        const publicOptions = await request(createApp()).get("/api/vehicles/apex-gt/options");
        expect(publicOptions.body.data.some((o: { id: string }) => o.id === nonDefaultWheel.id)).toBe(false);

        // ...but still visible (and reactivatable) in the admin view.
        const adminOptions = await agent.get(`/api/admin/vehicles/${gt.vehicle.id}/options`);
        expect(
          adminOptions.body.data.some((o: { id: string; isActive: boolean }) => o.id === nonDefaultWheel.id && !o.isActive),
        ).toBe(true);

        const auditRow = await prisma.auditLogEntry.findFirst({
          where: { targetId: nonDefaultWheel.id, action: "option.deactivate" },
        });
        expect(auditRow).not.toBeNull();
      },
    );

    it("rejects deactivating the last active default option in a single-select category", async () => {
      const { agent } = await signupAdminAgent("defaultdeactivate@example.com", "Default Deactivate Admin", "defaultdeactivatepass1");
      const paintDefault = gt.options.find((o) => o.category === "PAINT" && o.isDefault)!;

      const res = await agent.delete(`/api/admin/options/${paintDefault.id}`);
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Leads (AC-4)", () => {
    it("lists leads, filters by status, and updates status to CONTACTED", async () => {
      const { agent } = await signupAdminAgent("leadadmin@example.com", "Lead Admin", "leadadminpass1");

      const saveRes = await request(createApp()).post("/api/configurations").send(saveBody(gt));
      const createLead = await request(createApp())
        .post("/api/leads")
        .send({
          configurationPublicId: saveRes.body.data.publicId,
          name: "Admin Test Lead",
          email: "adminlead@example.com",
          phone: null,
          preferredContact: "EMAIL",
          message: null,
          requestType: "QUOTE",
        });
      expect(createLead.status).toBe(201);
      const leadId = createLead.body.data.id as string;

      const list = await agent.get("/api/admin/leads");
      expect(list.status).toBe(200);
      expect(list.body.data.some((l: { id: string }) => l.id === leadId)).toBe(true);

      const filtered = await agent.get("/api/admin/leads?status=NEW");
      expect(filtered.body.data.some((l: { id: string }) => l.id === leadId)).toBe(true);

      const updateStatus = await agent.put(`/api/admin/leads/${leadId}`).send({ status: "CONTACTED" });
      expect(updateStatus.status).toBe(200);
      expect(updateStatus.body.data.status).toBe("CONTACTED");

      const filteredAfter = await agent.get("/api/admin/leads?status=NEW");
      expect(filteredAfter.body.data.some((l: { id: string }) => l.id === leadId)).toBe(false);
    });

    it("rejects an invalid lead status value", async () => {
      const { agent } = await signupAdminAgent("leadbadstatus@example.com", "Lead Bad Status Admin", "leadbadstatuspass1");
      const saveRes = await request(createApp()).post("/api/configurations").send(saveBody(gt));
      const createLead = await request(createApp())
        .post("/api/leads")
        .send({
          configurationPublicId: saveRes.body.data.publicId,
          name: "Bad Status Lead",
          email: "badstatuslead@example.com",
          phone: null,
          preferredContact: "EMAIL",
          message: null,
          requestType: "QUOTE",
        });

      const res = await agent.put(`/api/admin/leads/${createLead.body.data.id}`).send({ status: "NEW" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("Reservations (AC-5, read-only)", () => {
    it("lists reservations for an admin", async () => {
      const { agent } = await signupAdminAgent("reservationadmin@example.com", "Reservation Admin", "reservationadminpass1");
      const res = await agent.get("/api/admin/reservations");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("has no admin write route for reservations", async () => {
      const { agent } = await signupAdminAgent("reservationwriteadmin@example.com", "Reservation Write Admin", "reservationwritepass1");
      const res = await agent.put("/api/admin/reservations/some-id").send({ status: "PAID" });
      // No such route exists — Express falls through to its default 404 handler (no code envelope).
      expect(res.status).toBe(404);
    });
  });
});

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

function saveBody(gt: Awaited<ReturnType<typeof defaultSelectionsFor>>) {
  return {
    vehicleSlug: "apex-gt",
    singleSelections: gt.singleSelections,
    multiSelections: { ACCESSORY: [], PACKAGE: [] },
    customPaintHex: null,
  };
}

/** Mirrors garage.int.test.ts/leads.int.test.ts/admin.int.test.ts's own helper exactly. */
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

describe("GDPR export/delete endpoints (integration, Spec 24)", () => {
  let gt: Awaited<ReturnType<typeof defaultSelectionsFor>>;

  beforeAll(async () => {
    await seedDatabase(prisma);
    gt = await defaultSelectionsFor("apex-gt");
    // FK-safe delete order, same as garage.int.test.ts/admin.int.test.ts's own beforeAll.
    await prisma.passwordResetToken.deleteMany();
    await prisma.session.deleteMany();
    await prisma.auditLogEntry.deleteMany();
    await prisma.user.deleteMany();
  });

  it("GET /me/export requires a session", async () => {
    const res = await request(createApp()).get("/api/me/export");
    expect(res.status).toBe(401);
  });

  it("exports the caller's own configurations, leads, and reservations, and never includes passwordHash (AC-5)", async () => {
    const { agent, userId } = await signupAgent("exporter@example.com", "Export Er", "exporterpass1");

    const saveRes = await agent.post("/api/configurations").send(saveBody(gt));
    const publicId = saveRes.body.data.publicId as string;

    const leadRes = await agent.post("/api/leads").send({
      configurationPublicId: publicId,
      name: "Export Er",
      email: "exporter@example.com",
      phone: null,
      preferredContact: "EMAIL",
      message: null,
      requestType: "QUOTE",
    });
    expect(leadRes.status).toBe(201);

    const configuration = await prisma.configuration.findUniqueOrThrow({ where: { publicId } });
    const reservation = await prisma.reservation.create({
      data: { configurationId: configuration.id, userId, amountCents: 50000, currency: "EUR", status: "PENDING" },
    });

    const res = await agent.get("/api/me/export");
    expect(res.status).toBe(200);

    expect(res.body.user.email).toBe("exporter@example.com");
    expect(res.body.user).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");

    expect(res.body.configurations.map((c: { publicId: string }) => c.publicId)).toContain(publicId);
    expect(res.body.leads.map((l: { id: string }) => l.id)).toContain(leadRes.body.data.id);
    expect(res.body.reservations.map((r: { id: string }) => r.id)).toContain(reservation.id);
  });

  it("DELETE /me rejects a confirmEmail that doesn't match the account", async () => {
    const { agent } = await signupAgent("mismatcher@example.com", "Mis Matcher", "mismatchpass1");

    const res = await agent.delete("/api/me").send({ confirmEmail: "wrong@example.com" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");

    const stillExists = await prisma.user.findUnique({ where: { email: "mismatcher@example.com" } });
    expect(stillExists).not.toBeNull();
  });

  it("DELETE /me refuses ADMIN accounts rather than failing on the AuditLogEntry FK (AC-6 edge case)", async () => {
    const { agent, userId } = await signupAdminAgent("selfdeleteadmin@example.com", "Admin Self", "adminpass1");

    const res = await agent.delete("/api/me").send({ confirmEmail: "selfdeleteadmin@example.com" });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ADMIN_ACCOUNT_CANNOT_SELF_DELETE");

    const stillExists = await prisma.user.findUnique({ where: { id: userId } });
    expect(stillExists).not.toBeNull();
  });

  it("DELETE /me deletes the User row and anonymizes (not cascades) their Configuration/Lead/Reservation rows (AC-6)", async () => {
    const { agent, userId } = await signupAgent("deleteme@example.com", "Delete Me", "deletemepass1");

    const saveRes = await agent.post("/api/configurations").send(saveBody(gt));
    const publicId = saveRes.body.data.publicId as string;

    const leadRes = await agent.post("/api/leads").send({
      configurationPublicId: publicId,
      name: "Delete Me",
      email: "deleteme@example.com",
      phone: null,
      preferredContact: "EMAIL",
      message: null,
      requestType: "QUOTE",
    });

    const configuration = await prisma.configuration.findUniqueOrThrow({ where: { publicId } });
    const reservation = await prisma.reservation.create({
      data: { configurationId: configuration.id, userId, amountCents: 50000, currency: "EUR", status: "PENDING" },
    });

    const deleteRes = await agent.delete("/api/me").send({ confirmEmail: "deleteme@example.com" });
    expect(deleteRes.status).toBe(204);

    const deletedUser = await prisma.user.findUnique({ where: { id: userId } });
    expect(deletedUser).toBeNull();

    const survivingConfiguration = await prisma.configuration.findUniqueOrThrow({ where: { publicId } });
    expect(survivingConfiguration.userId).toBeNull();

    const survivingLead = await prisma.lead.findUniqueOrThrow({ where: { id: leadRes.body.data.id } });
    expect(survivingLead.userId).toBeNull();

    const survivingReservation = await prisma.reservation.findUniqueOrThrow({ where: { id: reservation.id } });
    expect(survivingReservation.userId).toBeNull();

    // The session cookie was cleared server-side (AC-6) — the same agent (same cookie jar)
    // can no longer reach an authenticated endpoint.
    const afterDelete = await agent.get("/api/me/configurations");
    expect(afterDelete.status).toBe(401);
  });
});

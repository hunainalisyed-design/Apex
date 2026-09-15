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

function saveBody(gt: Awaited<ReturnType<typeof defaultSelectionsFor>>, overrides: Record<string, unknown> = {}) {
  return {
    vehicleSlug: "apex-gt",
    singleSelections: gt.singleSelections,
    multiSelections: { ACCESSORY: [], PACKAGE: [] },
    customPaintHex: null,
    ...overrides,
  };
}

/** Signs up a fresh user via the real endpoint and returns an agent whose cookie jar
 * carries that session — mirrors auth.int.test.ts's own approach of exercising the real
 * signup flow rather than seeding a User row directly. */
async function signupAgent(email: string, name: string, password: string) {
  const agent = request.agent(createApp());
  const res = await agent.post("/api/auth/signup").send({ name, email, password, acceptedTerms: true });
  expect(res.status).toBe(201);
  return { agent, userId: res.body.data.id as string };
}

describe("Garage endpoints (integration, Spec 17)", () => {
  let gt: Awaited<ReturnType<typeof defaultSelectionsFor>>;

  beforeAll(async () => {
    await seedDatabase(prisma);
    gt = await defaultSelectionsFor("apex-gt");
    // FK-safe delete order, same as auth.int.test.ts's own beforeAll — a clean slate on
    // repeat runs, independent of any leftover users/sessions from other test files.
    await prisma.passwordResetToken.deleteMany();
    await prisma.session.deleteMany();
    // Spec 21's AuditLogEntry has a Restrict FK to User (adminUserId) — must go before the
    // user wipe below, same reasoning as every other FK-dependent table in this list.
    await prisma.auditLogEntry.deleteMany();
    await prisma.user.deleteMany();
  });

  it("an authenticated save is owned and never expires (AC-6)", async () => {
    const { agent, userId } = await signupAgent("owner1@example.com", "Owner One", "ownerpass1");

    const res = await agent.post("/api/configurations").send(saveBody(gt));
    expect(res.status).toBe(201);
    expect(res.body.data.ownerId).toBe(userId);

    const row = await prisma.configuration.findUniqueOrThrow({ where: { publicId: res.body.data.publicId } });
    expect(row.userId).toBe(userId);
    expect(row.expiresAt).toBeNull();
  });

  it("GET by publicId never re-expires an owned build — regression test for the bug fix", async () => {
    const { agent } = await signupAgent("owner2@example.com", "Owner Two", "ownerpass1");
    const saveRes = await agent.post("/api/configurations").send(saveBody(gt));
    const { publicId } = saveRes.body.data;

    await request(createApp()).get(`/api/configurations/${publicId}`);

    const row = await prisma.configuration.findUniqueOrThrow({ where: { publicId } });
    expect(row.expiresAt).toBeNull();
  });

  it("GET /me/configurations requires a session and lists the caller's builds newest first (AC-2)", async () => {
    const unauth = await request(createApp()).get("/api/me/configurations");
    expect(unauth.status).toBe(401);
    expect(unauth.body.code).toBe("UNAUTHENTICATED");

    const { agent } = await signupAgent("lister@example.com", "Lister", "listerpass1");
    const first = await agent.post("/api/configurations").send(saveBody(gt));
    const second = await agent.post("/api/configurations").send(saveBody(gt));

    const res = await agent.get("/api/me/configurations");
    expect(res.status).toBe(200);
    const ids = res.body.data.map((c: { publicId: string }) => c.publicId);
    expect(ids[0]).toBe(second.body.data.publicId);
    expect(ids[1]).toBe(first.body.data.publicId);
  });

  it("DELETE removes only a build the caller owns — a non-owner attempt 404s without confirming existence (AC-5)", async () => {
    const { agent: ownerAgent } = await signupAgent("deleter@example.com", "Deleter", "deleterpass1");
    const { agent: otherAgent } = await signupAgent("bystander@example.com", "Bystander", "bystanderpass1");

    const ownRes = await ownerAgent.post("/api/configurations").send(saveBody(gt));
    const otherRes = await otherAgent.post("/api/configurations").send(saveBody(gt));

    const stolenAttempt = await ownerAgent.delete(`/api/configurations/${otherRes.body.data.publicId}`);
    expect(stolenAttempt.status).toBe(404);
    expect(stolenAttempt.body.code).toBe("CONFIGURATION_NOT_FOUND");

    const unauthAttempt = await request(createApp()).delete(`/api/configurations/${ownRes.body.data.publicId}`);
    expect(unauthAttempt.status).toBe(401);

    const ownDelete = await ownerAgent.delete(`/api/configurations/${ownRes.body.data.publicId}`);
    expect(ownDelete.status).toBe(204);

    const afterList = await ownerAgent.get("/api/me/configurations");
    expect(afterList.body.data.map((c: { publicId: string }) => c.publicId)).not.toContain(ownRes.body.data.publicId);
  });

  it("claims an unowned guest build, is idempotent for the same caller, and 409s for a different owner (AC-7, AC-8)", async () => {
    const guestSave = await request(createApp()).post("/api/configurations").send(saveBody(gt));
    const { publicId } = guestSave.body.data;
    expect(guestSave.body.data.ownerId).toBeNull();

    const { agent: claimant, userId: claimantId } = await signupAgent("claimant@example.com", "Claimant", "claimantpass1");
    const { agent: rival } = await signupAgent("rival@example.com", "Rival", "rivalpass1");

    const notFound = await claimant.post("/api/configurations/APEX-0000-0000/claim");
    expect(notFound.status).toBe(404);
    expect(notFound.body.code).toBe("CONFIGURATION_NOT_FOUND");

    const claimed = await claimant.post(`/api/configurations/${publicId}/claim`);
    expect(claimed.status).toBe(200);
    expect(claimed.body.data.ownerId).toBe(claimantId);

    const row = await prisma.configuration.findUniqueOrThrow({ where: { publicId } });
    expect(row.expiresAt).toBeNull();

    // Idempotent: the same caller claiming again isn't an ownership change (AC-7/AC-8 don't
    // cover this case explicitly — resolved as success, not a conflict).
    const reclaimed = await claimant.post(`/api/configurations/${publicId}/claim`);
    expect(reclaimed.status).toBe(200);
    expect(reclaimed.body.data.ownerId).toBe(claimantId);

    // A different user can never take over an already-claimed build (AC-8).
    const conflict = await rival.post(`/api/configurations/${publicId}/claim`);
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("ALREADY_CLAIMED");
  });

  it("updates the profile name, requires a session, and rejects an empty name (AC-9)", async () => {
    const unauth = await request(createApp()).put("/api/me/profile").send({ name: "Nope" });
    expect(unauth.status).toBe(401);

    const { agent } = await signupAgent("profile@example.com", "Original Name", "profilepass1");

    const empty = await agent.put("/api/me/profile").send({ name: "  " });
    expect(empty.status).toBe(400);
    expect(empty.body.code).toBe("VALIDATION_ERROR");

    const res = await agent.put("/api/me/profile").send({ name: "Updated Name" });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Updated Name");

    const me = await agent.get("/api/auth/me");
    expect(me.body.data.name).toBe("Updated Name");
  });

  it(
    "changing the password keeps the current session signed in while revoking every other session (AC-9)",
    async () => {
      const email = "passchange@example.com";
      const { agent: sessionA } = await signupAgent(email, "Pass Change", "originalpass1");

      // A second, independent session for the SAME user (a different "device").
      const sessionB = request.agent(createApp());
      const loginB = await sessionB.post("/api/auth/login").send({ email, password: "originalpass1" });
      expect(loginB.status).toBe(200);

      const wrongCurrent = await sessionA
        .put("/api/me/password")
        .send({ currentPassword: "totallywrong1", newPassword: "newpassword1" });
      expect(wrongCurrent.status).toBe(401);
      expect(wrongCurrent.body.code).toBe("INVALID_CREDENTIALS");
      expect(wrongCurrent.body.details.currentPassword).toBeInstanceOf(Array);

      const weakNew = await sessionA
        .put("/api/me/password")
        .send({ currentPassword: "originalpass1", newPassword: "short" });
      expect(weakNew.status).toBe(400);
      expect(weakNew.body.code).toBe("VALIDATION_ERROR");
      expect(weakNew.body.details.newPassword).toBeInstanceOf(Array);

      const changed = await sessionA
        .put("/api/me/password")
        .send({ currentPassword: "originalpass1", newPassword: "newpassword1" });
      expect(changed.status).toBe(200);

      // sessionA (the one that made the change) stays signed in.
      const meA = await sessionA.get("/api/auth/me");
      expect(meA.body.data.email).toBe(email);

      // sessionB (the other "device") was revoked.
      const meB = await sessionB.get("/api/auth/me");
      expect(meB.body.data).toBeNull();

      // The new password is required to log in again elsewhere.
      const loginOld = await request(createApp()).post("/api/auth/login").send({ email, password: "originalpass1" });
      expect(loginOld.status).toBe(401);
      const loginNew = await request(createApp()).post("/api/auth/login").send({ email, password: "newpassword1" });
      expect(loginNew.status).toBe(200);
    },
    // Several real bcrypt hash/verify calls (cost 12) across many HTTP round trips — see
    // auth.int.test.ts's identical reasoning for its own generous timeout.
    20000,
  );
});

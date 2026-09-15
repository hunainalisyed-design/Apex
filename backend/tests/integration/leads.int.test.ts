import "dotenv/config";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog.js";

const sendDealerNotificationEmailMock = vi.fn().mockResolvedValue(undefined);
const sendRequesterConfirmationEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/services/leads/email.js", () => ({
  sendDealerNotificationEmail: (...args: unknown[]) => sendDealerNotificationEmailMock(...args),
  sendRequesterConfirmationEmail: (...args: unknown[]) => sendRequesterConfirmationEmailMock(...args),
}));

// Rate limiting isn't what these tests exercise, and its 5/min window would otherwise
// throttle this file's own several POST /leads calls against each other — bypass it here
// rather than testing it, same as ai.int.test.ts/auth.int.test.ts do for their own limiters.
vi.mock("../../src/middleware/rateLimit.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/middleware/rateLimit.js")>();
  return {
    ...actual,
    leadRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

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

function saveBody(gt: Awaited<ReturnType<typeof defaultSelectionsFor>>) {
  return {
    vehicleSlug: "apex-gt",
    singleSelections: gt.singleSelections,
    multiSelections: { ACCESSORY: [], PACKAGE: [] },
    customPaintHex: null,
  };
}

function leadBody(configurationPublicId: string, overrides: Record<string, unknown> = {}) {
  return {
    configurationPublicId,
    name: "Jamie Requester",
    email: "jamie@example.com",
    phone: null,
    preferredContact: "EMAIL",
    message: null,
    requestType: "QUOTE",
    ...overrides,
  };
}

async function signupAgent(email: string, name: string, password: string) {
  const agent = request.agent(createApp());
  const res = await agent.post("/api/auth/signup").send({ name, email, password, acceptedTerms: true });
  expect(res.status).toBe(201);
  return { agent, userId: res.body.data.id as string };
}

describe("Leads endpoints (integration, Spec 19)", () => {
  let gt: Awaited<ReturnType<typeof defaultSelectionsFor>>;

  beforeAll(async () => {
    await seedDatabase(prisma);
    gt = await defaultSelectionsFor("apex-gt");
    await prisma.lead.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.session.deleteMany();
    // Spec 21's AuditLogEntry has a Restrict FK to User (adminUserId) — must go before the
    // user wipe below, same reasoning as every other FK-dependent table in this list.
    await prisma.auditLogEntry.deleteMany();
    await prisma.user.deleteMany();
  });

  it("creates a lead for a guest submission (userId null) and dispatches both emails (AC-2, AC-3, AC-4)", async () => {
    const saveRes = await request(createApp()).post("/api/configurations").send(saveBody(gt));
    const { publicId } = saveRes.body.data;

    const res = await request(createApp()).post("/api/leads").send(leadBody(publicId));

    expect(res.status).toBe(201);
    expect(res.body.data.id).toBeTruthy();

    const row = await prisma.lead.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(row.userId).toBeNull();
    expect(row.name).toBe("Jamie Requester");

    expect(sendDealerNotificationEmailMock).toHaveBeenCalledTimes(1);
    expect(sendRequesterConfirmationEmailMock).toHaveBeenCalledTimes(1);
    const [dealerLeadArg, configUrlArg] = sendDealerNotificationEmailMock.mock.calls[0];
    expect(dealerLeadArg.id).toBe(res.body.data.id);
    expect(configUrlArg).toContain(`/configure/apex-gt?build=${publicId}`);
  });

  it("sets Lead.userId when the requester is signed in (AC-4)", async () => {
    const { agent, userId } = await signupAgent("leadowner@example.com", "Lead Owner", "leadownerpass1");
    const saveRes = await agent.post("/api/configurations").send(saveBody(gt));
    const { publicId } = saveRes.body.data;

    const res = await agent.post("/api/leads").send(leadBody(publicId, { requestType: "TEST_DRIVE" }));

    expect(res.status).toBe(201);
    const row = await prisma.lead.findUniqueOrThrow({ where: { id: res.body.data.id } });
    expect(row.userId).toBe(userId);
    expect(row.requestType).toBe("TEST_DRIVE");
  });

  it("returns 400 VALIDATION_ERROR for a missing name or a malformed email (AC-5)", async () => {
    const saveRes = await request(createApp()).post("/api/configurations").send(saveBody(gt));
    const { publicId } = saveRes.body.data;

    const missingName = await request(createApp())
      .post("/api/leads")
      .send(leadBody(publicId, { name: "  " }));
    expect(missingName.status).toBe(400);
    expect(missingName.body.code).toBe("VALIDATION_ERROR");

    const badEmail = await request(createApp())
      .post("/api/leads")
      .send(leadBody(publicId, { email: "not-an-email" }));
    expect(badEmail.status).toBe(400);
    expect(badEmail.body.code).toBe("VALIDATION_ERROR");
  });

  it("returns 404 CONFIGURATION_NOT_FOUND for an unknown configurationPublicId", async () => {
    const res = await request(createApp()).post("/api/leads").send(leadBody("APEX-0000-0000"));
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CONFIGURATION_NOT_FOUND");
  });

  it(
    "blocks deleting a configuration that has a lead attached with a clean 409, not a crash (Spec 17 regression)",
    async () => {
      const { agent } = await signupAgent("leadblocker@example.com", "Lead Blocker", "leadblockerpass1");
      const saveRes = await agent.post("/api/configurations").send(saveBody(gt));
      const { publicId } = saveRes.body.data;

      const leadRes = await agent.post("/api/leads").send(leadBody(publicId));
      expect(leadRes.status).toBe(201);

      const deleteRes = await agent.delete(`/api/configurations/${publicId}`);
      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body.code).toBe("CONFIGURATION_IN_USE");

      // The row must still exist — the delete was blocked, not partially applied.
      const stillThere = await prisma.configuration.findUnique({ where: { publicId } });
      expect(stillThere).not.toBeNull();
    },
    // Two real bcrypt hash calls via signup, matching this file's siblings' own generous
    // timeout reasoning for auth-heavy tests.
    15000,
  );

  it("still deletes a configuration with no lead attached (Spec 17 regression, no false-positive block)", async () => {
    const { agent } = await signupAgent("leadfree@example.com", "Lead Free", "leadfreepass1");
    const saveRes = await agent.post("/api/configurations").send(saveBody(gt));
    const { publicId } = saveRes.body.data;

    const deleteRes = await agent.delete(`/api/configurations/${publicId}`);
    expect(deleteRes.status).toBe(204);
  });
});

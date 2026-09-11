import "dotenv/config";
import request from "supertest";
import Stripe from "stripe";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog.js";

const STRIPE_WEBHOOK_SECRET_FOR_TESTS = "whsec_test_secret_for_signature_verification";
process.env.STRIPE_WEBHOOK_SECRET = STRIPE_WEBHOOK_SECRET_FOR_TESTS;

// A real Stripe client (no network call happens just from constructing one) so
// webhooks.constructEvent/generateTestHeaderString — pure, offline crypto — run for real,
// exercising AC-5's signature verification genuinely rather than mocking it away. Only the
// network-calling checkout.sessions.create is overridden, mirroring how ai.int.test.ts
// mocks just the network-calling boundary of its own external SDK client.
const testStripeClient = new Stripe("sk_test_fake_key_for_integration_tests");
const createCheckoutSessionMock = vi.fn();
testStripeClient.checkout.sessions.create = createCheckoutSessionMock as unknown as typeof testStripeClient.checkout.sessions.create;

vi.mock("../../src/lib/stripe.js", () => ({
  getStripeClient: () => testStripeClient,
}));

// Rate limiting isn't what these tests exercise — bypass it, same as leads.int.test.ts does
// for its own limiter.
vi.mock("../../src/middleware/rateLimit.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/middleware/rateLimit.js")>();
  return {
    ...actual,
    reservationRateLimit: (_req: unknown, _res: unknown, next: () => void) => next(),
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

async function signupAgent(email: string, name: string, password: string) {
  const agent = request.agent(createApp());
  const res = await agent.post("/api/auth/signup").send({ name, email, password, acceptedTerms: true });
  expect(res.status).toBe(201);
  return { agent, userId: res.body.data.id as string };
}

function mockStripeSession(id: string) {
  createCheckoutSessionMock.mockResolvedValueOnce({ id, url: `https://checkout.stripe.com/mock/${id}` });
}

function sendSignedWebhook(payload: Record<string, unknown>) {
  const payloadString = JSON.stringify(payload);
  const signature = testStripeClient.webhooks.generateTestHeaderString({
    payload: payloadString,
    secret: STRIPE_WEBHOOK_SECRET_FOR_TESTS,
  });
  return request(createApp())
    .post("/api/reservations/webhook")
    .set("Content-Type", "application/json")
    .set("stripe-signature", signature)
    .send(payloadString);
}

function checkoutSessionCompletedEvent(sessionId: string, metadata: Record<string, string> = {}) {
  return {
    id: `evt_${sessionId}`,
    object: "event",
    type: "checkout.session.completed",
    data: { object: { id: sessionId, object: "checkout.session", metadata } },
  };
}

describe("Reservations endpoints (integration, Spec 20)", () => {
  let gt: Awaited<ReturnType<typeof defaultSelectionsFor>>;

  beforeAll(async () => {
    await seedDatabase(prisma);
    gt = await defaultSelectionsFor("apex-gt");
    await prisma.reservation.deleteMany();
    await prisma.lead.deleteMany();
    await prisma.passwordResetToken.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
  });

  beforeEach(() => {
    createCheckoutSessionMock.mockReset();
    delete process.env.RESERVATIONS_ENABLED;
  });

  it("creates a checkout session, a PENDING Reservation, and writes the session id back (AC-2)", async () => {
    const saveRes = await request(createApp()).post("/api/configurations").send(saveBody(gt));
    const { publicId } = saveRes.body.data;
    mockStripeSession("cs_test_guest");

    const res = await request(createApp())
      .post("/api/reservations/checkout-session")
      .send({ configurationPublicId: publicId });

    expect(res.status).toBe(200);
    expect(res.body.data.checkoutUrl).toBe("https://checkout.stripe.com/mock/cs_test_guest");

    const [[sessionArgs]] = createCheckoutSessionMock.mock.calls;
    expect(sessionArgs.success_url).toContain("/confirmation");
    expect(sessionArgs.metadata.reservationId).toBeTruthy();
    expect(sessionArgs.line_items[0].price_data.unit_amount).toBe(50000);

    const row = await prisma.reservation.findUniqueOrThrow({ where: { stripeCheckoutSessionId: "cs_test_guest" } });
    expect(row.status).toBe("PENDING");
    expect(row.userId).toBeNull();
    expect(row.amountCents).toBe(50000);
  });

  it("sets Reservation.userId when the requester is signed in", async () => {
    const { agent, userId } = await signupAgent("reserver@example.com", "Reserver", "reserverpass1");
    const saveRes = await agent.post("/api/configurations").send(saveBody(gt));
    const { publicId } = saveRes.body.data;
    mockStripeSession("cs_test_signedin");

    const res = await agent.post("/api/reservations/checkout-session").send({ configurationPublicId: publicId });

    expect(res.status).toBe(200);
    const row = await prisma.reservation.findUniqueOrThrow({ where: { stripeCheckoutSessionId: "cs_test_signedin" } });
    expect(row.userId).toBe(userId);
  });

  it("returns 404 CONFIGURATION_NOT_FOUND for an unknown configurationPublicId", async () => {
    const res = await request(createApp())
      .post("/api/reservations/checkout-session")
      .send({ configurationPublicId: "APEX-0000-0000" });
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("CONFIGURATION_NOT_FOUND");
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("returns 503 RESERVATIONS_DISABLED when the feature flag is off, never calling Stripe", async () => {
    process.env.RESERVATIONS_ENABLED = "false";
    const saveRes = await request(createApp()).post("/api/configurations").send(saveBody(gt));
    const { publicId } = saveRes.body.data;

    const res = await request(createApp())
      .post("/api/reservations/checkout-session")
      .send({ configurationPublicId: publicId });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe("RESERVATIONS_DISABLED");
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("returns 502 PAYMENT_PROVIDER_ERROR when the Stripe API call fails, without leaking the raw error", async () => {
    const saveRes = await request(createApp()).post("/api/configurations").send(saveBody(gt));
    const { publicId } = saveRes.body.data;
    createCheckoutSessionMock.mockRejectedValueOnce(new Error("connection reset"));

    const res = await request(createApp())
      .post("/api/reservations/checkout-session")
      .send({ configurationPublicId: publicId });

    expect(res.status).toBe(502);
    expect(res.body.code).toBe("PAYMENT_PROVIDER_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("connection reset");
  });

  it("a validly-signed checkout.session.completed webhook marks the matching Reservation PAID (AC-3)", async () => {
    const saveRes = await request(createApp()).post("/api/configurations").send(saveBody(gt));
    mockStripeSession("cs_test_webhook_paid");
    await request(createApp())
      .post("/api/reservations/checkout-session")
      .send({ configurationPublicId: saveRes.body.data.publicId });

    const res = await sendSignedWebhook(checkoutSessionCompletedEvent("cs_test_webhook_paid"));
    expect(res.status).toBe(200);

    const row = await prisma.reservation.findUniqueOrThrow({
      where: { stripeCheckoutSessionId: "cs_test_webhook_paid" },
    });
    expect(row.status).toBe("PAID");
  });

  it("rejects a webhook with an invalid signature with 400, and never mutates the database (AC-5)", async () => {
    const saveRes = await request(createApp()).post("/api/configurations").send(saveBody(gt));
    mockStripeSession("cs_test_forged");
    await request(createApp())
      .post("/api/reservations/checkout-session")
      .send({ configurationPublicId: saveRes.body.data.publicId });

    const payload = checkoutSessionCompletedEvent("cs_test_forged");
    const res = await request(createApp())
      .post("/api/reservations/webhook")
      .set("Content-Type", "application/json")
      .set("stripe-signature", "t=1,v1=not-a-real-signature")
      .send(JSON.stringify(payload));

    expect(res.status).toBe(400);

    const row = await prisma.reservation.findUniqueOrThrow({ where: { stripeCheckoutSessionId: "cs_test_forged" } });
    expect(row.status).toBe("PENDING");
  });

  it("delivering the same webhook event twice is idempotent — no error, no duplicate row", async () => {
    const saveRes = await request(createApp()).post("/api/configurations").send(saveBody(gt));
    mockStripeSession("cs_test_retry");
    await request(createApp())
      .post("/api/reservations/checkout-session")
      .send({ configurationPublicId: saveRes.body.data.publicId });

    const event = checkoutSessionCompletedEvent("cs_test_retry");
    const first = await sendSignedWebhook(event);
    const second = await sendSignedWebhook(event);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const rows = await prisma.reservation.findMany({ where: { stripeCheckoutSessionId: "cs_test_retry" } });
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("PAID");
  });

  it("self-heals via metadata.reservationId when stripeCheckoutSessionId was never written back", async () => {
    const saveRes = await request(createApp()).post("/api/configurations").send(saveBody(gt));
    const configuration = await prisma.configuration.findUniqueOrThrow({
      where: { publicId: saveRes.body.data.publicId },
    });

    // Simulates createCheckoutSession's final write-back never landing — a Reservation row
    // exists with no stripeCheckoutSessionId at all.
    const orphan = await prisma.reservation.create({
      data: { configurationId: configuration.id, userId: null, amountCents: 50000, currency: "EUR", status: "PENDING" },
    });

    const res = await sendSignedWebhook(checkoutSessionCompletedEvent("cs_test_orphan", { reservationId: orphan.id }));
    expect(res.status).toBe(200);

    const row = await prisma.reservation.findUniqueOrThrow({ where: { id: orphan.id } });
    expect(row.status).toBe("PAID");
    expect(row.stripeCheckoutSessionId).toBe("cs_test_orphan");
  });

  it("GET /reservations/:id returns the reservation's current status", async () => {
    const saveRes = await request(createApp()).post("/api/configurations").send(saveBody(gt));
    const { publicId } = saveRes.body.data;
    mockStripeSession("cs_test_getbyid");
    await request(createApp())
      .post("/api/reservations/checkout-session")
      .send({ configurationPublicId: publicId });

    const row = await prisma.reservation.findUniqueOrThrow({ where: { stripeCheckoutSessionId: "cs_test_getbyid" } });

    const res = await request(createApp()).get(`/api/reservations/${row.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("PENDING");
    expect(res.body.data.configurationPublicId).toBe(publicId);
    expect(res.body.data.amountCents).toBe(50000);
  });

  it("returns 404 RESERVATION_NOT_FOUND for an unknown id", async () => {
    const res = await request(createApp()).get("/api/reservations/not-a-real-id");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("RESERVATION_NOT_FOUND");
  });

  it(
    "blocks deleting a configuration that has a Reservation attached with 409 CONFIGURATION_IN_USE — the generalized P2003 fix's second trigger",
    async () => {
      const { agent } = await signupAgent("reserveblocker@example.com", "Reserve Blocker", "reserveblockerpass1");
      const saveRes = await agent.post("/api/configurations").send(saveBody(gt));
      const { publicId } = saveRes.body.data;
      mockStripeSession("cs_test_blocks_delete");

      const reserveRes = await agent
        .post("/api/reservations/checkout-session")
        .send({ configurationPublicId: publicId });
      expect(reserveRes.status).toBe(200);

      const deleteRes = await agent.delete(`/api/configurations/${publicId}`);
      expect(deleteRes.status).toBe(409);
      expect(deleteRes.body.code).toBe("CONFIGURATION_IN_USE");

      const stillThere = await prisma.configuration.findUnique({ where: { publicId } });
      expect(stillThere).not.toBeNull();
    },
    15000,
  );
});

import "dotenv/config";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const sendPasswordResetEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock("../../src/services/auth/email.js", () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmailMock(...args),
}));

// The IP dimension isn't what the rate-limit test below exercises (it targets the
// per-email dimension specifically, AC-5) — bypassing it keeps that test isolated from this
// file's cumulative login-call count, the same "mock the cross-cutting concern that isn't
// under test" approach ai.int.test.ts uses for aiRateLimit. loginRateLimitByEmail is left
// real since it's the one thing that test asserts on.
vi.mock("../../src/middleware/rateLimit.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/middleware/rateLimit.js")>();
  return {
    ...actual,
    loginRateLimitByIp: (_req: unknown, _res: unknown, next: () => void) => next(),
  };
});

const { createApp } = await import("../../src/app.js");
const { prisma } = await import("../../src/lib/prisma.js");

function extractToken(resetUrl: string): string {
  return new URL(resetUrl).searchParams.get("token")!;
}

describe("Auth endpoints (integration, Spec 16)", () => {
  beforeAll(async () => {
    // FK-safe delete order: children before parent. Idempotent, mirrors seedDatabase's own
    // delete-then-recreate approach for a clean slate on repeat runs.
    await prisma.passwordResetToken.deleteMany();
    await prisma.session.deleteMany();
    // Spec 21's AuditLogEntry has a Restrict FK to User (adminUserId) — must go before the
    // user wipe below, same reasoning as every other FK-dependent table in this list.
    await prisma.auditLogEntry.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    sendPasswordResetEmailMock.mockRestore();
  });

  it("POST /signup creates a user, signs them in via a session cookie, and never leaks the password hash (AC-1)", async () => {
    const agent = request.agent(createApp());

    const res = await agent
      .post("/api/auth/signup")
      .send({ name: "Alice Apex", email: "Alice@Example.com", password: "alicepass1", acceptedTerms: true });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe("alice@example.com");
    expect(res.body.data.name).toBe("Alice Apex");
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.headers["set-cookie"]?.[0]).toContain("apex_session=");

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data.email).toBe("alice@example.com");
  });

  it("rejects a duplicate signup with 409 EMAIL_ALREADY_REGISTERED, with field-specific details (AC-2)", async () => {
    const res = await request(createApp())
      .post("/api/auth/signup")
      .send({ name: "Alice Two", email: "alice@example.com", password: "somethingelse1", acceptedTerms: true });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe("EMAIL_ALREADY_REGISTERED");
    expect(res.body.details.email).toBeInstanceOf(Array);
  });

  it("rejects a signup with a policy-violating password, with field-specific details", async () => {
    const res = await request(createApp())
      .post("/api/auth/signup")
      .send({ name: "Weak Pw", email: "weakpw@example.com", password: "short", acceptedTerms: true });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
    expect(res.body.details.password).toBeInstanceOf(Array);
  });

  it("POST /login signs in with correct credentials and sets a session cookie", async () => {
    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "alicepass1" });

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("alice@example.com");
    expect(res.headers["set-cookie"]?.[0]).toContain("apex_session=");
  });

  it("returns 401 INVALID_CREDENTIALS for a wrong password (AC-3)", async () => {
    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ email: "alice@example.com", password: "wrongpassword1" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns the identical 401 INVALID_CREDENTIALS for an unknown email — no enumeration via login", async () => {
    const res = await request(createApp())
      .post("/api/auth/login")
      .send({ email: "nobody-here@example.com", password: "whatever12" });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe("INVALID_CREDENTIALS");
  });

  it("GET /me returns data: null for a guest with no session cookie, never erroring (AC-10)", async () => {
    const res = await request(createApp()).get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it("POST /logout revokes the session so a subsequent GET /me is signed-out (AC-9)", async () => {
    const agent = request.agent(createApp());
    await agent.post("/api/auth/login").send({ email: "alice@example.com", password: "alicepass1" });

    const logout = await agent.post("/api/auth/logout");
    expect(logout.status).toBe(204);

    const me = await agent.get("/api/auth/me");
    expect(me.body.data).toBeNull();
  });

  it(
    "forgot-password gives a byte-identical response for a registered vs. unregistered email (AC-6), and the full " +
      "reset flow updates the password, revokes existing sessions (AC-7), and rejects token reuse (AC-8)",
    async () => {
      const bobAgent = request.agent(createApp());
      const signup = await bobAgent
        .post("/api/auth/signup")
        .send({ name: "Bob Builder", email: "bob@example.com", password: "bobpassword1", acceptedTerms: true });
      expect(signup.status).toBe(201);

      const stillSignedIn = await bobAgent.get("/api/auth/me");
      expect(stillSignedIn.body.data.email).toBe("bob@example.com");

      const registeredRes = await request(createApp())
        .post("/api/auth/forgot-password")
        .send({ email: "bob@example.com" });
      expect(registeredRes.status).toBe(200);
      expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);
      const [emailedTo, resetUrl] = sendPasswordResetEmailMock.mock.calls[0];
      expect(emailedTo).toBe("bob@example.com");
      const token = extractToken(resetUrl);
      expect(token).toBeTruthy();

      const unregisteredRes = await request(createApp())
        .post("/api/auth/forgot-password")
        .send({ email: "nobody-at-all@example.com" });
      expect(unregisteredRes.status).toBe(registeredRes.status);
      expect(unregisteredRes.body).toEqual(registeredRes.body);
      // No second email attempted for an email that isn't registered.
      expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);

      const weakReset = await request(createApp())
        .post("/api/auth/reset-password")
        .send({ token, newPassword: "short" });
      expect(weakReset.status).toBe(400);
      expect(weakReset.body.code).toBe("VALIDATION_ERROR");
      expect(weakReset.body.details.newPassword).toBeInstanceOf(Array);

      const badToken = await request(createApp())
        .post("/api/auth/reset-password")
        .send({ token: "not-a-real-token", newPassword: "newbobpassword1" });
      expect(badToken.status).toBe(400);
      expect(badToken.body.code).toBe("INVALID_OR_EXPIRED_TOKEN");

      const resetOk = await request(createApp())
        .post("/api/auth/reset-password")
        .send({ token, newPassword: "newbobpassword1" });
      expect(resetOk.status).toBe(200);

      // AC-7: every existing session for the user was revoked as part of the reset.
      const meAfterReset = await bobAgent.get("/api/auth/me");
      expect(meAfterReset.body.data).toBeNull();

      const loginOldPassword = await request(createApp())
        .post("/api/auth/login")
        .send({ email: "bob@example.com", password: "bobpassword1" });
      expect(loginOldPassword.status).toBe(401);

      const loginNewPassword = await request(createApp())
        .post("/api/auth/login")
        .send({ email: "bob@example.com", password: "newbobpassword1" });
      expect(loginNewPassword.status).toBe(200);

      // AC-8: the same token cannot be consumed twice.
      const reuseToken = await request(createApp())
        .post("/api/auth/reset-password")
        .send({ token, newPassword: "yetanotherpass1" });
      expect(reuseToken.status).toBe(400);
      expect(reuseToken.body.code).toBe("INVALID_OR_EXPIRED_TOKEN");
    },
    // This flow does 4 real bcrypt hash/verify calls (cost 12) across ~10 HTTP round trips —
    // comfortably over the default 5s timeout on this machine (a single hashPassword call
    // alone took ~1.3-1.9s in tests/auth.test.ts).
    20000,
  );

  it("blocks repeated login attempts against one account via the email-keyed limiter, independent of IP (AC-5)", async () => {
    const app = createApp();
    const attempt = () =>
      request(app).post("/api/auth/login").send({ email: "carol@example.com", password: "wrongpassword1" });

    let lastRes;
    for (let i = 0; i < 6; i++) {
      lastRes = await attempt();
    }

    expect(lastRes!.status).toBe(429);
    expect(lastRes!.body.code).toBe("TOO_MANY_ATTEMPTS");
  });
});

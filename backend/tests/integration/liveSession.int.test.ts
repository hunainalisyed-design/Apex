import "dotenv/config";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import { SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog.js";
import type { LiveServerMessage } from "../../src/types/liveSession.js";

const { createApp } = await import("../../src/app.js");
const { prisma } = await import("../../src/lib/prisma.js");
const { seedDatabase } = await import("../../prisma/seed.js");
const { attachLiveSessionServer, CLOSE } = await import("../../src/ws/liveSession.js");
const { buildLiveCatalog, INACTIVITY_TIMEOUT_MS, liveSessions, MAX_PARTICIPANTS } = await import("../../src/services/liveSession/index.js");

const ORIGIN = "http://localhost:3000";

let server: Server;
let baseUrl: string;
let wsBase: string;
let liveServer: { close: () => void };
let clockOffset = 0;

interface Client {
  socket: WebSocket;
  messages: LiveServerMessage[];
  closed: Promise<{ code: number; reason: string }>;
  next: <T extends LiveServerMessage["type"]>(
    type: T,
    where?: (m: Extract<LiveServerMessage, { type: T }>) => boolean,
  ) => Promise<Extract<LiveServerMessage, { type: T }>>;
  send: (message: unknown) => void;
}

/** A WebSocket client that records every message and can await the next matching one. */
function connect(sessionId: string, origin = ORIGIN): Promise<Client> {
  const socket = new WebSocket(`${wsBase}/ws/live-sessions/${sessionId}`, { headers: { Origin: origin } });
  const messages: LiveServerMessage[] = [];
  const waiters: Array<() => void> = [];
  socket.on("message", (data) => {
    messages.push(JSON.parse(data.toString()) as LiveServerMessage);
    for (const w of waiters.splice(0)) w();
  });
  const closed = new Promise<{ code: number; reason: string }>((resolve) =>
    socket.on("close", (code, reason) => resolve({ code, reason: reason.toString() })),
  );
  const client: Client = {
    socket,
    messages,
    closed,
    send: (message) => socket.send(typeof message === "string" ? message : JSON.stringify(message)),
    next: (type, where) =>
      new Promise((resolve, reject) => {
        let seen = 0;
        const timer = setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), 3000);
        const check = () => {
          for (; seen < messages.length; seen++) {
            const m = messages[seen];
            if (m.type === type && (!where || where(m as never))) {
              clearTimeout(timer);
              messages.splice(0, seen + 1);
              resolve(m as never);
              return;
            }
          }
          waiters.push(check);
        };
        check();
      }),
  };
  return new Promise((resolve, reject) => {
    socket.once("open", () => resolve(client));
    socket.once("unexpected-response", (_req, res) => reject(new Error(`HTTP ${res.statusCode}`)));
    socket.once("error", reject);
  });
}

async function join(sessionId: string, displayName: string, participantToken?: string) {
  const client = await connect(sessionId);
  client.send({ type: "join", displayName, participantToken });
  const welcome = await client.next("welcome");
  return { client, welcome };
}

let body: {
  vehicleSlug: string;
  singleSelections: Record<string, string>;
  multiSelections: { ACCESSORY: string[]; PACKAGE: string[] };
  customPaintHex: null;
  environmentId: null;
};
let wheels: string[];
let accessories: string[];
let rsWheels: string;

// POST /api/live-sessions allows 5 per minute per IP: exactly five tests below use it over HTTP.
async function startSessionOverHttp(): Promise<string> {
  const res = await request(baseUrl).post("/api/live-sessions").send(body);
  expect(res.status).toBe(201);
  return res.body.data.sessionId as string;
}

/** The same session the endpoint would create, without spending the rate limit. */
async function startSession(): Promise<string> {
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { slug: "apex-gt" } });
  const options = await prisma.customizationOption.findMany({ where: { vehicleId: vehicle.id, isActive: true } });
  const session = liveSessions.create("apex-gt", await buildLiveCatalog(options), body as never, Date.now() + clockOffset);
  return session!.id;
}

describe("Live collaborative sessions (integration, Spec 33)", () => {
  beforeAll(async () => {
    await seedDatabase(prisma);
    const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { slug: "apex-gt" } });
    const options = await prisma.customizationOption.findMany({ where: { vehicleId: vehicle.id, isActive: true } });
    body = {
      vehicleSlug: "apex-gt",
      singleSelections: Object.fromEntries(SINGLE_SELECT_CATEGORIES.map((c) => [c, options.find((o) => o.category === c && o.isDefault)!.id])),
      multiSelections: { ACCESSORY: [], PACKAGE: [] },
      customPaintHex: null,
      environmentId: null,
    };
    wheels = options.filter((o) => o.category === "WHEELS").map((o) => o.id);
    accessories = options.filter((o) => o.category === "ACCESSORY").map((o) => o.id);
    const rs = await prisma.vehicle.findFirstOrThrow({ where: { slug: "apex-rs" } });
    rsWheels = (await prisma.customizationOption.findFirstOrThrow({ where: { vehicleId: rs.id, category: "WHEELS" } })).id;

    server = createApp().listen(0);
    const { port } = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${port}`;
    wsBase = `ws://127.0.0.1:${port}`;
    liveServer = attachLiveSessionServer(server, {
      allowedOrigin: ORIGIN,
      pingIntervalMs: 150,
      sweepIntervalMs: 100,
      now: () => Date.now() + clockOffset,
    });
  });

  afterAll(() => {
    liveServer.close();
    server.close();
  });

  beforeEach(() => {
    clockOffset = 0;
    delete process.env.LIVE_COLLAB_ENABLED;
  });

  describe("starting a session (AC-1)", () => {
    it("returns an unguessable session id, and the session can be looked up", async () => {
      const sessionId = await startSessionOverHttp();
      expect(sessionId).toMatch(/^[A-Za-z0-9_-]{16}$/);
      const res = await request(baseUrl).get(`/api/live-sessions/${sessionId}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ sessionId, vehicleSlug: "apex-gt", participantCount: 0 });
    });

    it("validates the starting build like a save", async () => {
      const res = await request(baseUrl)
        .post("/api/live-sessions")
        .send({ ...body, singleSelections: { ...body.singleSelections, WHEELS: rsWheels } });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("OPTION_VEHICLE_MISMATCH");
      expect((await request(baseUrl).post("/api/live-sessions").send({ ...body, vehicleSlug: "nope" })).status).toBe(404);
      expect((await request(baseUrl).post("/api/live-sessions").send({})).status).toBe(400);
    });

    it("404s for a session that doesn't exist", async () => {
      const res = await request(baseUrl).get("/api/live-sessions/AAAAAAAAAAAAAAAA");
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("LIVE_SESSION_NOT_FOUND");
    });
  });

  describe("two participants", () => {
    it("see each other, and a change reaches both — well within a second (AC-2, AC-3)", async () => {
      const sessionId = await startSession();
      const { client: alex, welcome: alexWelcome } = await join(sessionId, "Alex");
      expect(alexWelcome.state.singleSelections.WHEELS).toBe(body.singleSelections.WHEELS);

      const { client: sam, welcome: samWelcome } = await join(sessionId, "Sam");
      expect(samWelcome.participants.map((p) => p.displayName).sort()).toEqual(["Alex", "Sam"]);
      const presence = await alex.next("presence", (m) => m.participants.length === 2);
      expect(new Set(presence.participants.map((p) => p.color)).size).toBe(2);

      const target = wheels.find((id) => id !== body.singleSelections.WHEELS)!;
      const started = performance.now();
      alex.send({ type: "change", change: { kind: "select", category: "WHEELS", optionId: target } });
      const atSam = await sam.next("state");
      const elapsed = performance.now() - started;
      expect(atSam.state.singleSelections.WHEELS).toBe(target);
      expect(atSam.change).toMatchObject({ displayName: "Alex", change: { kind: "select", category: "WHEELS" } });
      expect(elapsed).toBeLessThan(1000);
      // The sender gets the authoritative state too.
      expect((await alex.next("state")).state.version).toBe(atSam.state.version);

      alex.socket.close();
      sam.socket.close();
    });

    it("near-simultaneous changes to the same category: the last to arrive wins for everyone (AC-4)", async () => {
      const sessionId = await startSession();
      const { client: alex } = await join(sessionId, "Alex");
      const { client: sam } = await join(sessionId, "Sam");
      await alex.next("presence", (m) => m.participants.length === 2);

      alex.send({ type: "change", change: { kind: "select", category: "WHEELS", optionId: wheels[1] } });
      sam.send({ type: "change", change: { kind: "select", category: "WHEELS", optionId: wheels[2] } });
      const finalAtAlex = await alex.next("state", (m) => m.state.version === 2);
      const finalAtSam = await sam.next("state", (m) => m.state.version === 2);
      expect(finalAtAlex.state.singleSelections.WHEELS).toBe(finalAtSam.state.singleSelections.WHEELS);
      expect([wheels[1], wheels[2]]).toContain(finalAtAlex.state.singleSelections.WHEELS);

      alex.socket.close();
      sam.socket.close();
    });

    it("different accessories added at once both stick", async () => {
      const sessionId = await startSession();
      const { client: alex } = await join(sessionId, "Alex");
      const { client: sam } = await join(sessionId, "Sam");
      await alex.next("presence", (m) => m.participants.length === 2);

      alex.send({ type: "change", change: { kind: "toggle", category: "ACCESSORY", optionId: accessories[0] } });
      sam.send({ type: "change", change: { kind: "toggle", category: "ACCESSORY", optionId: accessories[1] } });
      const final = await alex.next("state", (m) => m.state.version === 2);
      expect([...final.state.multiSelections.ACCESSORY].sort()).toEqual([accessories[0], accessories[1]].sort());

      alex.socket.close();
      sam.socket.close();
    });

    it("an invalid change is rejected and the sender is resynced; nobody else hears of it", async () => {
      const sessionId = await startSession();
      const { client: alex } = await join(sessionId, "Alex");
      const { client: sam } = await join(sessionId, "Sam");
      await alex.next("presence", (m) => m.participants.length === 2);

      alex.send({ type: "change", change: { kind: "select", category: "WHEELS", optionId: rsWheels } });
      expect((await alex.next("error")).code).toBe("OPTION_VEHICLE_MISMATCH");
      expect((await alex.next("state")).state.version).toBe(0);
      alex.send("{not json");
      expect((await alex.next("error")).code).toBe("VALIDATION_ERROR");
      await new Promise((r) => setTimeout(r, 100));
      expect(sam.messages.filter((m) => m.type === "state")).toEqual([]);

      alex.socket.close();
      sam.socket.close();
    });

    it("relays cursors to the other participant only, and clears them when someone leaves (AC-2, AC-7)", async () => {
      const sessionId = await startSession();
      const { client: alex, welcome } = await join(sessionId, "Alex");
      const { client: sam } = await join(sessionId, "Sam");
      await alex.next("presence", (m) => m.participants.length === 2);

      alex.send({ type: "cursor", position: [0.5, 1, -2] });
      expect(await sam.next("cursor")).toEqual({ type: "cursor", participantId: welcome.participantId, position: [0.5, 1, -2] });
      await new Promise((r) => setTimeout(r, 50));
      expect(alex.messages.some((m) => m.type === "cursor")).toBe(false);

      alex.socket.close();
      expect(await sam.next("cursor")).toEqual({ type: "cursor", participantId: welcome.participantId, position: null });
      expect((await sam.next("presence")).participants.map((p) => p.displayName)).toEqual(["Sam"]);
      sam.socket.close();
    });

    it("notices a connection that silently dropped, within the heartbeat window (AC-7)", async () => {
      const sessionId = await startSession();
      const { client: alex } = await join(sessionId, "Alex");
      const { client: sam } = await join(sessionId, "Sam");
      await sam.next("presence", (m) => m.participants.length === 2);

      // Stop answering pings, as a vanished network would.
      (alex.socket as unknown as { pong: () => void }).pong = () => {};
      (alex.socket as unknown as { _receiver: { removeAllListeners: (e: string) => void } })._receiver.removeAllListeners("ping");
      const presence = await sam.next("presence", (m) => m.participants.length === 1);
      expect(presence.participants[0].displayName).toBe("Sam");
      sam.socket.close();
    });

    it("a reconnect with the token keeps the same identity and color", async () => {
      const sessionId = await startSession();
      const { client: first, welcome } = await join(sessionId, "Alex");
      first.socket.close();
      await first.closed;
      const { client: again, welcome: back } = await join(sessionId, "Alex", welcome.participantToken);
      expect(back.participantId).toBe(welcome.participantId);
      expect(back.participants.find((p) => p.id === back.participantId)!.color).toBe(
        welcome.participants.find((p) => p.id === welcome.participantId)!.color,
      );
      again.socket.close();
    });

    it("the same participant connecting again (another tab, a stale socket) takes over without leaving", async () => {
      const sessionId = await startSession();
      const { client: first, welcome } = await join(sessionId, "Alex");
      const { client: sam } = await join(sessionId, "Sam");
      await sam.next("presence", (m) => m.participants.length === 2);

      const { client: second, welcome: again } = await join(sessionId, "Alex", welcome.participantToken);
      expect(again.participantId).toBe(welcome.participantId);
      expect((await first.closed).code).toBe(CLOSE.REPLACED);
      await new Promise((r) => setTimeout(r, 100));
      // Alex never left: nobody saw them disappear, and there's still exactly one of them.
      expect(sam.messages.some((m) => m.type === "presence" && m.participants.length < 2)).toBe(false);
      expect(sam.messages.some((m) => m.type === "cursor" && m.position === null)).toBe(false);

      second.send({ type: "change", change: { kind: "select", category: "WHEELS", optionId: wheels[1] } });
      expect((await sam.next("state")).change).toMatchObject({ participantId: welcome.participantId });
      second.socket.close();
      sam.socket.close();
    });

    it("announces a save to the partner — only for a real build of this vehicle — and the session goes on (AC-5)", async () => {
      const sessionId = await startSession();
      const { client: alex } = await join(sessionId, "Alex");
      const { client: sam } = await join(sessionId, "Sam");
      await alex.next("presence", (m) => m.participants.length === 2);

      alex.send({ type: "saved", publicId: "APEX-FAKE-FAKE" });
      const old = await request(baseUrl).post("/api/configurations").send(body);
      await prisma.configuration.update({
        where: { publicId: old.body.data.publicId },
        data: { createdAt: new Date(Date.now() - 10 * 60_000) },
      });
      alex.send({ type: "saved", publicId: old.body.data.publicId });
      const saved = await request(baseUrl).post("/api/configurations").send(body);
      alex.send({ type: "saved", publicId: saved.body.data.publicId });
      const announced = await sam.next("saved");
      expect(announced).toMatchObject({ displayName: "Alex", publicId: saved.body.data.publicId });
      expect(sam.messages.filter((m) => m.type === "saved")).toEqual([]); // the fake and the old one never arrived

      sam.send({ type: "change", change: { kind: "select", category: "WHEELS", optionId: wheels[1] } });
      expect((await alex.next("state")).state.singleSelections.WHEELS).toBe(wheels[1]);
      alex.socket.close();
      sam.socket.close();
    });
  });

  describe("limits and refusals", () => {
    it(`turns away participant ${MAX_PARTICIPANTS + 1}`, async () => {
      const sessionId = await startSession();
      const joined = [];
      for (let i = 0; i < MAX_PARTICIPANTS; i++) joined.push((await join(sessionId, `P${i}`)).client);
      const extra = await connect(sessionId);
      extra.send({ type: "join", displayName: "Extra" });
      expect((await extra.closed).code).toBe(CLOSE.FULL);
      for (const c of joined) c.socket.close();
    });

    it("closes a connection that sends a message over 4 KB", async () => {
      const sessionId = await startSession();
      const { client } = await join(sessionId, "Alex");
      client.send({ type: "cursor", position: [0, 0, 0], padding: "x".repeat(5000) });
      expect((await client.closed).code).toBe(1009); // "message too big"
    });

    it("refuses a WebSocket from another website", async () => {
      const sessionId = await startSession();
      await expect(connect(sessionId, "https://evil.example")).rejects.toThrow("HTTP 403");
    });

    it("closes a connection for an unknown session with the not-found code", async () => {
      const client = await connect("AAAAAAAAAAAAAAAA");
      expect((await client.closed).code).toBe(CLOSE.NOT_FOUND);
    });

    it("requires join first", async () => {
      const sessionId = await startSession();
      const client = await connect(sessionId);
      client.send({ type: "cursor", position: null });
      expect((await client.closed).code).toBe(CLOSE.INVALID);
    });

    it("closes the session and everyone's connection after 30 minutes idle (AC-6)", async () => {
      const sessionId = await startSession();
      const { client: alex } = await join(sessionId, "Alex");
      clockOffset = INACTIVITY_TIMEOUT_MS + 1000;
      expect((await alex.closed).code).toBe(CLOSE.EXPIRED);
      expect((await request(baseUrl).get(`/api/live-sessions/${sessionId}`)).status).toBe(404);
    });

    it("can be turned off with LIVE_COLLAB_ENABLED=false", async () => {
      const sessionId = await startSession();
      process.env.LIVE_COLLAB_ENABLED = "false";
      const res = await request(baseUrl).post("/api/live-sessions").send(body);
      expect(res.status).toBe(503);
      expect(res.body.code).toBe("LIVE_COLLAB_DISABLED");
      expect((await request(baseUrl).get(`/api/live-sessions/${sessionId}`)).status).toBe(503);
      const client = await connect(sessionId);
      expect((await client.closed).code).toBe(CLOSE.DISABLED);
    });

    // Keep this last: the five POSTs above use up this IP's 5-a-minute allowance.
    it("limits session starts to 5 a minute per IP", async () => {
      const res = await request(baseUrl).post("/api/live-sessions").send(body);
      expect(res.status).toBe(429);
      expect(res.body.code).toBe("RATE_LIMITED");
    });
  });
});

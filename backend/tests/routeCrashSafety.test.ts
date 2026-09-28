import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

// Express 4 doesn't forward a rejected async handler to the error middleware: an unwrapped
// async route turns any database error into an unhandled rejection that crashes the whole
// backend. Every async handler must go through asyncHandler, so a failure is a clean 500.

// A database that's down: every Prisma call, on every model, rejects.
const unreachable = () => Promise.reject(new Error("Can't reach database server at `localhost:5432`"));
vi.mock("../src/lib/prisma.js", () => {
  const model = new Proxy({}, { get: () => vi.fn(unreachable) });
  const prisma = new Proxy({}, { get: (_target, key) => (String(key).startsWith("$") ? vi.fn(unreachable) : model) });
  return { prisma };
});

const { createApp } = await import("../src/app.js");

describe("every async route handler is wrapped", () => {
  const routesDir = path.resolve(import.meta.dirname, "../src/routes");

  it.each(fs.readdirSync(routesDir).filter((f) => f.endsWith(".ts")))("%s", (file) => {
    const source = fs.readFileSync(path.join(routesDir, file), "utf8");
    const unwrapped = source
      .split(/\r?\n/)
      .map((line, i) => ({ line: line.trim(), at: i + 1 }))
      .filter(({ line }) => /async \((_?req|req: )/.test(line) && !line.includes("asyncHandler("));
    expect(unwrapped, `unwrapped async handlers in ${file}`).toEqual([]);
  });

  it("the Stripe webhook (mounted in app.ts) is wrapped too", () => {
    const app = fs.readFileSync(path.resolve(import.meta.dirname, "../src/app.ts"), "utf8");
    expect(app).toMatch(/asyncHandler\(reservationsWebhookHandler\)/);
  });
});

describe("with the database down, routes answer 500 instead of crashing the server", () => {
  const cases: [string, (app: ReturnType<typeof createApp>) => request.Test][] = [
    ["GET /api/configurations/:publicId", (app) => request(app).get("/api/configurations/APEX-0000-0000")],
    ["GET /api/reservations/:id", (app) => request(app).get("/api/reservations/res_1")],
    ["POST /api/pricing/calculate", (app) => request(app).post("/api/pricing/calculate").send({ vehicleSlug: "apex-gt" })],
    ["GET /api/me/configurations (signed-in check)", (app) => request(app).get("/api/me/configurations").set("Cookie", "apex_session=token")],
  ];

  it.each(cases)("%s", async (_name, send) => {
    const res = await send(createApp());
    expect(res.status).toBe(500);
    expect(res.body.code).toBe("INTERNAL_ERROR");
  });
});

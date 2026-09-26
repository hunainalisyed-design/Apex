import "dotenv/config";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { makeGlb } from "../ar/glbFixture.js";

const { createApp } = await import("../../src/app.js");

const GLB = "model/gltf-binary";

/**
 * Spec 27's Android hosting endpoints. POST /ar/models is rate-limited to 5 per minute per
 * IP (a module-level limiter shared by every createApp() in this file), so the POSTs below
 * are budgeted: exactly five before the final rate-limit test, in this order.
 */
describe("AR model hosting (integration, Spec 27)", () => {
  afterEach(() => {
    delete process.env.AR_ENABLED;
  });

  it("stores an uploaded GLB and serves the exact bytes back from an absolute URL (AC-3)", async () => {
    const glb = makeGlb(2048);
    glb.fill(7, 12); // payload bytes after the header
    const upload = await request(createApp()).post("/api/ar/models").set("Content-Type", GLB).send(glb);

    expect(upload.status).toBe(201);
    const { url, expiresAt } = upload.body.data;
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/api\/ar\/models\/[A-Za-z0-9_-]{22}\.glb$/);
    const ttlMs = new Date(expiresAt).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(9 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(10 * 60 * 1000);

    const download = await request(createApp())
      .get(new URL(url).pathname)
      .buffer(true)
      .parse((res, done) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => done(null, Buffer.concat(chunks)));
      });
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toBe(GLB);
    expect(download.headers["cache-control"]).toBe("private, max-age=600");
    expect(Buffer.compare(download.body as Buffer, glb)).toBe(0);
  });

  it("rejects a body that isn't a valid GLB", async () => {
    const res = await request(createApp()).post("/api/ar/models").set("Content-Type", GLB).send(Buffer.from("not a model"));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a GLB sent with the wrong content type (it's never parsed as a file)", async () => {
    const res = await request(createApp()).post("/api/ar/models").set("Content-Type", "application/json").send("{}");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects uploads over 30 MB with 413 AR_MODEL_TOO_LARGE instead of a generic 500", async () => {
    const res = await request(createApp())
      .post("/api/ar/models")
      .set("Content-Type", GLB)
      .send(makeGlb(30 * 1024 * 1024));
    expect(res.status).toBe(413);
    expect(res.body.code).toBe("AR_MODEL_TOO_LARGE");
  });

  it("returns 503 AR_DISABLED for both endpoints when AR_ENABLED=false", async () => {
    process.env.AR_ENABLED = "false";
    const upload = await request(createApp()).post("/api/ar/models").set("Content-Type", GLB).send(makeGlb());
    expect(upload.status).toBe(503);
    expect(upload.body.code).toBe("AR_DISABLED");
    const download = await request(createApp()).get("/api/ar/models/abc.glb");
    expect(download.status).toBe(503);
  });

  it("returns 404 AR_MODEL_NOT_FOUND for an unknown or expired id", async () => {
    const res = await request(createApp()).get("/api/ar/models/AAAAAAAAAAAAAAAAAAAAAA.glb");
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("AR_MODEL_NOT_FOUND");
  });

  it("rate-limits uploads (the sixth POST in a minute gets 429)", async () => {
    const res = await request(createApp()).post("/api/ar/models").set("Content-Type", GLB).send(makeGlb());
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("RATE_LIMITED");
  });
});


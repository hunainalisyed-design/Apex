import "dotenv/config";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog.js";

const { createApp } = await import("../../src/app.js");
const { prisma } = await import("../../src/lib/prisma.js");
const { seedDatabase } = await import("../../prisma/seed.js");
const { publishConfiguration, CAPTURE_WIDTH, CAPTURE_HEIGHT } = await import("../../src/services/gallery.js");

/** A PNG header of the given size — the server validates signature + IHDR dimensions. */
function pngOf(width: number, height: number, extra = 64): Buffer {
  const png = Buffer.alloc(33 + extra);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png, 0);
  png.writeUInt32BE(13, 8);
  png.write("IHDR", 12, "ascii");
  png.writeUInt32BE(width, 16);
  png.writeUInt32BE(height, 20);
  png.fill(7, 33);
  return png;
}
const CAPTURE = pngOf(CAPTURE_WIDTH, CAPTURE_HEIGHT);

async function signup(email: string) {
  const agent = request.agent(createApp());
  const res = await agent.post("/api/auth/signup").send({ name: "Gallery User", email, password: "gallerypass1", acceptedTerms: true });
  expect(res.status).toBe(201);
  return { agent, userId: res.body.data.id as string };
}

async function saveBuild(agent: ReturnType<typeof request.agent> | null, vehicleSlug = "apex-gt"): Promise<string> {
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { slug: vehicleSlug } });
  const options = await prisma.customizationOption.findMany({ where: { vehicleId: vehicle.id, isDefault: true } });
  const singleSelections = Object.fromEntries(SINGLE_SELECT_CATEGORIES.map((c) => [c, options.find((o) => o.category === c)!.id]));
  const body = { vehicleSlug, singleSelections, multiSelections: { ACCESSORY: [], PACKAGE: [] }, customPaintHex: null };
  const res = await (agent ?? request(createApp())).post("/api/configurations").send(body);
  expect(res.status).toBe(201);
  return res.body.data.publicId as string;
}

const gallery = (sort = "recent", agent?: ReturnType<typeof request.agent>) =>
  (agent ?? request(createApp())).get(`/api/gallery?sort=${sort}`).then((r) => r.body.data);

describe("Public gallery (integration, Spec 31)", () => {
  let owner: Awaited<ReturnType<typeof signup>>;
  let fan: Awaited<ReturnType<typeof signup>>;
  let ownerBuild: string;

  beforeAll(async () => {
    await seedDatabase(prisma);
    await prisma.like.deleteMany();
    await prisma.auditLogEntry.deleteMany();
    await prisma.session.deleteMany();
    await prisma.user.deleteMany();
    owner = await signup("gallery-owner@example.com");
    fan = await signup("gallery-fan@example.com");
    ownerBuild = await saveBuild(owner.agent);
  });

  // The publish route allows 5 requests/minute per IP: exactly these five use it over HTTP.
  describe("publishing over HTTP (AC-1)", () => {
    it("requires an account", async () => {
      const res = await request(createApp()).post(`/api/configurations/${ownerBuild}/publish`).set("Content-Type", "image/png").send(CAPTURE);
      expect(res.status).toBe(401);
    });

    it("answers 404 to a non-owner — the same as a build that doesn't exist", async () => {
      const res = await fan.agent.post(`/api/configurations/${ownerBuild}/publish`).set("Content-Type", "image/png").send(CAPTURE);
      expect(res.status).toBe(404);
      expect(res.body.code).toBe("CONFIGURATION_NOT_FOUND");
    });

    it("rejects an image that isn't a capture-sized PNG", async () => {
      const res = await owner.agent.post(`/api/configurations/${ownerBuild}/publish`).set("Content-Type", "image/png").send(pngOf(800, 800));
      expect(res.status).toBe(400);
      expect(res.body.details.image).toBeDefined();
    });

    it("rejects an image over 3 MB in the API's error envelope", async () => {
      const res = await owner.agent
        .post(`/api/configurations/${ownerBuild}/publish`)
        .set("Content-Type", "image/png")
        .send(pngOf(CAPTURE_WIDTH, CAPTURE_HEIGHT, 3 * 1024 * 1024));
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("publishes the owner's build, which then appears in the gallery with its image (AC-1, AC-2)", async () => {
      const res = await owner.agent.post(`/api/configurations/${ownerBuild}/publish`).set("Content-Type", "image/png").send(CAPTURE);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ publicId: ownerBuild, isPublished: true });

      const { entries } = await gallery();
      const entry = entries.find((e: { publicId: string }) => e.publicId === ownerBuild);
      expect(entry).toMatchObject({ vehicleSlug: "apex-gt", vehicleName: "Apex GT", likeCount: 0, likedByMe: false });
      expect(entry).not.toHaveProperty("ownerId"); // nothing about the publisher (AC-5)

      const image = await request(createApp()).get(entry.captureImageUrl).buffer(true).parse((r, done) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => done(null, Buffer.concat(chunks)));
      });
      expect(image.status).toBe(200);
      expect(image.headers["content-type"]).toBe("image/png");
      expect(image.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
      expect(Buffer.compare(image.body as Buffer, CAPTURE)).toBe(0);

      const saved = await request(createApp()).get(`/api/configurations/${ownerBuild}`);
      expect(saved.body.data).toMatchObject({ isPublished: true });
    });
  });

  it("guests can't publish a build nobody owns (claim it first)", async () => {
    const guestBuild = await saveBuild(null);
    expect(await publishConfiguration(guestBuild, owner.userId, CAPTURE)).toEqual({ ok: false, reason: "NOT_FOUND" });
  });

  describe("likes (AC-3, AC-4)", () => {
    it("asks signed-out visitors to sign in (401), while browsing needs no account", async () => {
      const res = await request(createApp()).post(`/api/gallery/${ownerBuild}/like`);
      expect(res.status).toBe(401);
      expect((await request(createApp()).get("/api/gallery")).status).toBe(200);
    });

    it("toggles: a like, then removing it — never accumulating", async () => {
      const first = await fan.agent.post(`/api/gallery/${ownerBuild}/like`);
      expect(first.body.data).toEqual({ liked: true, likeCount: 1 });
      expect((await gallery("recent", fan.agent)).entries.find((e: { publicId: string }) => e.publicId === ownerBuild).likedByMe).toBe(true);

      const second = await fan.agent.post(`/api/gallery/${ownerBuild}/like`);
      expect(second.body.data).toEqual({ liked: false, likeCount: 0 });
      expect(await prisma.like.count()).toBe(0);
    });

    it("can't like a build that isn't published", async () => {
      const unpublished = await saveBuild(owner.agent);
      expect((await fan.agent.post(`/api/gallery/${unpublished}/like`)).status).toBe(404);
    });
  });

  it("sorts 'Most Popular This Week' by likes from the last 7 days only (AC-2)", async () => {
    const oldFavourite = await saveBuild(owner.agent, "apex-rs");
    const risingStar = await saveBuild(owner.agent, "apex-rs");
    await publishConfiguration(oldFavourite, owner.userId, CAPTURE);
    await publishConfiguration(risingStar, owner.userId, CAPTURE);
    const extra = await Promise.all([1, 2, 3].map((i) => signup(`gallery-voter-${i}@example.com`)));

    // oldFavourite: 3 likes, all 10 days old. risingStar: 1 like, today.
    for (const voter of extra) await voter.agent.post(`/api/gallery/${oldFavourite}/like`);
    const config = await prisma.configuration.findUniqueOrThrow({ where: { publicId: oldFavourite } });
    await prisma.like.updateMany({ where: { configurationId: config.id }, data: { createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) } });
    await fan.agent.post(`/api/gallery/${risingStar}/like`);

    const popular = (await gallery("popular")).entries.map((e: { publicId: string }) => e.publicId);
    expect(popular.indexOf(risingStar)).toBeLessThan(popular.indexOf(oldFavourite));
    const old = (await gallery("popular")).entries.find((e: { publicId: string }) => e.publicId === oldFavourite);
    expect(old).toMatchObject({ likeCount: 3, weeklyLikeCount: 0 });

    const recent = (await gallery("recent")).entries.map((e: { publicId: string }) => e.publicId);
    expect(recent.indexOf(risingStar)).toBeLessThan(recent.indexOf(oldFavourite)); // published later
  });

  it("unpublishing removes a build at once but keeps its likes for a later republish (AC-6)", async () => {
    await fan.agent.post(`/api/gallery/${ownerBuild}/like`);
    const imageUrl = (await gallery()).entries.find((e: { publicId: string }) => e.publicId === ownerBuild).captureImageUrl;

    expect((await fan.agent.post(`/api/configurations/${ownerBuild}/unpublish`)).status).toBe(404); // not the owner
    const res = await owner.agent.post(`/api/configurations/${ownerBuild}/unpublish`);
    expect(res.body.data).toMatchObject({ isPublished: false });

    expect((await gallery()).entries.some((e: { publicId: string }) => e.publicId === ownerBuild)).toBe(false);
    expect((await request(createApp()).get(imageUrl)).status).toBe(404);
    const config = await prisma.configuration.findUniqueOrThrow({ where: { publicId: ownerBuild } });
    expect(await prisma.like.count({ where: { configurationId: config.id } })).toBe(1);

    await publishConfiguration(ownerBuild, owner.userId, CAPTURE);
    expect((await gallery()).entries.find((e: { publicId: string }) => e.publicId === ownerBuild).likeCount).toBe(1);
  });

  it("deleting a published build removes it and its likes and image (AC-7)", async () => {
    const doomed = await saveBuild(owner.agent);
    await publishConfiguration(doomed, owner.userId, CAPTURE);
    await fan.agent.post(`/api/gallery/${doomed}/like`);
    const config = await prisma.configuration.findUniqueOrThrow({ where: { publicId: doomed } });

    expect((await owner.agent.delete(`/api/configurations/${doomed}`)).status).toBe(204);
    expect(await prisma.like.count({ where: { configurationId: config.id } })).toBe(0);
    expect(await prisma.galleryImage.count({ where: { configurationId: config.id } })).toBe(0);
    expect((await gallery()).entries.some((e: { publicId: string }) => e.publicId === doomed)).toBe(false);
  });

  it("hides builds of a deactivated vehicle (their links wouldn't work)", async () => {
    const porscheBuild = await saveBuild(owner.agent, "porsche-992-gt3-r");
    await publishConfiguration(porscheBuild, owner.userId, CAPTURE);
    await prisma.vehicle.update({ where: { slug: "porsche-992-gt3-r" }, data: { isActive: false } });
    expect((await gallery()).entries.some((e: { publicId: string }) => e.publicId === porscheBuild)).toBe(false);
    await prisma.vehicle.update({ where: { slug: "porsche-992-gt3-r" }, data: { isActive: true } });
  });

  it("validates sort and page", async () => {
    expect((await request(createApp()).get("/api/gallery?sort=best")).status).toBe(400);
    expect((await request(createApp()).get("/api/gallery?page=0")).status).toBe(400);
    const empty = await request(createApp()).get("/api/gallery?page=99");
    expect(empty.body.data).toMatchObject({ entries: [], page: 99, hasMore: false });
  });

  it("an admin can take any build out of the gallery, and it's audit-logged (moderation safety valve)", async () => {
    const admin = await signup("gallery-admin@example.com");
    await prisma.user.update({ where: { id: admin.userId }, data: { role: "ADMIN" } });
    const res = await admin.agent.post(`/api/admin/gallery/${ownerBuild}/unpublish`);
    expect(res.status).toBe(200);
    expect((await gallery()).entries.some((e: { publicId: string }) => e.publicId === ownerBuild)).toBe(false);
    expect(await prisma.auditLogEntry.count({ where: { action: "gallery.unpublish", targetId: ownerBuild } })).toBe(1);
    expect((await fan.agent.post(`/api/admin/gallery/${ownerBuild}/unpublish`)).status).toBe(404); // non-admins don't see it
  });

  describe("GDPR (Spec 24) with gallery data", () => {
    it("exports the user's likes", async () => {
      const exported = await fan.agent.get("/api/me/export");
      expect(exported.body.likes.length).toBeGreaterThan(0);
      expect(exported.body.likes[0]).toHaveProperty("configurationPublicId");
    });

    it("deleting an account unpublishes its builds and removes its likes — and doesn't fail on them", async () => {
      const leaver = await signup("gallery-leaver@example.com");
      const theirBuild = await saveBuild(leaver.agent);
      await publishConfiguration(theirBuild, leaver.userId, CAPTURE);
      const theirLike = await leaver.agent.post(`/api/gallery/${theirBuild}/like`);
      expect(theirLike.body.data.liked).toBe(true);

      const res = await leaver.agent.delete("/api/me").send({ confirmEmail: "gallery-leaver@example.com" });
      expect(res.status).toBe(204);
      expect(await prisma.like.count({ where: { userId: leaver.userId } })).toBe(0);
      const build = await prisma.configuration.findUniqueOrThrow({ where: { publicId: theirBuild } });
      expect(build).toMatchObject({ isPublished: false, userId: null });
      expect((await gallery()).entries.some((e: { publicId: string }) => e.publicId === theirBuild)).toBe(false);
    });
  });
});

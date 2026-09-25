import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { findCleanupCandidates, listPublicAssetUrls } from "../../src/services/assets/cleanup.js";
import { diffAssetUrls } from "../../src/services/assets/changes.js";
import { publishVersionedAsset } from "../../src/services/assets/publish.js";
import {
  computeContentHash,
  isAssetFileUrl,
  isVersionedAssetUrl,
  toVersionedFilename,
  validateAssetRef,
  validateVehicleAssetUrls,
} from "../../src/services/assets/versioning.js";

describe("computeContentHash (Spec 25)", () => {
  it("is deterministic for the same content", () => {
    expect(computeContentHash(Buffer.from("glb-bytes"))).toBe(computeContentHash(Buffer.from("glb-bytes")));
  });

  it("changes when the content changes", () => {
    expect(computeContentHash(Buffer.from("glb-bytes-v1"))).not.toBe(computeContentHash(Buffer.from("glb-bytes-v2")));
  });

  it("is 8 lowercase hex chars", () => {
    expect(computeContentHash(Buffer.from("x"))).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe("toVersionedFilename", () => {
  it("inserts the hash before the extension", () => {
    expect(toVersionedFilename("porsche-992-gt3-r.glb", "a1b2c3d4")).toBe("porsche-992-gt3-r.a1b2c3d4.glb");
  });

  it("replaces an existing hash instead of stacking a second one", () => {
    expect(toVersionedFilename("thumbnail.a1b2c3d4.jpg", "0f0f0f0f")).toBe("thumbnail.0f0f0f0f.jpg");
  });

  it("keeps dots that are part of the base name", () => {
    expect(toVersionedFilename("apex.gt.showroom.glb", "a1b2c3d4")).toBe("apex.gt.showroom.a1b2c3d4.glb");
  });

  it("rejects a filename with no extension", () => {
    expect(() => toVersionedFilename("model", "a1b2c3d4")).toThrow(/no file extension/);
  });
});

describe("isVersionedAssetUrl / isAssetFileUrl", () => {
  it.each([
    "/assets/models/porsche-992-gt3-r.93062210.glb",
    "/models/apex-gt/thumbnail.e8f2cc4d.jpg",
    "https://cdn.example.com/a/b.deadbeef.webp",
    "/assets/models/x.a1b2c3d4.glb?download=1",
  ])("accepts %s", (url) => {
    expect(isVersionedAssetUrl(url)).toBe(true);
  });

  it.each([
    "/assets/models/porsche-992-gt3-r.glb", // no hash
    "/models/apex-gt/thumbnail.jpg",
    "/assets/models/x.a1b2c3.glb", // too short
    "/assets/models/x.zzzzzzzz.glb", // not hex
    "/assets/models/x.a1b2c3d4.txt", // not an asset type
    "/assets/models/x.A1B2C3D4.glb", // uppercase hash — next.config's immutable matcher is lowercase-only
    "/assets/models/x.a1b2c3d4.GLB", // uppercase extension, same reason
    "/assets/models/x.glb?v=a1b2c3d4.glb", // hash only in the query string
    "paint-obsidian-black",
  ])("rejects %s", (url) => {
    expect(isVersionedAssetUrl(url)).toBe(false);
  });

  it("tells asset-file URLs apart from assetRef keys", () => {
    expect(isAssetFileUrl("/assets/wheels/sport.glb")).toBe(true);
    expect(isAssetFileUrl("wheel-sport-20")).toBe(false);
  });
});

describe("validateVehicleAssetUrls", () => {
  const current = {
    heroModelUrl: "/models/apex-gt/hero.glb",
    showroomModelUrl: "/models/apex-gt/showroom.glb",
    thumbnailUrl: "/models/apex-gt/thumbnail.e8f2cc4d.jpg",
    fallbackImageUrl: "/models/apex-gt/fallback.jpg",
  };

  it("requires every URL on create to be versioned", () => {
    const errors = validateVehicleAssetUrls({ ...current }, null);
    expect(Object.keys(errors).sort()).toEqual(["fallbackImageUrl", "heroModelUrl", "showroomModelUrl"]);
  });

  it("accepts an unchanged pre-policy URL resent on update", () => {
    expect(validateVehicleAssetUrls({ ...current }, current)).toEqual({});
  });

  it("rejects a changed URL that isn't versioned", () => {
    const errors = validateVehicleAssetUrls({ heroModelUrl: "/models/apex-gt/hero-v2.glb" }, current);
    expect(errors.heroModelUrl?.[0]).toMatch(/versioned asset URL/);
  });

  it("accepts a changed URL that is versioned", () => {
    expect(validateVehicleAssetUrls({ heroModelUrl: "/assets/models/apex-gt.a1b2c3d4.glb" }, current)).toEqual({});
  });
});

describe("validateAssetRef", () => {
  it("leaves key-style refs alone", () => {
    expect(validateAssetRef("wheel-sport-21", "wheel-sport-20")).toEqual({});
  });

  it("rejects a new unversioned file URL", () => {
    expect(validateAssetRef("/assets/wheels/sport.glb", "wheel-sport-20").assetRef).toBeDefined();
  });

  it("accepts a new versioned file URL, and an unchanged or omitted one", () => {
    expect(validateAssetRef("/assets/wheels/sport.a1b2c3d4.glb", "wheel-sport-20")).toEqual({});
    expect(validateAssetRef("/assets/wheels/legacy.glb", "/assets/wheels/legacy.glb")).toEqual({});
    expect(validateAssetRef(undefined, "x")).toEqual({});
  });
});

describe("diffAssetUrls", () => {
  it("reports only fields whose value actually changed", () => {
    const before = { heroModelUrl: "/a.11111111.glb", showroomModelUrl: "/b.22222222.glb" };
    const changes = diffAssetUrls(
      before,
      { heroModelUrl: "/a.33333333.glb", showroomModelUrl: "/b.22222222.glb" },
      ["heroModelUrl", "showroomModelUrl"] as const,
    );
    expect(changes).toEqual([{ field: "heroModelUrl", oldUrl: "/a.11111111.glb", newUrl: "/a.33333333.glb" }]);
  });
});

describe("publishVersionedAsset (never overwrites)", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "assets-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("copies the file under its content-hashed name and returns its URL", async () => {
    const source = join(dir, "car.glb");
    await writeFile(source, "v1");
    const result = await publishVersionedAsset(source, join(dir, "public"), "assets/models");

    expect(result.created).toBe(true);
    expect(result.url).toBe(`/assets/models/car.${computeContentHash(Buffer.from("v1"))}.glb`);
    expect(await readFile(result.filePath, "utf8")).toBe("v1");
  });

  it("publishes a changed file alongside the old version rather than replacing it", async () => {
    const source = join(dir, "car.glb");
    await writeFile(source, "v1");
    const v1 = await publishVersionedAsset(source, join(dir, "public"), "assets/models");
    await writeFile(source, "v2");
    const v2 = await publishVersionedAsset(source, join(dir, "public"), "assets/models");

    expect(v2.url).not.toBe(v1.url);
    expect(await readFile(v1.filePath, "utf8")).toBe("v1");
    expect(await readdir(join(dir, "public/assets/models"))).toHaveLength(2);
  });

  it("is a no-op for identical content already published", async () => {
    const source = join(dir, "car.glb");
    await writeFile(source, "v1");
    await publishVersionedAsset(source, join(dir, "public"), "assets/models");
    const again = await publishVersionedAsset(source, join(dir, "public"), "assets/models");
    expect(again.created).toBe(false);
  });

  it("refuses to overwrite a same-named file whose content differs", async () => {
    const source = join(dir, "car.glb");
    await writeFile(source, "v1");
    const first = await publishVersionedAsset(source, join(dir, "public"), "assets/models");
    await writeFile(first.filePath, "tampered");

    await expect(publishVersionedAsset(source, join(dir, "public"), "assets/models")).rejects.toThrow(/refusing to overwrite/);
    expect(await readFile(first.filePath, "utf8")).toBe("tampered");
  });

  it("refuses a subdir that escapes the public root", async () => {
    const source = join(dir, "car.glb");
    await writeFile(source, "v1");
    await expect(publishVersionedAsset(source, join(dir, "public"), "../outside")).rejects.toThrow(/escapes/);
  });
});

describe("findCleanupCandidates (AC-5)", () => {
  const now = new Date("2026-09-26T00:00:00Z");
  const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

  it("only offers unreferenced versioned files superseded longer ago than the grace period", () => {
    const report = findCleanupCandidates({
      fileUrls: [
        "/assets/models/current.11111111.glb", // referenced
        "/assets/models/old.22222222.glb", // superseded 45 days ago
        "/assets/models/recent.33333333.glb", // superseded 5 days ago
        "/assets/models/orphan.44444444.glb", // never superseded via admin
        "/assets/models/legacy.glb", // unversioned — never a candidate
      ],
      referencedUrls: new Set(["/assets/models/current.11111111.glb"]),
      supersededAt: new Map([
        ["/assets/models/old.22222222.glb", daysAgo(45)],
        ["/assets/models/recent.33333333.glb", daysAgo(5)],
      ]),
      now,
    });

    expect(report.eligible).toEqual(["/assets/models/old.22222222.glb"]);
    expect(report.inGracePeriod.map((r) => r.url)).toEqual(["/assets/models/recent.33333333.glb"]);
    expect(report.inGracePeriod[0].eligibleAt).toEqual(new Date(daysAgo(5).getTime() + 30 * 24 * 60 * 60 * 1000));
    expect(report.untracked).toEqual(["/assets/models/orphan.44444444.glb"]);
  });

  it("keeps a superseded URL that was later rolled back to (referenced again)", () => {
    const report = findCleanupCandidates({
      fileUrls: ["/a.22222222.glb"],
      referencedUrls: new Set(["/a.22222222.glb"]),
      supersededAt: new Map([["/a.22222222.glb", daysAgo(90)]]),
      now,
    });
    expect(report).toEqual({ eligible: [], inGracePeriod: [], untracked: [] });
  });

  it("honours a custom grace period", () => {
    const report = findCleanupCandidates({
      fileUrls: ["/a.22222222.glb"],
      referencedUrls: new Set(),
      supersededAt: new Map([["/a.22222222.glb", daysAgo(5)]]),
      now,
      graceDays: 3,
    });
    expect(report.eligible).toEqual(["/a.22222222.glb"]);
  });
});

describe("listPublicAssetUrls", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "assets-list-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("lists files recursively as root-relative URLs and ignores missing subdirs", async () => {
    const source = join(dir, "car.glb");
    await writeFile(source, "v1");
    const published = await publishVersionedAsset(source, dir, "assets/models");
    expect(await listPublicAssetUrls(dir, ["assets", "does-not-exist"])).toEqual([published.url]);
  });
});

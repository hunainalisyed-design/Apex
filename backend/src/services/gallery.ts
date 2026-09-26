import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { GalleryEntryDto, GalleryPageDto, LikeToggleDto, PublishStatusDto } from "../types/gallery.js";

/** The image the gallery shows is Spec 11's capture: a PNG of exactly this size. */
export const CAPTURE_WIDTH = 1600;
export const CAPTURE_HEIGHT = 900;
export const GALLERY_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const GALLERY_PAGE_SIZE = 24;
/** "Most Popular This Week" counts likes from this window (AC-2). */
export const POPULAR_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Whether `data` is a PNG of exactly the capture size (Spec 31). The image comes from the
 * owner's browser, so this is the guard that keeps the gallery to real build captures: a
 * different format or size is rejected. (It can't prove the pixels are a real capture — hence
 * the admin Unpublish safety valve; see the spec's Risk #1.)
 */
export function isValidCapturePng(data: Buffer): boolean {
  if (data.length < 24 || data.length > GALLERY_IMAGE_MAX_BYTES) return false;
  if (!data.subarray(0, 8).equals(PNG_SIGNATURE)) return false;
  if (data.toString("ascii", 12, 16) !== "IHDR") return false;
  return data.readUInt32BE(16) === CAPTURE_WIDTH && data.readUInt32BE(20) === CAPTURE_HEIGHT;
}

export function galleryImagePath(publicId: string, sha256: string): string {
  return `/api/gallery/${publicId}/image/${sha256.slice(0, 16)}.png`;
}

export type PublishResult = { ok: true; status: PublishStatusDto } | { ok: false; reason: "NOT_FOUND" };

/**
 * Publishes the caller's own build with its capture (AC-1). A build the caller doesn't own is
 * indistinguishable from one that doesn't exist (404) — the codebase's rule since Spec 17.
 * Republishing replaces the image and refreshes `publishedAt`; likes are kept (AC-6).
 */
export async function publishConfiguration(publicId: string, userId: string, image: Buffer): Promise<PublishResult> {
  const configuration = await prisma.configuration.findFirst({ where: { publicId, userId } });
  if (!configuration) return { ok: false, reason: "NOT_FOUND" };

  const sha256 = createHash("sha256").update(image).digest("hex");
  const data = new Uint8Array(image); // a plain ArrayBuffer-backed copy, as Prisma's Bytes type expects
  const publishedAt = new Date();
  await prisma.$transaction([
    prisma.galleryImage.upsert({
      where: { configurationId: configuration.id },
      create: { configurationId: configuration.id, data, contentType: "image/png", sha256 },
      update: { data, contentType: "image/png", sha256, createdAt: publishedAt },
    }),
    prisma.configuration.update({ where: { id: configuration.id }, data: { isPublished: true, publishedAt } }),
  ]);
  return { ok: true, status: { publicId, isPublished: true, publishedAt: publishedAt.toISOString() } };
}

/** Removes the caller's build from the gallery immediately; its likes are kept (AC-6). */
export async function unpublishConfiguration(publicId: string, userId: string | null): Promise<PublishResult> {
  const where = userId === null ? { publicId } : { publicId, userId };
  const result = await prisma.configuration.updateMany({ where, data: { isPublished: false } });
  if (result.count === 0) return { ok: false, reason: "NOT_FOUND" };
  return { ok: true, status: { publicId, isPublished: false, publishedAt: null } };
}

/** The page of published builds (AC-2): newest first, or most likes in the last 7 days. */
export async function listGallery(params: { sort: "recent" | "popular"; page: number; viewerId: string | null; now?: Date }): Promise<GalleryPageDto> {
  const page = Math.max(1, Math.floor(params.page) || 1);
  const since = new Date((params.now ?? new Date()).getTime() - POPULAR_WINDOW_MS);
  const skip = (page - 1) * GALLERY_PAGE_SIZE;
  const take = GALLERY_PAGE_SIZE + 1; // one extra to know whether there's a next page

  // Only builds with an image, on a vehicle that's still active (so the card's link works).
  const visible = { isPublished: true, galleryImage: { isNot: null }, vehicle: { isActive: true } } satisfies Prisma.ConfigurationWhereInput;

  let orderedIds: string[];
  if (params.sort === "popular") {
    // Prisma can't sort by a *filtered* relation count, so this one query is raw SQL (tagged
    // template — every value is a bound parameter, never string-built).
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT c."id"
      FROM "Configuration" c
      JOIN "Vehicle" v ON v."id" = c."vehicleId" AND v."isActive" = true
      JOIN "GalleryImage" g ON g."configurationId" = c."id"
      LEFT JOIN "Like" l ON l."configurationId" = c."id" AND l."createdAt" >= ${since}
      WHERE c."isPublished" = true
      GROUP BY c."id", c."publishedAt"
      ORDER BY COUNT(l."id") DESC, c."publishedAt" DESC, c."id" ASC
      OFFSET ${skip} LIMIT ${take}`;
    orderedIds = rows.map((row) => row.id);
  } else {
    const rows = await prisma.configuration.findMany({
      where: visible,
      orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
      skip,
      take,
      select: { id: true },
    });
    orderedIds = rows.map((row) => row.id);
  }

  const hasMore = orderedIds.length > GALLERY_PAGE_SIZE;
  const ids = orderedIds.slice(0, GALLERY_PAGE_SIZE);
  if (ids.length === 0) return { entries: [], page, pageSize: GALLERY_PAGE_SIZE, hasMore: false };

  const [configurations, totals, weekly, mine] = await Promise.all([
    prisma.configuration.findMany({
      where: { id: { in: ids } },
      include: { vehicle: true, galleryImage: { select: { sha256: true } } },
    }),
    prisma.like.groupBy({ by: ["configurationId"], where: { configurationId: { in: ids } }, _count: { _all: true } }),
    prisma.like.groupBy({ by: ["configurationId"], where: { configurationId: { in: ids }, createdAt: { gte: since } }, _count: { _all: true } }),
    params.viewerId
      ? prisma.like.findMany({ where: { userId: params.viewerId, configurationId: { in: ids } }, select: { configurationId: true } })
      : Promise.resolve([]),
  ]);

  const byId = new Map(configurations.map((c) => [c.id, c]));
  const totalById = new Map(totals.map((t) => [t.configurationId, t._count._all]));
  const weeklyById = new Map(weekly.map((t) => [t.configurationId, t._count._all]));
  const likedIds = new Set(mine.map((like) => like.configurationId));

  const entries: GalleryEntryDto[] = ids.flatMap((id) => {
    const c = byId.get(id);
    if (!c || !c.galleryImage || !c.publishedAt) return [];
    return [
      {
        publicId: c.publicId,
        vehicleSlug: c.vehicle.slug,
        vehicleName: c.vehicle.name,
        captureImageUrl: galleryImagePath(c.publicId, c.galleryImage.sha256),
        totalPriceCents: c.totalPriceCents,
        currency: c.vehicle.currency,
        likeCount: totalById.get(id) ?? 0,
        weeklyLikeCount: weeklyById.get(id) ?? 0,
        likedByMe: likedIds.has(id),
        publishedAt: c.publishedAt.toISOString(),
      },
    ];
  });
  return { entries, page, pageSize: GALLERY_PAGE_SIZE, hasMore };
}

export type LikeResult = { ok: true; result: LikeToggleDto } | { ok: false; reason: "NOT_FOUND" };

/**
 * Toggles the caller's like on a published build (AC-3): creates it, or removes it if it
 * exists — never accumulates. Unpublished builds can't be liked (they're not in the gallery).
 */
export async function toggleLike(publicId: string, userId: string): Promise<LikeResult> {
  const configuration = await prisma.configuration.findFirst({ where: { publicId, isPublished: true }, select: { id: true } });
  if (!configuration) return { ok: false, reason: "NOT_FOUND" };

  const key = { userId_configurationId: { userId, configurationId: configuration.id } };
  const existing = await prisma.like.findUnique({ where: key });
  let liked: boolean;
  if (existing) {
    await prisma.like.deleteMany({ where: { userId, configurationId: configuration.id } });
    liked = false;
  } else {
    try {
      await prisma.like.create({ data: { userId, configurationId: configuration.id } });
    } catch (err) {
      // A concurrent duplicate click already created it — the end state is "liked" either way.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
    }
    liked = true;
  }
  const likeCount = await prisma.like.count({ where: { configurationId: configuration.id } });
  return { ok: true, result: { liked, likeCount } };
}

/** The image bytes for a published build, if `hashPrefix` matches its current image. */
export async function getGalleryImage(publicId: string, hashPrefix: string): Promise<Buffer | null> {
  const configuration = await prisma.configuration.findFirst({
    where: { publicId, isPublished: true },
    select: { galleryImage: { select: { data: true, sha256: true } } },
  });
  const image = configuration?.galleryImage;
  if (!image || !image.sha256.startsWith(hashPrefix)) return null;
  return Buffer.from(image.data);
}

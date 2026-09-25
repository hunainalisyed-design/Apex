import { readdir } from "node:fs/promises";
import { join, posix, relative, sep } from "node:path";
import type { PrismaClient } from "@prisma/client";
import { ASSET_VERSION_CHANGE_ACTION } from "./changes.js";
import { VEHICLE_ASSET_FIELDS, isVersionedAssetUrl } from "./versioning.js";

/** AC-5's rollback window: a superseded version stays on disk at least this long. */
export const DEFAULT_GRACE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CleanupReport {
  /** Unreferenced, and superseded longer ago than the grace period — safe to delete. */
  eligible: string[];
  /** Unreferenced, but superseded too recently — kept for rollback until `eligibleAt`. */
  inGracePeriod: Array<{ url: string; eligibleAt: Date }>;
  /** Unreferenced, with no recorded supersession (e.g. published but never assigned, or
   * moved outside the admin panel) — never auto-deleted; needs a human to decide. */
  untracked: string[];
}

/**
 * Pure selection logic for the periodic cleanup job. Only versioned files are ever
 * candidates: an unversioned file predates this policy, and deleting it is outside what
 * this spec can safely reason about.
 */
export function findCleanupCandidates(params: {
  fileUrls: string[];
  referencedUrls: Set<string>;
  supersededAt: Map<string, Date>;
  now: Date;
  graceDays?: number;
}): CleanupReport {
  const graceMs = (params.graceDays ?? DEFAULT_GRACE_DAYS) * DAY_MS;
  const report: CleanupReport = { eligible: [], inGracePeriod: [], untracked: [] };

  for (const url of [...params.fileUrls].sort()) {
    if (!isVersionedAssetUrl(url) || params.referencedUrls.has(url)) continue;
    const superseded = params.supersededAt.get(url);
    if (!superseded) {
      report.untracked.push(url);
      continue;
    }
    const eligibleAt = new Date(superseded.getTime() + graceMs);
    if (eligibleAt.getTime() <= params.now.getTime()) report.eligible.push(url);
    else report.inGracePeriod.push({ url, eligibleAt });
  }
  return report;
}

/** Every asset URL any Vehicle or CustomizationOption row still points at — active or not,
 * since a deactivated vehicle can be reactivated and saved builds still resolve its options. */
export async function collectReferencedAssetUrls(prisma: PrismaClient): Promise<Set<string>> {
  const [vehicles, options] = await Promise.all([
    prisma.vehicle.findMany({
      select: { heroModelUrl: true, showroomModelUrl: true, thumbnailUrl: true, fallbackImageUrl: true },
    }),
    prisma.customizationOption.findMany({ select: { assetRef: true } }),
  ]);
  const urls = new Set<string>();
  for (const vehicle of vehicles) {
    for (const field of VEHICLE_ASSET_FIELDS) urls.add(vehicle[field]);
  }
  for (const option of options) urls.add(option.assetRef);
  return urls;
}

/** The most recent time each URL was replaced (as an `oldUrl`), from the audit trail. */
export async function loadSupersessionDates(prisma: PrismaClient): Promise<Map<string, Date>> {
  const entries = await prisma.auditLogEntry.findMany({
    where: { action: ASSET_VERSION_CHANGE_ACTION },
    select: { metadata: true, createdAt: true },
  });
  const dates = new Map<string, Date>();
  for (const entry of entries) {
    const oldUrl = (entry.metadata as { oldUrl?: unknown } | null)?.oldUrl;
    if (typeof oldUrl !== "string") continue;
    const previous = dates.get(oldUrl);
    if (!previous || entry.createdAt > previous) dates.set(oldUrl, entry.createdAt);
  }
  return dates;
}

/** Root-relative URLs of every file under `<publicRoot>/<subdir>`, recursively. */
export async function listPublicAssetUrls(publicRoot: string, subdirs: string[]): Promise<string[]> {
  const urls: string[] = [];
  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
      throw err;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) await walk(full);
      else urls.push("/" + relative(publicRoot, full).split(sep).join(posix.sep));
    }
  }
  for (const subdir of subdirs) await walk(join(publicRoot, subdir));
  return urls;
}

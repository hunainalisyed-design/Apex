import type { CustomizationOption } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import type { OptionCategory } from "../../types/catalog.js";
import { LiveSessionRegistry, type LiveCatalog } from "./registry.js";

export * from "./registry.js";

/** The process-wide registry: the REST routes and the WebSocket server share it. */
export const liveSessions = new LiveSessionRegistry();

/** The paint option whose color comes from the picker (same assetRef the frontend keys on). */
const CUSTOM_PAINT_ASSET_REF = "paint-custom";

/** Read per request, so flipping it takes effect without a redeploy (Spec 33 Rollout). */
export function isLiveCollabEnabled(): boolean {
  return process.env.LIVE_COLLAB_ENABLED !== "false";
}

export async function buildLiveCatalog(options: CustomizationOption[]): Promise<LiveCatalog> {
  const environments = await prisma.environment.findMany({ select: { id: true } });
  return {
    categoryByOptionId: new Map(options.map((o) => [o.id, o.category as OptionCategory])),
    customPaintOptionId: options.find((o) => o.category === "PAINT" && o.assetRef === CUSTOM_PAINT_ASSET_REF)?.id ?? null,
    environmentIds: new Set(environments.map((e) => e.id)),
  };
}

/** How recent a build must be to be announced as "just saved" in a session. */
export const SAVED_ANNOUNCEMENT_WINDOW_MS = 2 * 60_000;

/**
 * Whether a publicId announced as "saved" is a real build of this session's vehicle, saved
 * within the last couple of minutes — so a participant can't pass off an old build as a save.
 */
export async function isSavedBuildOf(publicId: string, vehicleSlug: string, now: number = Date.now()): Promise<boolean> {
  const found = await prisma.configuration.findFirst({
    where: { publicId, vehicle: { slug: vehicleSlug }, createdAt: { gte: new Date(now - SAVED_ANNOUNCEMENT_WINDOW_MS) } },
    select: { id: true },
  });
  return found !== null;
}

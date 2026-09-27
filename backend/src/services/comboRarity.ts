import { prisma } from "../lib/prisma.js";
import type { ComboRarityDto, RareComboDto } from "../types/comboRarity.js";

/** Below this many saved builds for a vehicle, no badge is shown at all (AC-3). */
export const MIN_SAMPLE_SIZE = 50;
/** A pair is "rare" when strictly fewer than this share of the vehicle's builds have it (AC-2). */
export const RARITY_THRESHOLD_PERCENT = 5;

/**
 * The displayed percentage: rounded UP to one decimal, so the badge can never make a pair look
 * rarer than it is (AC-4) — 3.41% shows as 3.5%, never 3.4%. Integer arithmetic until the final
 * division, so an exact tenth (e.g. 7/200 = 3.5%) never picks up float noise.
 */
export function ceilPercent(count: number, sampleSize: number): number {
  return Math.ceil((count * 1000) / sampleSize) / 10;
}

/** Whether a pair qualifies for a badge — decided on the exact ratio, not the rounded one. */
export function isRare(count: number, sampleSize: number): boolean {
  return sampleSize >= MIN_SAMPLE_SIZE && count > 0 && count * 100 < RARITY_THRESHOLD_PERCENT * sampleSize;
}

export interface ComboCountRow {
  vehicleId: string;
  paintId: string;
  wheelsId: string;
  count: number;
  firstConfigurationId: string;
}

export interface ComboRarityRunSummary {
  vehicles: number;
  combos: number;
  builds: number;
  durationMs: number;
}

/**
 * The aggregation job (AC-1): counts each vehicle's (PAINT, WHEELS) pairs across its saved,
 * unexpired builds, and replaces the whole ComboRarityStat table with the result in one
 * transaction — readers see either the previous run or this one, never a mix. Expired guest
 * builds (Spec 10's 90-day expiry) aren't counted: they're no longer builds anyone can open.
 */
export async function computeComboRarity(now: Date = new Date()): Promise<ComboRarityRunSummary> {
  const started = Date.now();

  // One grouped query; the earliest build per pair (createdAt, then id to break exact ties) is
  // the AC-5 "first". Tagged template — every value is a bound parameter.
  const rows = await prisma.$queryRaw<ComboCountRow[]>`
    SELECT c."vehicleId",
           ps."optionId" AS "paintId",
           ws."optionId" AS "wheelsId",
           COUNT(*)::int AS "count",
           (ARRAY_AGG(c."id" ORDER BY c."createdAt" ASC, c."id" ASC))[1] AS "firstConfigurationId"
    FROM "Configuration" c
    JOIN "ConfigurationSelection" ps ON ps."configurationId" = c."id"
    JOIN "CustomizationOption" po ON po."id" = ps."optionId" AND po."category" = 'PAINT'
    JOIN "ConfigurationSelection" ws ON ws."configurationId" = c."id"
    JOIN "CustomizationOption" wo ON wo."id" = ws."optionId" AND wo."category" = 'WHEELS'
    WHERE c."expiresAt" IS NULL OR c."expiresAt" > ${now}
    GROUP BY c."vehicleId", ps."optionId", ws."optionId"`;

  const sampleByVehicle = new Map<string, number>();
  for (const row of rows) sampleByVehicle.set(row.vehicleId, (sampleByVehicle.get(row.vehicleId) ?? 0) + row.count);

  await prisma.$transaction([
    prisma.comboRarityStat.deleteMany(),
    prisma.comboRarityStat.createMany({
      data: rows.map((row) => ({
        vehicleId: row.vehicleId,
        paintId: row.paintId,
        wheelsId: row.wheelsId,
        count: row.count,
        sampleSize: sampleByVehicle.get(row.vehicleId) ?? row.count,
        firstConfigurationId: row.firstConfigurationId,
        computedAt: now,
      })),
    }),
  ]);

  return {
    vehicles: sampleByVehicle.size,
    combos: rows.length,
    builds: [...sampleByVehicle.values()].reduce((sum, n) => sum + n, 0),
    durationMs: Date.now() - started,
  };
}

/**
 * The cached rarity data for one active vehicle (AC-2), or null if no such vehicle. Only the
 * rare pairs are returned — the thresholds live here, in one place, not in the client.
 * `buildPublicId` asks whether that saved build was the first with its pair (AC-5).
 */
export async function getComboRarity(slug: string, buildPublicId?: string): Promise<ComboRarityDto | null> {
  const vehicle = await prisma.vehicle.findFirst({ where: { slug, isActive: true }, select: { id: true } });
  if (!vehicle) return null;

  const stats = await prisma.comboRarityStat.findMany({ where: { vehicleId: vehicle.id } });
  const sampleSize = stats[0]?.sampleSize ?? 0;
  const computedAt = stats[0]?.computedAt.toISOString() ?? null;

  const rareCombos: RareComboDto[] = stats
    .filter((stat) => isRare(stat.count, stat.sampleSize))
    .map((stat) => ({ paintId: stat.paintId, wheelsId: stat.wheelsId, percentage: ceilPercent(stat.count, stat.sampleSize) }))
    .sort((a, b) => a.percentage - b.percentage);

  let firstOfKind = false;
  if (buildPublicId && sampleSize >= MIN_SAMPLE_SIZE) {
    const build = await prisma.configuration.findFirst({
      where: { publicId: buildPublicId, vehicleId: vehicle.id },
      select: { id: true },
    });
    firstOfKind = build !== null && stats.some((stat) => stat.firstConfigurationId === build.id);
  }

  return { sampleSize, computedAt, rareCombos, firstOfKind };
}

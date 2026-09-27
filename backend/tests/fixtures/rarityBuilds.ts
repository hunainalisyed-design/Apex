import type { PrismaClient } from "@prisma/client";
import { generatePublicId } from "../../src/services/publicId.js";
import { SINGLE_SELECT_CATEGORIES } from "../../src/types/catalog.js";

export interface RarityVehicleOptions {
  vehicleId: string;
  vehicleName: string;
  defaults: Record<string, string>;
  paints: string[];
  wheels: string[];
}

/** A vehicle's default selections plus its active PAINT and WHEELS option ids, in catalog order. */
export async function loadRarityVehicle(prisma: PrismaClient, slug: string): Promise<RarityVehicleOptions> {
  const vehicle = await prisma.vehicle.findFirstOrThrow({ where: { slug } });
  const options = await prisma.customizationOption.findMany({
    where: { vehicleId: vehicle.id, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
  const defaults = Object.fromEntries(
    SINGLE_SELECT_CATEGORIES.map((category) => [category, options.find((o) => o.category === category && o.isDefault)!.id]),
  );
  return {
    vehicleId: vehicle.id,
    vehicleName: vehicle.name,
    defaults,
    // "Custom Color" is left out: it needs a hex, and the fixtures don't need it.
    paints: options.filter((o) => o.category === "PAINT" && o.assetRef !== "paint-custom").map((o) => o.id),
    wheels: options.filter((o) => o.category === "WHEELS").map((o) => o.id),
  };
}

/**
 * Inserts `count` saved builds with the given paint + wheels straight through Prisma — test
 * data at a volume the save endpoint's rate limit (10/min) wouldn't allow over HTTP. Only the
 * selections matter to the rarity aggregation; the total is a placeholder.
 */
export async function insertBuilds(
  prisma: PrismaClient,
  vehicle: RarityVehicleOptions,
  paintId: string,
  wheelsId: string,
  count: number,
  extra: { createdAt?: Date; expiresAt?: Date | null } = {},
): Promise<string[]> {
  const publicIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const publicId = await generatePublicId(vehicle.vehicleName, async (candidate) =>
      Boolean(await prisma.configuration.findUnique({ where: { publicId: candidate }, select: { id: true } })),
    );
    const optionIds = Object.values({ ...vehicle.defaults, PAINT: paintId, WHEELS: wheelsId });
    await prisma.configuration.create({
      data: {
        publicId,
        vehicleId: vehicle.vehicleId,
        totalPriceCents: 0,
        expiresAt: extra.expiresAt ?? null,
        ...(extra.createdAt ? { createdAt: extra.createdAt } : {}),
        selections: { create: optionIds.map((optionId) => ({ optionId })) },
      },
    });
    publicIds.push(publicId);
  }
  return publicIds;
}

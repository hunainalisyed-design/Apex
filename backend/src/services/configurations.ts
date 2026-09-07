import { Prisma, type CustomizationOption, type Vehicle } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { MULTI_SELECT_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "../types/catalog.js";
import type { OptionCategory } from "../types/catalog.js";
import type { SaveConfigurationRequest, SavedConfigurationDto } from "../types/configuration.js";
import type { MultiSelectCategory, SingleSelectCategory } from "../types/pricing.js";
import { mapOptionToDto } from "./catalog.js";
import { calculatePrice } from "./pricing.js";
import { generatePublicId } from "./publicId.js";

const EXPIRES_IN_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_CREATE_ATTEMPTS = 3;

export interface CreateConfigurationInput extends Omit<SaveConfigurationRequest, "vehicleSlug"> {
  vehicle: Vehicle;
  options: CustomizationOption[];
}

/**
 * Persists a configuration. calculatePrice is called first — same as pricing.ts's route,
 * this both produces the breakdown and is free validation, letting PricingError propagate
 * uncaught to the route's existing status-map catch block.
 */
export async function createConfiguration(input: CreateConfigurationInput): Promise<SavedConfigurationDto> {
  const breakdown = calculatePrice({
    vehicle: {
      slug: input.vehicle.slug,
      basePriceCents: input.vehicle.basePriceCents,
      currency: input.vehicle.currency,
    },
    options: input.options.map(mapOptionToDto),
    singleSelections: input.singleSelections,
    multiSelections: input.multiSelections,
  });

  const optionIds = [...Object.values(input.singleSelections), ...Object.values(input.multiSelections).flat()];
  const configuration = await createWithFreshPublicId(
    input.vehicle,
    optionIds,
    breakdown.totalPriceCents,
    input.customPaintHex,
  );

  return {
    publicId: configuration.publicId,
    vehicleSlug: input.vehicle.slug,
    singleSelections: input.singleSelections,
    multiSelections: input.multiSelections,
    customPaintHex: input.customPaintHex,
    breakdown,
    createdAt: configuration.createdAt.toISOString(),
  };
}

/**
 * generatePublicId's own isTaken pre-check isn't atomic with this create — two concurrent
 * saves could both pass the check for the same candidate. Defense-in-depth: on a unique-
 * constraint violation targeting publicId specifically, regenerate and retry; anything
 * else propagates (there's no global error handler in app.ts, so an uncaught P2002 would
 * otherwise surface as a raw 500).
 */
async function createWithFreshPublicId(
  vehicle: Vehicle,
  optionIds: string[],
  totalPriceCents: number,
  customPaintHex: string | null,
) {
  for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt++) {
    const publicId = await generatePublicId(vehicle.name, (candidate) =>
      prisma.configuration.findUnique({ where: { publicId: candidate } }).then(Boolean),
    );

    try {
      return await prisma.configuration.create({
        data: {
          publicId,
          vehicleId: vehicle.id,
          totalPriceCents,
          customPaintHex,
          expiresAt: new Date(Date.now() + EXPIRES_IN_MS),
          selections: { create: optionIds.map((optionId) => ({ optionId })) },
        },
      });
    } catch (err) {
      const isPublicIdCollision =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        (err.meta?.target as string[] | undefined)?.includes("publicId");
      if (!isPublicIdCollision || attempt === MAX_CREATE_ATTEMPTS - 1) throw err;
    }
  }
  // Unreachable — the loop above always either returns or throws on its final attempt.
  throw new Error("createWithFreshPublicId: exhausted attempts without returning or throwing");
}

/**
 * The schema stores only optionId join rows (no denormalized name/price), so the returned
 * breakdown is recomputed live via calculatePrice against the exact options that were
 * originally selected — not read verbatim from the stored totalPriceCents snapshot, which
 * exists for other future uses (e.g. a My Garage list), not this endpoint. Refreshes
 * expiresAt to another 90 days out on every load (AC-11), so actively-shared builds don't
 * expire out from under people still viewing them.
 */
export async function getConfigurationByPublicId(publicId: string): Promise<SavedConfigurationDto | null> {
  const configuration = await prisma.configuration.findUnique({
    where: { publicId },
    include: { vehicle: true, selections: { include: { option: true } } },
  });

  if (!configuration) return null;

  const singleSelections = {} as Record<SingleSelectCategory, string>;
  const multiSelections = Object.fromEntries(
    MULTI_SELECT_CATEGORIES.map((category): [MultiSelectCategory, string[]] => [category, []]),
  ) as Record<MultiSelectCategory, string[]>;

  for (const selection of configuration.selections) {
    const category = selection.option.category as OptionCategory;
    if ((SINGLE_SELECT_CATEGORIES as readonly OptionCategory[]).includes(category)) {
      singleSelections[category as SingleSelectCategory] = selection.optionId;
    } else {
      multiSelections[category as MultiSelectCategory].push(selection.optionId);
    }
  }

  const breakdown = calculatePrice({
    vehicle: {
      slug: configuration.vehicle.slug,
      basePriceCents: configuration.vehicle.basePriceCents,
      currency: configuration.vehicle.currency,
    },
    options: configuration.selections.map((s) => mapOptionToDto(s.option)),
    singleSelections,
    multiSelections,
  });

  await prisma.configuration.update({
    where: { id: configuration.id },
    data: { expiresAt: new Date(Date.now() + EXPIRES_IN_MS) },
  });

  return {
    publicId: configuration.publicId,
    vehicleSlug: configuration.vehicle.slug,
    singleSelections,
    multiSelections,
    customPaintHex: configuration.customPaintHex,
    breakdown,
    createdAt: configuration.createdAt.toISOString(),
  };
}

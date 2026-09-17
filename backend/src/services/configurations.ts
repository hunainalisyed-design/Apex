import { Prisma, type CustomizationOption, type Vehicle } from "@prisma/client";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { MULTI_SELECT_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "../types/catalog.js";
import type { OptionCategory } from "../types/catalog.js";
import type { SaveConfigurationRequest, SavedConfigurationDto } from "../types/configuration.js";
import type { MultiSelectCategory, SingleSelectCategory } from "../types/pricing.js";
import { mapOptionToDto } from "./catalog.js";
import { calculatePrice, PricingError } from "./pricing.js";
import { generatePublicId } from "./publicId.js";

const EXPIRES_IN_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_CREATE_ATTEMPTS = 3;

export interface CreateConfigurationInput extends Omit<SaveConfigurationRequest, "vehicleSlug"> {
  vehicle: Vehicle;
  options: CustomizationOption[];
  /** Set when the save is made with a valid session (Spec 17, AC-6) — the created row is
   * owned and never expires, instead of the guest path (null owner, 90-day expiry). */
  userId?: string | null;
}

type ConfigurationWithRelations = Prisma.ConfigurationGetPayload<{
  include: { vehicle: true; selections: { include: { option: true } } };
}>;

/**
 * Maps a Configuration row (with its vehicle + selections eager-loaded) to the wire DTO.
 * Shared by every read path (single lookup, list) so there is exactly one place that knows
 * how selections split back into single/multi-select maps and how the breakdown is
 * recomputed — never read verbatim from the stored totalPriceCents snapshot.
 */
function mapConfigurationToDto(configuration: ConfigurationWithRelations): SavedConfigurationDto {
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

  return {
    publicId: configuration.publicId,
    vehicleSlug: configuration.vehicle.slug,
    singleSelections,
    multiSelections,
    customPaintHex: configuration.customPaintHex,
    breakdown,
    createdAt: configuration.createdAt.toISOString(),
    ownerId: configuration.userId,
  };
}

/**
 * Persists a configuration. calculatePrice is called first — same as pricing.ts's route,
 * this both produces the breakdown and is free validation, letting PricingError propagate
 * uncaught to the route's existing status-map catch block.
 */
export async function createConfiguration(input: CreateConfigurationInput): Promise<SavedConfigurationDto> {
  // Spec 22 AC-4: structured log for this pricing calculation too — every configuration save
  // recomputes and persists a total, so it's as much "a pricing calculation" as the dedicated
  // POST /api/pricing/calculate endpoint.
  const pricingStartedAt = Date.now();
  let breakdown;
  try {
    breakdown = calculatePrice({
      vehicle: {
        slug: input.vehicle.slug,
        basePriceCents: input.vehicle.basePriceCents,
        currency: input.vehicle.currency,
      },
      options: input.options.map(mapOptionToDto),
      singleSelections: input.singleSelections,
      multiSelections: input.multiSelections,
    });
  } catch (err) {
    logger.info(
      {
        vehicleSlug: input.vehicle.slug,
        latencyMs: Date.now() - pricingStartedAt,
        outcome: err instanceof PricingError ? "validation-rejected" : "error",
      },
      "pricing.calculate",
    );
    throw err;
  }
  logger.info(
    { vehicleSlug: input.vehicle.slug, latencyMs: Date.now() - pricingStartedAt, outcome: "success" },
    "pricing.calculate",
  );

  const optionIds = [...Object.values(input.singleSelections), ...Object.values(input.multiSelections).flat()];
  const configuration = await createWithFreshPublicId(
    input.vehicle,
    optionIds,
    breakdown.totalPriceCents,
    input.customPaintHex,
    input.userId ?? null,
  );

  return {
    publicId: configuration.publicId,
    vehicleSlug: input.vehicle.slug,
    singleSelections: input.singleSelections,
    multiSelections: input.multiSelections,
    customPaintHex: input.customPaintHex,
    breakdown,
    createdAt: configuration.createdAt.toISOString(),
    ownerId: configuration.userId,
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
  userId: string | null,
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
          userId,
          // A signed-in save (Spec 17, AC-6) never expires; a guest save gets the
          // existing 90-day retention window.
          expiresAt: userId ? null : new Date(Date.now() + EXPIRES_IN_MS),
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
 * exists for other future uses (e.g. My Garage), not this endpoint. Refreshes expiresAt to
 * another 90 days out on every load for a GUEST build only (AC-11 of Spec 10), so actively-
 * shared builds don't expire out from under people still viewing them — an owned build
 * (userId set) is never touched, since Spec 17 AC-6/§4 requires it to never expire; without
 * this guard, every "Load" from My Garage would silently re-add a 90-day expiry to a build
 * that's supposed to be permanent.
 */
export async function getConfigurationByPublicId(publicId: string): Promise<SavedConfigurationDto | null> {
  const configuration = await prisma.configuration.findUnique({
    where: { publicId },
    include: { vehicle: true, selections: { include: { option: true } } },
  });

  if (!configuration) return null;

  if (!configuration.userId) {
    await prisma.configuration.update({
      where: { id: configuration.id },
      data: { expiresAt: new Date(Date.now() + EXPIRES_IN_MS) },
    });
  }

  return mapConfigurationToDto(configuration);
}

/** The current user's saved builds, most recently saved first (Spec 17, AC-2). No
 * expiresAt refresh here — owned builds never expire, so there's nothing to extend. */
export async function getConfigurationsForUser(userId: string): Promise<SavedConfigurationDto[]> {
  const configurations = await prisma.configuration.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { vehicle: true, selections: { include: { option: true } } },
  });

  return configurations.map(mapConfigurationToDto);
}

export type DeleteConfigurationResult = { ok: true } | { ok: false; reason: "NOT_FOUND" | "HAS_DEPENDENTS" };

/**
 * Deletes a configuration, scoped to the caller's ownership in the same query — a
 * mismatched publicId and a publicId owned by someone else are indistinguishable to the
 * caller (both delete zero rows), matching Spec 17's "never confirm existence to a
 * non-owner" error-table note.
 *
 * Spec 19 gave `Lead.configurationId`, and Spec 20 gave `Reservation.configurationId`, both
 * required, Restrict-by-default FKs to this table — deleteMany enforces that Postgres
 * constraint exactly like delete would, so once any Lead or Reservation references this
 * row, the delete throws P2003. Left uncaught, that would propagate as an unhandled
 * rejection: this backend runs Express 4 (no auto-catch of a rejected async handler) with
 * no error-handling middleware, and Node terminates the process on an unhandled rejection
 * by default — so an uncaught P2003 here wouldn't just fail one request, it would crash the
 * whole backend. Caught and turned into a normal "blocked" result instead (deliberately not
 * distinguishing which table caused it — the caller doesn't need to know, just that
 * something does). Exported as a real result type (not a route-local try/catch) since a
 * future guest-build expiry sweep job will hit this identical failure mode at batch scale.
 */
export async function deleteConfigurationForUser(publicId: string, userId: string): Promise<DeleteConfigurationResult> {
  try {
    const result = await prisma.configuration.deleteMany({ where: { publicId, userId } });
    return result.count > 0 ? { ok: true } : { ok: false, reason: "NOT_FOUND" };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2003") {
      return { ok: false, reason: "HAS_DEPENDENTS" };
    }
    throw err;
  }
}

export type ClaimOutcome = "claim" | "idempotent" | "conflict";

/**
 * Pure decision logic for claiming a guest build (Spec 17, AC-7/AC-8) — no Prisma, so it's
 * unit-testable in isolation (backend/tests/garage.test.ts) the same way Spec 16's
 * auth.test.ts only unit-tests pure crypto/policy functions, leaving DB-touching behavior
 * to the integration layer. "idempotent" (re-claiming a build you already own) is a
 * deliberate judgment call for an ambiguous spec case: a self-claim isn't an ownership
 * change, so success is more appropriate than a 409 conflict.
 */
export function decideClaimOutcome(existingUserId: string | null, callerUserId: string): ClaimOutcome {
  if (existingUserId === null) return "claim";
  if (existingUserId === callerUserId) return "idempotent";
  return "conflict";
}

export type ClaimResult =
  | { ok: true; dto: SavedConfigurationDto }
  | { ok: false; reason: "NOT_FOUND" | "ALREADY_CLAIMED" };

/** Claims an unowned (guest) build for the caller (Spec 17, AC-7). The initial updateMany
 * is scoped to userId: null so a genuine claim is atomic against a concurrent claim
 * attempt; the fallback read after a zero-row update only distinguishes the error case
 * (not found vs. already claimed) for the response, it never itself performs a write. */
export async function claimConfigurationForUser(publicId: string, userId: string): Promise<ClaimResult> {
  const claimed = await prisma.configuration.updateMany({
    where: { publicId, userId: null },
    data: { userId, expiresAt: null },
  });

  if (claimed.count > 0) {
    const configuration = await prisma.configuration.findUniqueOrThrow({
      where: { publicId },
      include: { vehicle: true, selections: { include: { option: true } } },
    });
    return { ok: true, dto: mapConfigurationToDto(configuration) };
  }

  const existing = await prisma.configuration.findUnique({ where: { publicId } });
  if (!existing) return { ok: false, reason: "NOT_FOUND" };

  const outcome = decideClaimOutcome(existing.userId, userId);
  if (outcome === "conflict") return { ok: false, reason: "ALREADY_CLAIMED" };

  // "idempotent": already claimed by this same caller — return current state as success.
  const configuration = await prisma.configuration.findUniqueOrThrow({
    where: { publicId },
    include: { vehicle: true, selections: { include: { option: true } } },
  });
  return { ok: true, dto: mapConfigurationToDto(configuration) };
}

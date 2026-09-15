import type { CustomizationOption } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { mapOptionToDto } from "../catalog.js";
import { SINGLE_SELECT_CATEGORIES, type OptionCategory } from "../../types/catalog.js";
import type { CreateOptionRequest, OptionAdminDto, UpdateOptionRequest } from "../../types/admin.js";

function mapOptionToAdminDto(option: CustomizationOption): OptionAdminDto {
  return { ...mapOptionToDto(option), isActive: option.isActive };
}

const isSingleSelect = (category: OptionCategory): boolean =>
  (SINGLE_SELECT_CATEGORIES as readonly string[]).includes(category);

/**
 * Guards the "every single-select category has exactly one active default" invariant
 * (Spec 6/8) against an admin write that would REGRESS it — never blocks a category that's
 * simply still incomplete (a brand-new vehicle with zero options yet in a category has zero
 * active defaults there, and that's fine; nothing is selectable from an empty category
 * anyway, so there's nothing to break). What it must reject:
 *   - ending up with more than one active default (ambiguous for pricing/appearance
 *     resolution's findSelectedOption), or
 *   - removing the category's *sole* existing active default (leaving a previously-complete
 *     category with nothing to pre-select, which would break the live public configurator).
 * `previousState` is the option's own current {isDefault, isActive} before this write (null
 * for a create, where there is no "before"). `siblingDefaultCount` is the number of *other*
 * active options in the same category/vehicle that are already marked default.
 */
async function wouldViolateDefaultInvariant(
  vehicleId: string,
  category: OptionCategory,
  hypothetical: { isDefault: boolean; isActive: boolean },
  previousState: { isDefault: boolean; isActive: boolean } | null,
  excludeOptionId?: string,
): Promise<boolean> {
  if (!isSingleSelect(category)) return false;

  const siblings = await prisma.customizationOption.findMany({
    where: { vehicleId, category, isActive: true, ...(excludeOptionId ? { id: { not: excludeOptionId } } : {}) },
    select: { isDefault: true },
  });
  const siblingDefaultCount = siblings.filter((s) => s.isDefault).length;

  const wasActiveDefault = !!previousState && previousState.isActive && previousState.isDefault;
  const beforeCount = siblingDefaultCount + (wasActiveDefault ? 1 : 0);
  const afterCount = siblingDefaultCount + (hypothetical.isActive && hypothetical.isDefault ? 1 : 0);

  if (afterCount > 1) return true; // would create two active defaults
  if (beforeCount === 1 && afterCount === 0) return true; // would remove the sole existing default
  return false;
}

/** Unlike GET /vehicles/:slug/options (public, isActive:true only), the admin list shows
 * every option for the vehicle so a deactivated one can be found and reactivated. Not in the
 * spec's original endpoint table — added because AC-3's "add, edit, remove" flow has no way
 * to know what to edit without a listing endpoint; see docs/specs/21-admin-cms-panel.md's
 * updated API contract. */
export async function listOptions(vehicleId: string): Promise<OptionAdminDto[]> {
  const options = await prisma.customizationOption.findMany({
    where: { vehicleId },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
  return options.map(mapOptionToAdminDto);
}

export type CreateOptionResult =
  | { ok: true; option: OptionAdminDto }
  | { ok: false; reason: "VEHICLE_NOT_FOUND" }
  | { ok: false; reason: "VALIDATION_ERROR"; message: string };

export async function createOption(vehicleId: string, input: CreateOptionRequest): Promise<CreateOptionResult> {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) return { ok: false, reason: "VEHICLE_NOT_FOUND" };

  if (await wouldViolateDefaultInvariant(vehicleId, input.category, { isDefault: input.isDefault, isActive: true }, null)) {
    return {
      ok: false,
      reason: "VALIDATION_ERROR",
      message: `${input.category} already has an active default option — creating this as another default would leave two. Deactivate or un-default the existing one first.`,
    };
  }

  const option = await prisma.customizationOption.create({
    data: {
      vehicleId,
      category: input.category,
      name: input.name,
      description: input.description,
      priceDeltaCents: input.priceDeltaCents,
      assetRef: input.assetRef,
      swatchColor: input.swatchColor,
      applyMode: input.applyMode,
      isDefault: input.isDefault,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  return { ok: true, option: mapOptionToAdminDto(option) };
}

export type UpdateOptionResult =
  | { ok: true; option: OptionAdminDto }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "VALIDATION_ERROR"; message: string };

/** Handles both AC-3's "edit" and "remove" (removal is `{isActive: false}` here — there's no
 * separate DELETE-as-hard-delete path; the DELETE route below calls this with that body). */
export async function updateOption(id: string, input: UpdateOptionRequest): Promise<UpdateOptionResult> {
  const existing = await prisma.customizationOption.findUnique({ where: { id } });
  if (!existing) return { ok: false, reason: "NOT_FOUND" };

  const hypothetical = {
    isDefault: input.isDefault ?? existing.isDefault,
    isActive: input.isActive ?? existing.isActive,
  };
  const previousState = { isDefault: existing.isDefault, isActive: existing.isActive };
  if (
    await wouldViolateDefaultInvariant(existing.vehicleId, existing.category as OptionCategory, hypothetical, previousState, id)
  ) {
    return {
      ok: false,
      reason: "VALIDATION_ERROR",
      message: `This change would leave ${existing.category} without exactly one active default option.`,
    };
  }

  const option = await prisma.customizationOption.update({ where: { id }, data: input });
  return { ok: true, option: mapOptionToAdminDto(option) };
}

export type DeactivateOptionResult = { ok: true; option: OptionAdminDto } | UpdateOptionResult;

/** AC-3's "remove" — always a soft-deactivation, never a hard delete, so existing saved
 * Configurations referencing this option (ConfigurationSelection has no onDelete override —
 * Prisma's default Restrict — a hard delete would fail outright for any option ever
 * selected in a saved build) keep resolving normally. */
export async function deactivateOption(id: string): Promise<DeactivateOptionResult> {
  return updateOption(id, { isActive: false });
}

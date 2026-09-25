import type { CustomizationOption, Vehicle } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import {
  ALL_CATEGORIES,
  SINGLE_SELECT_CATEGORIES,
  type ApplyMode,
  type CustomizationOptionDto,
  type OptionCategory,
  type VehicleDetailDto,
  type VehicleSummaryDto,
} from "../types/catalog.js";

export async function getVehicleWithOptions(slug: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { slug, isActive: true },
  });

  if (!vehicle) {
    return null;
  }

  // isActive: true — a deactivated option (Spec 21 AC-3's soft-delete) must disappear from
  // every public read, not just the admin panel's write path, otherwise deactivating an
  // option here would have no visible effect on the actual configurator.
  const options = await prisma.customizationOption.findMany({
    where: { vehicleId: vehicle.id, isActive: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return { vehicle, options };
}

export function mapOptionToDto(option: CustomizationOption): CustomizationOptionDto {
  return {
    id: option.id,
    category: option.category as OptionCategory,
    name: option.name,
    description: option.description,
    priceDeltaCents: option.priceDeltaCents,
    assetRef: option.assetRef,
    swatchColor: option.swatchColor,
    applyMode: option.applyMode as ApplyMode,
    isDefault: option.isDefault,
    sortOrder: option.sortOrder,
  };
}

export function mapVehicleToSummaryDto(vehicle: Vehicle): VehicleSummaryDto {
  return {
    slug: vehicle.slug,
    name: vehicle.name,
    tagline: vehicle.tagline,
    basePriceCents: vehicle.basePriceCents,
    currency: vehicle.currency,
    horsepower: vehicle.horsepower,
    topSpeedKph: vehicle.topSpeedKph,
    // Prisma's Decimal is not a plain number — JSON-serializing it directly
    // doesn't produce a numeric value, so it must be converted explicitly.
    zeroToHundredSec: Number(vehicle.zeroToHundredSec),
    thumbnailUrl: vehicle.thumbnailUrl,
    fallbackImageUrl: vehicle.fallbackImageUrl,
    heroModelUrl: vehicle.heroModelUrl,
    showroomModelUrl: vehicle.showroomModelUrl,
  };
}

export function mapVehicleToDetailDto(
  vehicle: Vehicle,
  options: CustomizationOption[],
): VehicleDetailDto {
  const grouped = Object.fromEntries(
    ALL_CATEGORIES.map((category) => [category, [] as CustomizationOptionDto[]]),
  ) as Record<OptionCategory, CustomizationOptionDto[]>;

  for (const option of options) {
    grouped[option.category as OptionCategory].push(mapOptionToDto(option));
  }

  return {
    ...mapVehicleToSummaryDto(vehicle),
    options: grouped,
  };
}

export interface DefaultViolation {
  category: OptionCategory;
  defaultCount: number;
}

/** Every SINGLE_SELECT_CATEGORIES category must have exactly one isDefault:true option.
 * Returns the categories that violate this, empty when the catalog is valid. */
export function validateSingleSelectDefaults(
  options: Pick<CustomizationOption, "category" | "isDefault">[],
): DefaultViolation[] {
  const violations: DefaultViolation[] = [];

  for (const category of SINGLE_SELECT_CATEGORIES) {
    const defaultCount = options.filter(
      (option) => option.category === category && option.isDefault,
    ).length;

    if (defaultCount !== 1) {
      violations.push({ category, defaultCount });
    }
  }

  return violations;
}

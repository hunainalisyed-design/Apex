import type { CustomizationOption, Vehicle } from "@prisma/client";
import {
  ALL_CATEGORIES,
  SINGLE_SELECT_CATEGORIES,
  type CustomizationOptionDto,
  type OptionCategory,
  type VehicleDetailDto,
  type VehicleSummaryDto,
} from "../types/catalog.js";

export function mapOptionToDto(option: CustomizationOption): CustomizationOptionDto {
  return {
    id: option.id,
    category: option.category as OptionCategory,
    name: option.name,
    description: option.description,
    priceDeltaCents: option.priceDeltaCents,
    assetRef: option.assetRef,
    swatchColor: option.swatchColor,
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
    heroModelUrl: vehicle.heroModelUrl,
    showroomModelUrl: vehicle.showroomModelUrl,
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

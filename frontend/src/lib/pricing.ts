import { MULTI_SELECT_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "@/types/catalog";
import type {
  MultiSelectCategory,
  PriceBreakdownDto,
  PriceLineItemDto,
  SingleSelectCategory,
} from "@/types/pricing";

export type PricingErrorCode = "VALIDATION_ERROR" | "OPTION_VEHICLE_MISMATCH" | "DUPLICATE_OPTION_SELECTION";

export class PricingError extends Error {
  code: PricingErrorCode;

  constructor(code: PricingErrorCode, message: string) {
    super(message);
    this.name = "PricingError";
    this.code = code;
  }
}

export type PricingOption = Pick<PriceLineItemDto, "category" | "name" | "priceDeltaCents"> & {
  id: string;
};

export interface CalculatePriceInput {
  vehicle: { slug: string; basePriceCents: number; currency: string };
  /** The vehicle's full available catalog — selections are resolved against this list. */
  options: PricingOption[];
  singleSelections: Partial<Record<SingleSelectCategory, string>>;
  multiSelections: Partial<Record<MultiSelectCategory, string[]>>;
}

/**
 * The one formula: basePriceCents + sum of every selected option's priceDeltaCents.
 * Implemented identically (duplicated, not shared) on the backend — see
 * docs/specs/03-dynamic-pricing-engine.md Risk #1 for why, and fixtures/pricing-cases.json
 * for the contract test that catches drift between the two. Synchronous by design (AC-7):
 * no network round trip between a selection change and the displayed total updating.
 */
export function calculatePrice(input: CalculatePriceInput): PriceBreakdownDto {
  const optionById = new Map(input.options.map((option) => [option.id, option]));
  const lineItems: PriceLineItemDto[] = [];

  const toLineItem = (optionId: string, option: PricingOption): PriceLineItemDto => ({
    optionId,
    category: option.category,
    name: option.name,
    priceDeltaCents: option.priceDeltaCents,
  });

  for (const category of SINGLE_SELECT_CATEGORIES) {
    const optionId = input.singleSelections[category];
    if (!optionId) {
      throw new PricingError(
        "VALIDATION_ERROR",
        `Missing selection for required category "${category}".`,
      );
    }

    const option = optionById.get(optionId);
    if (!option) {
      throw new PricingError(
        "OPTION_VEHICLE_MISMATCH",
        `Option "${optionId}" does not belong to vehicle "${input.vehicle.slug}".`,
      );
    }
    if (option.category !== category) {
      throw new PricingError(
        "VALIDATION_ERROR",
        `Option "${optionId}" is not in category "${category}".`,
      );
    }

    lineItems.push(toLineItem(optionId, option));
  }

  for (const category of MULTI_SELECT_CATEGORIES) {
    const optionIds = input.multiSelections[category] ?? [];
    const seen = new Set<string>();

    for (const optionId of optionIds) {
      if (seen.has(optionId)) {
        throw new PricingError(
          "DUPLICATE_OPTION_SELECTION",
          `Option "${optionId}" is selected more than once in category "${category}".`,
        );
      }
      seen.add(optionId);

      const option = optionById.get(optionId);
      if (!option) {
        throw new PricingError(
          "OPTION_VEHICLE_MISMATCH",
          `Option "${optionId}" does not belong to vehicle "${input.vehicle.slug}".`,
        );
      }
      if (option.category !== category) {
        throw new PricingError(
          "VALIDATION_ERROR",
          `Option "${optionId}" is not in category "${category}".`,
        );
      }

      lineItems.push(toLineItem(optionId, option));
    }
  }

  const totalPriceCents =
    input.vehicle.basePriceCents + lineItems.reduce((sum, item) => sum + item.priceDeltaCents, 0);

  return {
    vehicleSlug: input.vehicle.slug,
    basePriceCents: input.vehicle.basePriceCents,
    lineItems,
    totalPriceCents,
    currency: input.vehicle.currency,
  };
}

import type { MULTI_SELECT_CATEGORIES, OptionCategory, SINGLE_SELECT_CATEGORIES } from "./catalog";

export type SingleSelectCategory = (typeof SINGLE_SELECT_CATEGORIES)[number];
export type MultiSelectCategory = (typeof MULTI_SELECT_CATEGORIES)[number];

export interface PriceCalculationRequest {
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>; // exactly one CustomizationOption id per category
  multiSelections: Record<MultiSelectCategory, string[]>; // zero or more ids per category
}

export interface PriceLineItemDto {
  optionId: string;
  category: OptionCategory;
  name: string;
  priceDeltaCents: number;
}

export interface PriceBreakdownDto {
  vehicleSlug: string;
  basePriceCents: number;
  lineItems: PriceLineItemDto[];
  totalPriceCents: number;
  currency: string;
}

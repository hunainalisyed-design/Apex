import type { MultiSelectCategory, PriceBreakdownDto, SingleSelectCategory } from "./pricing.js";

export interface SaveConfigurationRequest {
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
  customPaintHex: string | null;
}

export interface SavedConfigurationDto {
  publicId: string; // e.g. "APEX-7F82-K91X"
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
  customPaintHex: string | null;
  breakdown: PriceBreakdownDto; // computed via calculatePrice, never read verbatim from storage
  createdAt: string; // ISO 8601
}

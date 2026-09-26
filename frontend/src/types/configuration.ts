import type { MultiSelectCategory, PriceBreakdownDto, SingleSelectCategory } from "./pricing";

export interface SaveConfigurationRequest {
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
  customPaintHex: string | null;
  /** Spec 28: the showroom environment to save with the build. null = default Studio. */
  environmentId?: string | null;
}

export interface SavedConfigurationDto {
  publicId: string; // e.g. "APEX-7F82-K91X"
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
  customPaintHex: string | null;
  /** Spec 28: null = the default Studio environment. */
  environmentId: string | null;
  breakdown: PriceBreakdownDto;
  createdAt: string; // ISO 8601
  /** null = guest build, claimable (Spec 17 AC-7). Set = owned, never expires. */
  ownerId: string | null;
  /** Spec 31: whether the build is in the public gallery, and since when (ISO 8601). */
  isPublished: boolean;
  publishedAt: string | null;
}

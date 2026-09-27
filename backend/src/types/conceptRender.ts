import type { MultiSelectCategory, SingleSelectCategory } from "./pricing.js";

/** POST /api/ai/concept-render (Spec 35) — the user's current build; no free text at all. */
export interface ConceptRenderRequest {
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
  /** Only with the Custom Color paint — described in the prompt as that color. */
  customPaintHex?: string | null;
}

export interface ConceptRenderDto {
  /** The image itself, as a data: URL — never a link to the provider, and never stored. */
  imageUrl: string;
  /** True for the development placeholder (no real image provider connected yet). */
  isPlaceholder: boolean;
}

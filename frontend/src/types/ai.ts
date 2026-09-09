import type { MultiSelectCategory, PriceBreakdownDto, SingleSelectCategory } from "./pricing";

export interface AiConfigureRequest {
  vehicleSlug: string;
  message: string; // the user's latest natural-language message
  history?: { role: "user" | "assistant"; content: string }[]; // prior turns, most-recent last, for context
  currentSelections: {
    singleSelections: Record<SingleSelectCategory, string>;
    multiSelections: Record<MultiSelectCategory, string[]>;
  };
}

export interface AiConfigureRecommendation {
  singleSelections: Partial<Record<SingleSelectCategory, string>>; // only categories CarAI chose to change
  multiSelections: Partial<Record<MultiSelectCategory, string[]>>; // accessories/packages to add
}

export interface AiConfigureResponseDto {
  assistantMessage: string; // CarAI's natural-language reply, always present
  recommendation: AiConfigureRecommendation | null; // null when no change is warranted (AC-4)
  breakdown: PriceBreakdownDto | null; // present only when recommendation is non-null (AC-3)
}

import { MULTI_SELECT_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "../../types/catalog.js";
import type { CustomizationOptionDto } from "../../types/catalog.js";
import type { AiConfigureRecommendation } from "../../types/ai.js";
import type { MultiSelectCategory, SingleSelectCategory } from "../../types/pricing.js";

/** The forced tool's raw per-category input — every category present, `string | null` for
 * single-select fields, `string[] | null` for multi-select fields (see buildToolSchema.ts). */
export type RawToolRecommendation = Record<string, unknown>;

/**
 * Re-validates every (category, optionId) pair CarAI returned against the current catalog
 * (Spec 14, AC-2) — defense in depth on top of buildConfigureToolSchema's own enum
 * constraint, not a replacement for it. Any pair that fails (wrong id, id belongs to a
 * different category, wrong type) is silently dropped rather than failing the request.
 */
export function validateRecommendation(
  raw: RawToolRecommendation,
  options: CustomizationOptionDto[],
): AiConfigureRecommendation {
  const optionById = new Map(options.map((option) => [option.id, option]));

  const singleSelections: Partial<Record<SingleSelectCategory, string>> = {};
  for (const category of SINGLE_SELECT_CATEGORIES) {
    const value = raw[category];
    if (typeof value !== "string") continue;
    const option = optionById.get(value);
    if (!option || option.category !== category) continue;
    singleSelections[category] = value;
  }

  const multiSelections: Partial<Record<MultiSelectCategory, string[]>> = {};
  for (const category of MULTI_SELECT_CATEGORIES) {
    const value = raw[category];
    if (!Array.isArray(value)) continue;
    const validIds = value.filter((id): id is string => {
      if (typeof id !== "string") return false;
      const option = optionById.get(id);
      return option !== undefined && option.category === category;
    });
    if (validIds.length > 0) multiSelections[category] = validIds;
  }

  return { singleSelections, multiSelections };
}

import { MULTI_SELECT_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "@/types/catalog";
import type { AiConfigureRecommendation } from "@/types/ai";
import type { MultiSelectCategory, SingleSelectCategory } from "@/types/pricing";

export interface SelectionState {
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
  customPaintHex: string | null;
}

/**
 * What the build would be after applying a CarAI recommendation (Spec 36) — without applying
 * it. Mirrors carAiChatStore.applyRecommendation exactly (a test holds them together): each
 * recommended single-select replaces that category (choosing a paint clears a custom color, as
 * setSingleSelection does), and recommended accessories/packages are added if not already there
 * (never removed). The slider's "after" picture is made from this, so it shows what Apply does.
 */
export function mergeRecommendation(current: SelectionState, recommendation: AiConfigureRecommendation): SelectionState {
  const singleSelections = { ...current.singleSelections };
  let customPaintHex = current.customPaintHex;
  for (const category of SINGLE_SELECT_CATEGORIES) {
    const optionId = recommendation.singleSelections[category];
    if (!optionId) continue;
    singleSelections[category] = optionId;
    if (category === "PAINT") customPaintHex = null;
  }

  const multiSelections = { ...current.multiSelections };
  for (const category of MULTI_SELECT_CATEGORIES) {
    const recommended = recommendation.multiSelections[category];
    if (!recommended) continue;
    const next = [...multiSelections[category]];
    for (const optionId of recommended) if (!next.includes(optionId)) next.push(optionId);
    multiSelections[category] = next;
  }

  return { singleSelections, multiSelections, customPaintHex };
}

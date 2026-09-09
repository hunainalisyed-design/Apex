import { CATEGORY_LABELS } from "@/components/configurator/categoryLabels";
import { formatPriceCents } from "@/lib/format/currency";
import { MULTI_SELECT_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "@/types/catalog";
import type { AiConfigureRecommendation } from "@/types/ai";
import type { PriceBreakdownDto } from "@/types/pricing";

export interface RecommendationCardProps {
  recommendation: AiConfigureRecommendation;
  breakdown: PriceBreakdownDto;
  applied: boolean;
  onApply: () => void;
}

interface ChangedLine {
  key: string;
  label: string;
  optionName: string;
}

/**
 * Builds the card's list purely from the recommendation (which ids/categories changed) and
 * the breakdown's own lineItems (their resolved names, from the real calculatePrice call
 * the backend already ran) — no vehicle prop, no second id->name lookup, and it structurally
 * can't drift from what was actually priced (Spec 15, AC-5). Multi-select categories are
 * filtered by id membership in the recommendation's array, not just by category, since
 * lineItems also includes options the user already had before this recommendation.
 */
function buildChangedLines(recommendation: AiConfigureRecommendation, breakdown: PriceBreakdownDto): ChangedLine[] {
  const lines: ChangedLine[] = [];

  for (const category of SINGLE_SELECT_CATEGORIES) {
    const optionId = recommendation.singleSelections[category];
    if (!optionId) continue;
    const lineItem = breakdown.lineItems.find((item) => item.category === category && item.optionId === optionId);
    if (!lineItem) continue;
    lines.push({ key: `${category}-${optionId}`, label: CATEGORY_LABELS[category], optionName: lineItem.name });
  }

  for (const category of MULTI_SELECT_CATEGORIES) {
    const optionIds = recommendation.multiSelections[category];
    if (!optionIds || optionIds.length === 0) continue;
    for (const optionId of optionIds) {
      const lineItem = breakdown.lineItems.find((item) => item.category === category && item.optionId === optionId);
      if (!lineItem) continue;
      lines.push({ key: `${category}-${optionId}`, label: CATEGORY_LABELS[category], optionName: lineItem.name });
    }
  }

  return lines;
}

/** CarAI's recommendation card (Spec 15, AC-5) — not rendered at all when the message has
 * no recommendation (AC-6, handled by the caller). */
export function RecommendationCard({ recommendation, breakdown, applied, onApply }: RecommendationCardProps) {
  const lines = buildChangedLines(recommendation, breakdown);

  return (
    <div className="glass-panel flex flex-col gap-3 rounded-2xl p-4">
      <ul className="flex flex-col gap-1.5 text-sm">
        {lines.map((line) => (
          <li key={line.key} className="flex items-center justify-between gap-3">
            <span className="text-white/50">{line.label}</span>
            <span className="font-semibold text-white">{line.optionName}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-white/10 pt-3">
        <span className="text-xs uppercase tracking-wide text-white/50">New total</span>
        <span className="font-semibold text-white">
          {formatPriceCents(breakdown.totalPriceCents, breakdown.currency)}
        </span>
      </div>
      <button
        type="button"
        onClick={onApply}
        disabled={applied}
        className="focus-ring rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {applied ? "Applied" : "Apply Configuration"}
      </button>
    </div>
  );
}

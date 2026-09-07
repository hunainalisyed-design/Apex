import { CATEGORY_LABELS } from "@/components/configurator/categoryLabels";
import { calculatePrice } from "@/lib/pricing";
import { DEFAULT_EXTERIOR_APPEARANCE } from "@/lib/showroom/exteriorAppearance";
import { CUSTOM_COLOR_ASSET_REF } from "@/lib/showroom/paintCustomColor";
import { SINGLE_SELECT_CATEGORIES } from "@/types/catalog";
import type { CustomizationOptionDto, OptionCategory, VehicleDetailDto } from "@/types/catalog";
import type {
  MultiSelectCategory,
  PriceBreakdownDto,
  PriceLineItemDto,
  SingleSelectCategory,
} from "@/types/pricing";

export interface BuildSummaryLine {
  category: OptionCategory;
  label: string;
  optionName: string;
  priceDeltaCents: number;
  swatchColor?: string;
}

export interface BuildSummary {
  alwaysShown: BuildSummaryLine[];
  conditionalLines: BuildSummaryLine[];
  accessories: BuildSummaryLine[];
  packages: BuildSummaryLine[];
  breakdown: PriceBreakdownDto;
}

const ALWAYS_SHOWN_CATEGORIES: readonly SingleSelectCategory[] = ["PAINT", "WHEELS", "INTERIOR_MATERIAL"];

/**
 * Derives the readable "here's what you built" line items (Spec 9) from the same live
 * selections and pricing calculation used everywhere else — never a second, drift-prone
 * source of truth. Reused verbatim by Spec 10 (save/share) and Spec 11 (screenshot
 * capture), so this stays a pure function with no React/UI dependency.
 *
 * Calls calculatePrice first: it both produces `breakdown` and is free validation (it
 * throws PricingError if any single-select category is unresolved, e.g. the render before
 * hydrateDefaults has run) — that throw is left to propagate uncaught here, exactly like
 * calculatePrice's own contract. The caller is responsible for guarding it, the same way
 * ConfigureShowroom.tsx already guards its own calculatePrice call.
 */
export function deriveBuildSummary(
  vehicle: VehicleDetailDto,
  singleSelections: Record<SingleSelectCategory, string>,
  multiSelections: Record<MultiSelectCategory, string[]>,
  customPaintHex: string | null,
): BuildSummary {
  const allOptions = Object.values(vehicle.options).flat();
  const breakdown = calculatePrice({
    vehicle: { slug: vehicle.slug, basePriceCents: vehicle.basePriceCents, currency: vehicle.currency },
    options: allOptions,
    singleSelections,
    multiSelections,
  });

  const optionById = new Map(allOptions.map((option): [string, CustomizationOptionDto] => [option.id, option]));
  const singleLineByCategory = new Map(
    breakdown.lineItems.map((line): [OptionCategory, PriceLineItemDto] => [line.category, line]),
  );

  function lineFor(category: SingleSelectCategory): BuildSummaryLine {
    // Guaranteed present — calculatePrice already threw above if any single-select
    // category didn't resolve to a valid option on this vehicle.
    const line = singleLineByCategory.get(category)!;
    const option = optionById.get(line.optionId)!;
    const isCustomColor = category === "PAINT" && option.assetRef === CUSTOM_COLOR_ASSET_REF;

    return {
      category,
      label: CATEGORY_LABELS[category],
      optionName: isCustomColor ? "Custom Color" : line.name,
      priceDeltaCents: line.priceDeltaCents,
      swatchColor: isCustomColor
        ? (customPaintHex ?? DEFAULT_EXTERIOR_APPEARANCE.paintColor)
        : (option.swatchColor ?? undefined),
    };
  }

  const alwaysShown = ALWAYS_SHOWN_CATEGORIES.map(lineFor);

  const conditionalLines = SINGLE_SELECT_CATEGORIES.filter(
    (category) => !ALWAYS_SHOWN_CATEGORIES.includes(category),
  )
    .map((category) => ({ category, line: lineFor(category) }))
    .filter(({ category }) => {
      const line = singleLineByCategory.get(category)!;
      const option = optionById.get(line.optionId)!;
      return !option.isDefault || line.priceDeltaCents !== 0;
    })
    .map(({ line }) => line);

  function multiLines(category: MultiSelectCategory): BuildSummaryLine[] {
    const active = breakdown.lineItems.filter((line) => line.category === category);
    if (active.length === 0) {
      return [{ category, label: CATEGORY_LABELS[category], optionName: "None", priceDeltaCents: 0 }];
    }
    return active.map((line) => {
      const option = optionById.get(line.optionId)!;
      return {
        category,
        label: CATEGORY_LABELS[category],
        optionName: line.name,
        priceDeltaCents: line.priceDeltaCents,
        swatchColor: option.swatchColor ?? undefined,
      };
    });
  }

  return {
    alwaysShown,
    conditionalLines,
    accessories: multiLines("ACCESSORY"),
    packages: multiLines("PACKAGE"),
    breakdown,
  };
}

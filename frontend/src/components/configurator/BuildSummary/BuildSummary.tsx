"use client";

import { CategoryGroup } from "../CategoryGroup";
import { formatPriceCents } from "@/lib/format/currency";
import { deriveBuildSummary, type BuildSummaryLine } from "@/lib/showroom/buildSummary";
import { useConfigurationStore } from "@/state/configurationStore";
import type { VehicleDetailDto } from "@/types/catalog";

export interface BuildSummaryProps {
  vehicle: VehicleDetailDto;
}

function SummaryRow({ line, currency }: { line: BuildSummaryLine; currency: string }) {
  return (
    <li className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-white/80">
        {line.swatchColor && (
          <span
            aria-hidden="true"
            className="h-3 w-3 shrink-0 rounded-full border border-white/30"
            style={{ backgroundColor: line.swatchColor }}
          />
        )}
        <span>
          {line.label}: {line.optionName}
        </span>
      </span>
      {line.priceDeltaCents !== 0 && (
        <span className="shrink-0 text-white/50">+{formatPriceCents(line.priceDeltaCents, currency)}</span>
      )}
    </li>
  );
}

/** The "here's what you've built" panel (Spec 9) — a persistent, always-visible summary
 * of the current configuration, live-updating from the same store and pricing calculation
 * every category panel already uses. Reuses CategoryGroup as its collapsible wrapper: open
 * by default like every other panel, satisfying both halves of the spec's UI-states row
 * (a persistent desktop panel, a collapsible mobile section) with no new interaction code —
 * there is no bottom-sheet component anywhere in this codebase to build one out of. */
export function BuildSummary({ vehicle }: BuildSummaryProps) {
  const singleSelections = useConfigurationStore((s) => s.singleSelections);
  const multiSelections = useConfigurationStore((s) => s.multiSelections);
  const customPaintHex = useConfigurationStore((s) => s.customPaintHex);

  let summary;
  try {
    summary = deriveBuildSummary(vehicle, singleSelections, multiSelections, customPaintHex);
  } catch {
    // Selections haven't finished hydrating yet (e.g. the very first render) — the same
    // guard ConfigureShowroom.tsx already applies around its own calculatePrice call.
    return null;
  }

  const scrollableLines = [...summary.conditionalLines, ...summary.accessories, ...summary.packages];

  return (
    <CategoryGroup title="Your Build">
      <div aria-label="Your build summary" className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-white">{vehicle.name}</p>

        <ul className="flex flex-col gap-1.5">
          {summary.alwaysShown.map((line) => (
            <SummaryRow key={line.category} line={line} currency={vehicle.currency} />
          ))}
        </ul>

        {scrollableLines.length > 0 && (
          <ul className="flex max-h-48 flex-col gap-1.5 overflow-y-auto border-t border-white/10 pt-2">
            {scrollableLines.map((line, index) => (
              <SummaryRow key={`${line.category}-${index}`} line={line} currency={vehicle.currency} />
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-1 border-t border-white/10 pt-2 text-sm">
          <div className="flex justify-between text-white/50">
            <span>Base price</span>
            <span>{formatPriceCents(summary.breakdown.basePriceCents, vehicle.currency)}</span>
          </div>
          <p aria-live="polite" data-testid="build-summary-total" className="flex justify-between font-semibold text-white">
            <span>Total</span>
            <span>{formatPriceCents(summary.breakdown.totalPriceCents, vehicle.currency)}</span>
          </p>
        </div>
      </div>
    </CategoryGroup>
  );
}

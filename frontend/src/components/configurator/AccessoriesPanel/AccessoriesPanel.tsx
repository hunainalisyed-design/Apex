"use client";

import { CategoryGroup } from "../CategoryGroup";
import { CATEGORY_LABELS } from "../categoryLabels";
import { MultiCategoryOptionRow } from "../MultiCategoryOptionRow";
import { useConfigurationStore } from "@/state/configurationStore";
import type { VehicleDetailDto } from "@/types/catalog";
import type { MultiSelectCategory } from "@/types/pricing";

export interface AccessoriesPanelProps {
  vehicle: VehicleDetailDto;
}

const GROUPS: { title: string; category: MultiSelectCategory }[] = [
  { title: "Accessories", category: "ACCESSORY" },
  { title: "Packages", category: "PACKAGE" },
];

/** ACCESSORY and PACKAGE (Spec 8) — multi-select toggles, any number active at once.
 * A group is omitted entirely when the vehicle has zero seeded options for it (per the
 * spec's Empty state), rather than showing an empty, unexplained section. */
export function AccessoriesPanel({ vehicle }: AccessoriesPanelProps) {
  const multiSelections = useConfigurationStore((s) => s.multiSelections);
  const toggleMultiSelection = useConfigurationStore((s) => s.toggleMultiSelection);

  return (
    <div className="flex flex-col gap-3" aria-label="Accessories and packages">
      {GROUPS.map(({ title, category }) => {
        const options = vehicle.options[category] ?? [];
        if (options.length === 0) return null;

        return (
          <CategoryGroup key={category} title={title}>
            <MultiCategoryOptionRow
              label={CATEGORY_LABELS[category]}
              options={options}
              selectedIds={multiSelections[category]}
              currency={vehicle.currency}
              onToggle={(id) => toggleMultiSelection(category, id)}
            />
          </CategoryGroup>
        );
      })}
    </div>
  );
}

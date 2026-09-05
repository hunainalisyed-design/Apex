"use client";

import { CategoryGroup } from "../CategoryGroup";
import { CategoryOptionRow } from "../CategoryOptionRow";
import { CATEGORY_LABELS } from "../categoryLabels";
import { useConfigurationStore } from "@/state/configurationStore";
import type { VehicleDetailDto } from "@/types/catalog";
import type { SingleSelectCategory } from "@/types/pricing";

export interface InteriorPanelProps {
  vehicle: VehicleDetailDto;
}

const GROUPS: { title: string; categories: SingleSelectCategory[] }[] = [
  { title: "Overall Finish", categories: ["INTERIOR_MATERIAL", "INTERIOR_LIGHTING"] },
  {
    title: "Surface Colors",
    categories: [
      "INTERIOR_SEATS",
      "INTERIOR_DASHBOARD",
      "INTERIOR_STEERING_WHEEL",
      "INTERIOR_DOOR_PANELS",
      "INTERIOR_FLOOR",
    ],
  },
];

/** All seven SRS §10 interior categories, grouped for the sidebar (Spec 7). No custom-color
 * equivalent exists for the interior (not requested in SRS §10, unlike exterior's paint). */
export function InteriorPanel({ vehicle }: InteriorPanelProps) {
  const singleSelections = useConfigurationStore((s) => s.singleSelections);
  const setSingleSelection = useConfigurationStore((s) => s.setSingleSelection);

  return (
    <div className="flex flex-col gap-3" aria-label="Interior customization">
      {GROUPS.map((group) => (
        <CategoryGroup key={group.title} title={group.title}>
          {group.categories.map((category) => (
            <CategoryOptionRow
              key={category}
              label={CATEGORY_LABELS[category]}
              options={vehicle.options[category] ?? []}
              selectedId={singleSelections[category]}
              currency={vehicle.currency}
              onSelect={(id) => setSingleSelection(category, id)}
            />
          ))}
        </CategoryGroup>
      ))}
    </div>
  );
}

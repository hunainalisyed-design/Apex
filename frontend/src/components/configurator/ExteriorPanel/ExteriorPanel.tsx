"use client";

import { CategoryGroup } from "../CategoryGroup";
import { CategoryOptionRow } from "../CategoryOptionRow";
import { CATEGORY_LABELS } from "../categoryLabels";
import { useConfigurationStore } from "@/state/configurationStore";
import type { VehicleDetailDto } from "@/types/catalog";
import type { SingleSelectCategory } from "@/types/pricing";
import { CustomColorPicker } from "./CustomColorPicker";

export interface ExteriorPanelProps {
  vehicle: VehicleDetailDto;
}

const GROUPS: { title: string; categories: SingleSelectCategory[] }[] = [
  { title: "Paint & Finish", categories: ["PAINT"] },
  { title: "Wheels & Brakes", categories: ["WHEELS", "BRAKE_CALIPER"] },
  {
    title: "Aero & Body",
    categories: [
      "WINDOW_TINT",
      "SPOILER",
      "FRONT_ACCESSORY",
      "REAR_ACCESSORY",
      "BODY_PACKAGE",
      "CARBON_COMPONENT",
    ],
  },
];

const CUSTOM_COLOR_ASSET_REF = "paint-custom";
const DEFAULT_CUSTOM_HEX = "#d4d4d8";

/** All nine SRS §7 exterior categories, grouped for the sidebar (Spec 6). */
export function ExteriorPanel({ vehicle }: ExteriorPanelProps) {
  const singleSelections = useConfigurationStore((s) => s.singleSelections);
  const customPaintHex = useConfigurationStore((s) => s.customPaintHex);
  const setSingleSelection = useConfigurationStore((s) => s.setSingleSelection);
  const setCustomPaintHex = useConfigurationStore((s) => s.setCustomPaintHex);

  return (
    <div className="flex flex-col gap-3" aria-label="Exterior customization">
      {GROUPS.map((group) => (
        <CategoryGroup key={group.title} title={group.title}>
          {group.categories.map((category) => {
            const options = vehicle.options[category] ?? [];
            const selectedId = singleSelections[category];
            const isCustomColorSelected =
              category === "PAINT" &&
              options.find((o) => o.id === selectedId)?.assetRef === CUSTOM_COLOR_ASSET_REF;

            return (
              <CategoryOptionRow
                key={category}
                label={CATEGORY_LABELS[category]}
                options={options}
                selectedId={selectedId}
                currency={vehicle.currency}
                onSelect={(id) => setSingleSelection(category, id)}
              >
                {isCustomColorSelected && (
                  <CustomColorPicker
                    value={customPaintHex ?? DEFAULT_CUSTOM_HEX}
                    onChange={setCustomPaintHex}
                  />
                )}
              </CategoryOptionRow>
            );
          })}
        </CategoryGroup>
      ))}
    </div>
  );
}

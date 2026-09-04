"use client";

import { useConfigurationStore } from "@/state/configurationStore";
import type { VehicleDetailDto } from "@/types/catalog";
import type { SingleSelectCategory } from "@/types/pricing";
import { CategoryGroup } from "./CategoryGroup";
import { CustomColorPicker } from "./CustomColorPicker";
import { OptionSwatch } from "./OptionSwatch";

export interface ExteriorPanelProps {
  vehicle: VehicleDetailDto;
}

const CATEGORY_LABELS: Record<SingleSelectCategory, string> = {
  PAINT: "Paint",
  WHEELS: "Wheels",
  BRAKE_CALIPER: "Brake Calipers",
  WINDOW_TINT: "Window Tint",
  SPOILER: "Spoiler",
  FRONT_ACCESSORY: "Front Accessory",
  REAR_ACCESSORY: "Rear Accessory",
  BODY_PACKAGE: "Body Package",
  CARBON_COMPONENT: "Carbon Components",
  INTERIOR_MATERIAL: "Interior Material",
  INTERIOR_LIGHTING: "Interior Lighting",
  INTERIOR_SEATS: "Interior Seats",
  INTERIOR_DASHBOARD: "Interior Dashboard",
  INTERIOR_STEERING_WHEEL: "Steering Wheel",
  INTERIOR_DOOR_PANELS: "Door Panels",
  INTERIOR_FLOOR: "Interior Floor",
};

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
              <div key={category} className="flex flex-col gap-2">
                <p className="text-[11px] uppercase tracking-wide text-white/50">
                  {CATEGORY_LABELS[category]}
                </p>
                <div className="flex flex-wrap gap-2">
                  {options.map((option) => (
                    <OptionSwatch
                      key={option.id}
                      option={option}
                      categoryLabel={CATEGORY_LABELS[category]}
                      selected={option.id === selectedId}
                      currency={vehicle.currency}
                      onSelect={(id) => setSingleSelection(category, id)}
                    />
                  ))}
                </div>
                {isCustomColorSelected && (
                  <CustomColorPicker
                    value={customPaintHex ?? DEFAULT_CUSTOM_HEX}
                    onChange={setCustomPaintHex}
                  />
                )}
              </div>
            );
          })}
        </CategoryGroup>
      ))}
    </div>
  );
}

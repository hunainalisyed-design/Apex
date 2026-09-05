"use client";

import type { CustomizationOptionDto } from "@/types/catalog";
import { OptionSwatch } from "./OptionSwatch";

export interface MultiCategoryOptionRowProps {
  label: string;
  options: CustomizationOptionDto[];
  selectedIds: string[];
  currency: string;
  onToggle: (optionId: string) => void;
}

/** The multi-select counterpart to CategoryOptionRow (Spec 6/7) — any number of swatches
 * in the row can be pressed at once (Spec 8's ACCESSORY/PACKAGE toggles), rather than
 * exactly one. Reuses the same OptionSwatch; only the "is this one selected" check and
 * the click handler differ. */
export function MultiCategoryOptionRow({
  label,
  options,
  selectedIds,
  currency,
  onToggle,
}: MultiCategoryOptionRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] uppercase tracking-wide text-white/50">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <OptionSwatch
            key={option.id}
            option={option}
            categoryLabel={label}
            selected={selectedIds.includes(option.id)}
            currency={currency}
            onSelect={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

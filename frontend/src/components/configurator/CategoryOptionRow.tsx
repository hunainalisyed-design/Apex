"use client";

import type { ReactNode } from "react";
import type { CustomizationOptionDto } from "@/types/catalog";
import { OptionSwatch } from "./OptionSwatch";

export interface CategoryOptionRowProps {
  label: string;
  options: CustomizationOptionDto[];
  selectedId: string;
  currency: string;
  onSelect: (optionId: string) => void;
  /** Extra content rendered below the swatches — e.g. Spec 6's custom color picker. */
  children?: ReactNode;
}

/** One category's label + swatch row — shared by ExteriorPanel (Spec 6) and InteriorPanel
 * (Spec 7) so the rendering pattern isn't duplicated per panel. */
export function CategoryOptionRow({
  label,
  options,
  selectedId,
  currency,
  onSelect,
  children,
}: CategoryOptionRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-[11px] uppercase tracking-wide text-white/50">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <OptionSwatch
            key={option.id}
            option={option}
            categoryLabel={label}
            selected={option.id === selectedId}
            currency={currency}
            onSelect={onSelect}
          />
        ))}
      </div>
      {children}
    </div>
  );
}

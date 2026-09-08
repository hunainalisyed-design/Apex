"use client";

import { formatPriceCents } from "@/lib/format/currency";
import type { CustomizationOptionDto } from "@/types/catalog";

export interface OptionSwatchProps {
  option: CustomizationOptionDto;
  categoryLabel: string;
  selected: boolean;
  currency: string;
  onSelect: (optionId: string) => void;
}

/** A color swatch when the option has a swatchColor, else a labeled tile (AC-1). The
 * aria-label names both the option and its category — several categories share option
 * names like "None", so category context matters for screen-reader users. */
export function OptionSwatch({ option, categoryLabel, selected, currency, onSelect }: OptionSwatchProps) {
  const priceLabel = `+${formatPriceCents(option.priceDeltaCents, currency)}`;
  const ariaLabel = `${categoryLabel}: ${option.name}, ${priceLabel}`;

  return (
    <button
      type="button"
      onClick={() => onSelect(option.id)}
      aria-pressed={selected}
      aria-label={ariaLabel}
      title={ariaLabel}
      className={`focus-ring flex h-12 w-12 items-center justify-center rounded-full border-2 transition ${
        selected ? "border-white" : "border-white/20 hover:border-white/50"
      }`}
    >
      {option.swatchColor ? (
        <span
          aria-hidden="true"
          className="h-8 w-8 rounded-full"
          style={{ backgroundColor: option.swatchColor }}
        />
      ) : (
        <span
          aria-hidden="true"
          className="px-1 text-center text-[9px] font-semibold uppercase leading-tight text-white/80"
        >
          {option.name}
        </span>
      )}
    </button>
  );
}

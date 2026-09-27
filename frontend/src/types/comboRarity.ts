// Mirrors backend/src/types/comboRarity.ts (Spec 32).
/** A (PAINT, WHEELS) pair on this vehicle that's rare enough to show a badge for (Spec 32). */
export interface RareComboDto {
  paintId: string;
  wheelsId: string;
  /** Share of this vehicle's saved builds with this pair, rounded UP to one decimal (0.1–5.0). */
  percentage: number;
}

export interface ComboRarityDto {
  /** Saved builds counted for this vehicle at the last aggregation run. */
  sampleSize: number;
  /** When the last aggregation run finished (ISO 8601); null if it hasn't run for this vehicle. */
  computedAt: string | null;
  /** Only the rare pairs — empty whenever the sample is too small to be meaningful (AC-3). */
  rareCombos: RareComboDto[];
  /** True when `?build=` names the earliest saved build with its paint + wheels pair (AC-5). */
  firstOfKind: boolean;
}

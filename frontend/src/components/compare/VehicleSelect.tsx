"use client";

import { useId } from "react";
import type { VehicleSummaryDto } from "@/types/catalog";

export interface VehicleSelectProps {
  label: string;
  vehicles: VehicleSummaryDto[];
  value: string;
  onChange: (slug: string) => void;
}

/** A labeled native <select> (Spec 18, AC-1/AC-9) — not a custom listbox, so keyboard and
 * screen-reader operability come for free, matching this codebase's existing bias toward
 * plain native form elements (e.g. the Spec 16/17 auth/profile forms). `vehicles` is
 * expected to already have the other side's current selection excluded (AC-4) — that
 * option is genuinely absent from the DOM, not merely disabled. */
export function VehicleSelect({ label, vehicles, value, onChange }: VehicleSelectProps) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-white/70">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus-ring rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
      >
        {vehicles.map((vehicle) => (
          <option key={vehicle.slug} value={vehicle.slug}>
            {vehicle.name}
          </option>
        ))}
      </select>
    </div>
  );
}

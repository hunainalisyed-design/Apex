"use client";

export interface HotspotLabelProps {
  label: string;
  x: number;
  y: number;
}

/**
 * Floating label shown on hotspot hover (AC-7). `label` is always resolved by the caller
 * from the vehicle's live configuration state (the currently-selected option's name) —
 * never a hardcoded string passed in here.
 */
export function HotspotLabel({ label, x, y }: HotspotLabelProps) {
  return (
    <div
      className="glass-panel pointer-events-none fixed z-20 -translate-x-1/2 -translate-y-full rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white"
      style={{ left: x, top: y - 12 }}
      role="status"
    >
      {label}
    </div>
  );
}

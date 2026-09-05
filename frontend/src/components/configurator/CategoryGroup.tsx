"use client";

import type { ReactNode } from "react";

export interface CategoryGroupProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** A native <details>/<summary> collapsible section — free, accessible, keyboard-operable
 * (Tab to the summary, Enter/Space to toggle) with no hand-rolled accordion logic (AC-11). */
export function CategoryGroup({ title, children, defaultOpen = true }: CategoryGroupProps) {
  return (
    <details className="glass-panel rounded-2xl px-4 py-3" open={defaultOpen}>
      <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wide text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        {title}
      </summary>
      <div className="mt-3 flex flex-col gap-4">{children}</div>
    </details>
  );
}

import type { ComponentPropsWithoutRef, ReactNode } from "react";

export interface ShowroomLayoutProps {
  scene: ReactNode;
  panel: ReactNode;
  /** Passed through to the root <main> (e.g. id="main-content", data-scene-ready). */
  mainProps?: ComponentPropsWithoutRef<"main">;
}

/**
 * The desktop-left/right, mobile-top/bottom responsive split used by every panel-bearing
 * screen (Spec 12, AC-9) — single source of truth for this breakpoint, extracted verbatim
 * from ConfigureShowroom.tsx (Spec 5), its only consumer so far. Owns the page's <main>
 * landmark too, so a route only needs to supply its scene/panel content plus whatever
 * root-level attributes it needs (an id for the skip link, test hooks, etc.).
 */
export function ShowroomLayout({ scene, panel, mainProps }: ShowroomLayoutProps) {
  const { className: extraClassName, ...restMainProps } = mainProps ?? {};

  return (
    <main
      tabIndex={-1}
      {...restMainProps}
      className={`flex min-h-full flex-1 flex-col gap-8 px-6 py-16 lg:flex-row lg:items-start lg:justify-center ${extraClassName ?? ""}`}
    >
      <div className="flex w-full max-w-3xl flex-col gap-4 lg:sticky lg:top-16">{scene}</div>
      <div className="flex w-full max-w-sm flex-col gap-3">{panel}</div>
    </main>
  );
}

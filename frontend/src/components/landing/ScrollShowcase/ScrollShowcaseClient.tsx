"use client";

import dynamic from "next/dynamic";
import { useIsDesktopViewport } from "@/hooks/useIsDesktopViewport";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import type { VehicleSummaryDto } from "@/types/catalog";
import { StaticScrollShowcase } from "./StaticScrollShowcase";

const ScrollShowcaseScene = dynamic(
  () => import("./ScrollShowcaseScene").then((m) => m.ScrollShowcaseScene),
  { ssr: false, loading: () => null },
);

export interface ScrollShowcaseClientProps {
  vehicle: VehicleSummaryDto;
}

/**
 * Picks the live, scroll-driven 3D sequence only on a desktop-width viewport with motion
 * allowed — both conditions must hold, since AC-12's mobile simplification is a
 * performance requirement (the Canvas must never mount on a small device at all), not
 * merely a visual one, and AC-10's reduced-motion fallback is deliberately the same
 * simplified experience (see StaticScrollShowcase's own comment).
 *
 * Loaded via ScrollShowcase.tsx's ssr:false dynamic import, not rendered directly — this
 * component's branch choice can only be known client-side, and rendering it as a normal
 * SSR'd component would mean every desktop visitor briefly sees the wrong (static) branch
 * during hydration (matching useIsDesktopViewport's SSR-safe "not desktop" default) before
 * correcting, which isn't just a visual flicker: StaticScrollShowcase's <img> would fire a
 * real request for a fallbackImageUrl that has no file behind it (Spec 12), logging a 404
 * on every single normal page load. Skipping SSR for this whole subtree (same pattern
 * Hero.tsx already uses for HeroScene) means its first-ever render happens client-side with
 * the real viewport/motion values already known, so the wrong branch is never rendered even
 * momentarily.
 */
export function ScrollShowcaseClient({ vehicle }: ScrollShowcaseClientProps) {
  const isDesktopViewport = useIsDesktopViewport();
  const reducedMotion = useReducedMotion();
  const showLive = isDesktopViewport && !reducedMotion;

  if (!showLive) {
    return <StaticScrollShowcase vehicle={vehicle} />;
  }

  return <ScrollShowcaseScene vehicle={vehicle} />;
}

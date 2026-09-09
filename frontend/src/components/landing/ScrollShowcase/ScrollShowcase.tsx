"use client";

import dynamic from "next/dynamic";
import type { VehicleSummaryDto } from "@/types/catalog";

const ScrollShowcaseClient = dynamic(
  () => import("./ScrollShowcaseClient").then((m) => m.ScrollShowcaseClient),
  { ssr: false, loading: () => null },
);

export interface ScrollShowcaseProps {
  vehicle: VehicleSummaryDto;
}

/**
 * Landing-page scroll showcase (Spec 13, AC-8 through AC-12), rendered below Hero. A thin
 * ssr:false boundary around ScrollShowcaseClient's actual live-vs-static decision — see
 * that file's own comment for why this decision can't be allowed to SSR at all.
 */
export function ScrollShowcase({ vehicle }: ScrollShowcaseProps) {
  return <ScrollShowcaseClient vehicle={vehicle} />;
}

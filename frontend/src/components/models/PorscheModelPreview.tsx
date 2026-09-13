"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Canvas3DErrorBoundary } from "@/components/shell/Canvas3DErrorBoundary";
import { LoadingScreen } from "@/components/shell/LoadingScreen";
import type { VehicleSummaryDto } from "@/types/catalog";

const PorscheShowcaseScene = dynamic(
  () => import("./PorscheShowcaseScene").then((m) => m.PorscheShowcaseScene),
  { ssr: false, loading: () => <LoadingScreen label="Loading…" /> },
);

export interface PorscheModelPreviewProps {
  vehicle: VehicleSummaryDto;
}

/** Real-GLB 3D preview used in place of the plain gradient+text placeholder on the /models
 * page's Porsche card — reuses the same asset the landing-page Hero renders (see
 * HeroVehicleModel.tsx), the only catalog vehicle with a real model behind it so far. */
export function PorscheModelPreview({ vehicle }: PorscheModelPreviewProps) {
  const [sceneError, setSceneError] = useState(false);

  return (
    <div aria-hidden={!sceneError} className="relative h-32 w-full overflow-hidden rounded-xl">
      <Canvas3DErrorBoundary vehicle={vehicle} onError={() => setSceneError(true)}>
        <PorscheShowcaseScene />
      </Canvas3DErrorBoundary>
    </div>
  );
}

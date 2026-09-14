"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Canvas3DErrorBoundary } from "@/components/shell/Canvas3DErrorBoundary";
import { LoadingScreen } from "@/components/shell/LoadingScreen";
import type { VehicleSummaryDto } from "@/types/catalog";

const VehicleShowcaseScene = dynamic(
  () => import("./VehicleShowcaseScene").then((m) => m.VehicleShowcaseScene),
  { ssr: false, loading: () => <LoadingScreen label="Loading…" /> },
);

export interface VehicleModelPreviewProps {
  vehicle: VehicleSummaryDto;
  modelUrl: string;
  targetLength: number;
}

/** Real-GLB 3D preview used in place of the plain gradient+text placeholder on the /models
 * page's cards for every catalog vehicle listed in realGlbVehicles.ts — generalized from the
 * original Porsche-only PorscheModelPreview (see git history) once a second real-GLB vehicle
 * needed the identical wrapper. */
export function VehicleModelPreview({ vehicle, modelUrl, targetLength }: VehicleModelPreviewProps) {
  const [sceneError, setSceneError] = useState(false);

  return (
    <div aria-hidden={!sceneError} className="relative h-32 w-full overflow-hidden rounded-xl">
      <Canvas3DErrorBoundary vehicle={vehicle} onError={() => setSceneError(true)}>
        <VehicleShowcaseScene modelUrl={modelUrl} targetLength={targetLength} />
      </Canvas3DErrorBoundary>
    </div>
  );
}

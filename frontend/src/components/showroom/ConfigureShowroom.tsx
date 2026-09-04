"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { formatPriceCents } from "@/lib/format/currency";
import type { CameraPresetId } from "@/lib/showroom/cameraPresets";
import type { VehicleDetailDto } from "@/types/catalog";
import { CameraPresetBar } from "./CameraPresetBar";
import { HotspotLabel } from "./HotspotLabel";
import { LightingControls } from "./LightingControls";
import { ShowroomErrorBoundary } from "./ShowroomErrorBoundary";
import { ShowroomLoadingScreen } from "./ShowroomLoadingScreen";
import type { HoverLabel } from "./ShowroomScene";

const ShowroomScene = dynamic(() => import("./ShowroomScene").then((m) => m.ShowroomScene), {
  ssr: false,
  loading: () => <ShowroomLoadingScreen />,
});

const BRAKE_PULSE_MS = 900;

export interface ConfigureShowroomProps {
  vehicle: VehicleDetailDto;
}

export function ConfigureShowroom({ vehicle }: ConfigureShowroomProps) {
  const reducedMotion = useReducedMotion();
  const [currentPreset, setCurrentPreset] = useState<CameraPresetId>("default");
  const [hover, setHover] = useState<HoverLabel | null>(null);
  const [headlightsOn, setHeadlightsOn] = useState(false);
  const [brakePulsing, setBrakePulsing] = useState(false);
  const [sceneError, setSceneError] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const goToPresetRef = useRef<((id: CameraPresetId) => void) | null>(null);

  const handleReady = useCallback((goToPreset: (id: CameraPresetId) => void) => {
    goToPresetRef.current = goToPreset;
    setSceneReady(true);
  }, []);

  const handleSelectPreset = useCallback((id: CameraPresetId) => {
    goToPresetRef.current?.(id);
  }, []);

  const handlePulseBrakeLights = useCallback(() => {
    setBrakePulsing(true);
    setTimeout(() => setBrakePulsing(false), BRAKE_PULSE_MS);
  }, []);

  const hoverLabelText =
    hover && vehicle.options[hover.category]?.find((option) => option.isDefault)?.name;

  return (
    <main
      className="flex min-h-full flex-1 flex-col gap-8 px-6 py-16 lg:flex-row lg:items-center lg:justify-center"
      data-scene-ready={sceneReady}
    >
      <div className="relative aspect-video w-full max-w-3xl">
        <ShowroomErrorBoundary onError={() => setSceneError(true)}>
          <ShowroomScene
            headlightsOn={headlightsOn}
            brakePulsing={brakePulsing}
            reducedMotion={reducedMotion}
            onReady={handleReady}
            onPresetChange={setCurrentPreset}
            onHover={setHover}
          />
        </ShowroomErrorBoundary>
        {hover && hoverLabelText && <HotspotLabel label={hoverLabelText} x={hover.x} y={hover.y} />}
      </div>

      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="glass-panel flex flex-col gap-2 rounded-2xl px-6 py-6">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">{vehicle.tagline}</p>
          <h1
            className="text-3xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {vehicle.name}
          </h1>
          <p className="text-lg text-white/80">
            {formatPriceCents(vehicle.basePriceCents, vehicle.currency)}
          </p>
        </div>

        {!sceneError && (
          <div className="flex flex-col gap-3">
            <CameraPresetBar
              currentPreset={currentPreset}
              onSelect={handleSelectPreset}
              disabled={!sceneReady}
            />
            <LightingControls
              headlightsOn={headlightsOn}
              onToggleHeadlights={() => setHeadlightsOn((on) => !on)}
              onPulseBrakeLights={handlePulseBrakeLights}
            />
          </div>
        )}
      </div>
    </main>
  );
}

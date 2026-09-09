"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessoriesPanel } from "@/components/configurator/AccessoriesPanel/AccessoriesPanel";
import { CarAIAssistant } from "@/components/ai/CarAIAssistant";
import { BuildSummary } from "@/components/configurator/BuildSummary/BuildSummary";
import { CaptureBuild } from "@/components/configurator/CaptureBuild/CaptureBuild";
import { ExteriorPanel } from "@/components/configurator/ExteriorPanel/ExteriorPanel";
import { InteriorPanel } from "@/components/configurator/InteriorPanel/InteriorPanel";
import { SaveSharePanel } from "@/components/configurator/SaveSharePanel/SaveSharePanel";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { formatPriceCents } from "@/lib/format/currency";
import { calculatePrice } from "@/lib/pricing";
import { resolveAccessoryAppearance } from "@/lib/showroom/accessoryAppearance";
import type { CameraPresetId } from "@/lib/showroom/cameraPresets";
import { resolveExteriorAppearance } from "@/lib/showroom/exteriorAppearance";
import { resolveInteriorAppearance } from "@/lib/showroom/interiorAppearance";
import { useCarAiChatStore } from "@/state/carAiChatStore";
import { useConfigurationStore } from "@/state/configurationStore";
import { SINGLE_SELECT_CATEGORIES, type OptionCategory, type VehicleDetailDto } from "@/types/catalog";
import type { SavedConfigurationDto } from "@/types/configuration";
import type { SingleSelectCategory } from "@/types/pricing";
import { Canvas3DErrorBoundary } from "@/components/shell/Canvas3DErrorBoundary";
import { LoadingScreen } from "@/components/shell/LoadingScreen";
import { ShowroomLayout } from "@/components/shell/ShowroomLayout";
import { CameraPresetBar } from "./CameraPresetBar";
import { HotspotLabel } from "./HotspotLabel";
import { LightingControls } from "./LightingControls";
import type { HoverLabel, ShowroomControls } from "./ShowroomScene";

const ShowroomScene = dynamic(() => import("./ShowroomScene").then((m) => m.ShowroomScene), {
  ssr: false,
  loading: () => <LoadingScreen />,
});

const BRAKE_PULSE_MS = 900;

type ConfiguratorTab = "exterior" | "interior" | "accessories";

const TAB_LABELS: Record<ConfiguratorTab, string> = {
  exterior: "Exterior",
  interior: "Interior",
  accessories: "Accessories",
};

function isSingleSelectCategory(category: OptionCategory): category is SingleSelectCategory {
  return (SINGLE_SELECT_CATEGORIES as readonly OptionCategory[]).includes(category);
}

export interface ConfigureShowroomProps {
  vehicle: VehicleDetailDto;
  /** A previously saved build to hydrate from instead of vehicle defaults (Spec 10, AC-4),
   * resolved server-side by the ?build= query param. */
  savedConfiguration?: SavedConfigurationDto | null;
}

export function ConfigureShowroom({ vehicle, savedConfiguration = null }: ConfigureShowroomProps) {
  const reducedMotion = useReducedMotion();
  const [activeTab, setActiveTab] = useState<ConfiguratorTab>("exterior");
  const [currentPreset, setCurrentPreset] = useState<CameraPresetId>("default");
  const [hover, setHover] = useState<HoverLabel | null>(null);
  const [headlightsOn, setHeadlightsOn] = useState(false);
  const [brakePulsing, setBrakePulsing] = useState(false);
  const [sceneError, setSceneError] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const showroomControlsRef = useRef<ShowroomControls | null>(null);

  const singleSelections = useConfigurationStore((s) => s.singleSelections);
  const multiSelections = useConfigurationStore((s) => s.multiSelections);
  const customPaintHex = useConfigurationStore((s) => s.customPaintHex);
  const hydrateDefaults = useConfigurationStore((s) => s.hydrateDefaults);
  const hydrateFromSaved = useConfigurationStore((s) => s.hydrateFromSaved);

  // Re-hydrates on every mount, whenever the vehicle changes, or whenever a different
  // saved build is loaded (AC-10 from Spec 6; Spec 10 AC-4 for the saved-build path) — a
  // full page load already re-fetches both server-side, so this alone covers refresh too.
  useEffect(() => {
    if (savedConfiguration) {
      hydrateFromSaved(vehicle, savedConfiguration);
    } else {
      hydrateDefaults(vehicle);
    }
  }, [vehicle, savedConfiguration, hydrateDefaults, hydrateFromSaved]);

  const chatVehicleSlug = useCarAiChatStore((s) => s.vehicleSlug);
  const resetChat = useCarAiChatStore((s) => s.reset);

  // A CarAI conversation is scoped to one vehicle's context (Spec 15, AC-9) — mirrors the
  // hydrate effect above exactly, but deliberately doesn't touch isOpen, so a nav-control-
  // triggered "open" (set before navigating here, Spec 15 AC-2) survives this reset.
  useEffect(() => {
    if (chatVehicleSlug !== vehicle.slug) {
      resetChat(vehicle.slug);
    }
  }, [vehicle.slug, chatVehicleSlug, resetChat]);

  const handleReady = useCallback((controls: ShowroomControls) => {
    showroomControlsRef.current = controls;
    setSceneReady(true);
  }, []);

  const handleSelectPreset = useCallback((id: CameraPresetId) => {
    showroomControlsRef.current?.goToPreset(id);
  }, []);

  // Opening the Interior tab auto-transitions the camera to the Interior preset unless
  // it's already showing an interior view (Spec 7 AC-5). Switching tabs never touches the
  // configuration store, so selections persist across tab/camera changes for free (AC-6).
  const handleSelectTab = useCallback(
    (tab: ConfiguratorTab) => {
      setActiveTab(tab);
      if (tab === "interior" && currentPreset !== "interior" && currentPreset !== "cockpit") {
        showroomControlsRef.current?.goToPreset("interior");
      }
    },
    [currentPreset],
  );

  const handlePulseBrakeLights = useCallback(() => {
    setBrakePulsing(true);
    setTimeout(() => setBrakePulsing(false), BRAKE_PULSE_MS);
  }, []);

  const appearance = useMemo(
    () => resolveExteriorAppearance(vehicle, singleSelections, customPaintHex),
    [vehicle, singleSelections, customPaintHex],
  );

  const interior = useMemo(
    () => resolveInteriorAppearance(vehicle, singleSelections),
    [vehicle, singleSelections],
  );

  const accessories = useMemo(
    () => resolveAccessoryAppearance(vehicle, multiSelections, appearance.paintColor),
    [vehicle, multiSelections, appearance.paintColor],
  );

  const totalPriceCents = useMemo(() => {
    const allOptions = Object.values(vehicle.options).flat();
    try {
      return calculatePrice({
        vehicle: { slug: vehicle.slug, basePriceCents: vehicle.basePriceCents, currency: vehicle.currency },
        options: allOptions,
        singleSelections,
        multiSelections,
      }).totalPriceCents;
    } catch {
      // Selections haven't finished hydrating yet (e.g. the very first render) — the base
      // price is a safe placeholder until hydrateDefaults' effect runs.
      return vehicle.basePriceCents;
    }
  }, [vehicle, singleSelections, multiSelections]);

  // The hover label always reflects the *currently selected* option for that category
  // (Spec 6 AC-9), not the vehicle's default — the store is the live source of truth.
  // All hotspots registered so far (WHEELS, PAINT, BRAKE_CALIPER) are single-select
  // categories; a future multi-select hotspot (Spec 8) falls back to isDefault for now.
  const hoverLabelText =
    hover &&
    vehicle.options[hover.category]?.find((option) =>
      isSingleSelectCategory(hover.category)
        ? option.id === singleSelections[hover.category]
        : option.isDefault,
    )?.name;

  const mainProps = { id: "main-content", "data-scene-ready": sceneReady };

  return (
    <>
      <ShowroomLayout
        mainProps={mainProps}
        scene={
          <>
            <div className="relative aspect-video w-full">
              <Canvas3DErrorBoundary vehicle={vehicle} onError={() => setSceneError(true)}>
                <ShowroomScene
                  headlightsOn={headlightsOn}
                  brakePulsing={brakePulsing}
                  reducedMotion={reducedMotion}
                  appearance={appearance}
                  interior={interior}
                  accessories={accessories}
                  onReady={handleReady}
                  onPresetChange={setCurrentPreset}
                  onHover={setHover}
                />
              </Canvas3DErrorBoundary>
              {hover && hoverLabelText && <HotspotLabel label={hoverLabelText} x={hover.x} y={hover.y} />}
            </div>

            <div className="glass-panel flex flex-col gap-2 rounded-2xl px-6 py-6">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">{vehicle.tagline}</p>
              <h1
                className="text-3xl font-bold tracking-tight"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {vehicle.name}
              </h1>
              <p className="text-lg text-white/80" data-testid="total-price">
                {formatPriceCents(totalPriceCents, vehicle.currency)}
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
          </>
        }
        panel={
          <>
            <BuildSummary vehicle={vehicle} />
            <SaveSharePanel vehicle={vehicle} />
            <CaptureBuild
              vehicle={vehicle}
              showroomControlsRef={showroomControlsRef}
              currentPreset={currentPreset}
              sceneReady={sceneReady}
            />

            <div className="glass-panel flex gap-1 rounded-full p-1" role="tablist" aria-label="Customization panel">
              {(["exterior", "interior", "accessories"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => handleSelectTab(tab)}
                  className={`focus-ring flex-1 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    activeTab === tab ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {TAB_LABELS[tab]}
                </button>
              ))}
            </div>

            {activeTab === "exterior" && <ExteriorPanel vehicle={vehicle} />}
            {activeTab === "interior" && <InteriorPanel vehicle={vehicle} />}
            {activeTab === "accessories" && <AccessoriesPanel vehicle={vehicle} />}
          </>
        }
      />
      <CarAIAssistant vehicle={vehicle} />
    </>
  );
}

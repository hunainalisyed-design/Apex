"use client";

export interface LightingControlsProps {
  headlightsOn: boolean;
  onToggleHeadlights: () => void;
  onPulseBrakeLights: () => void;
}

/**
 * Real material/light state changes (AC-9), not a UI-only indicator — headlightsOn and the
 * brake-light pulse both drive the emissive materials on PlaceholderShowroomRig via
 * lib/showroom/lighting.ts.
 */
export function LightingControls({
  headlightsOn,
  onToggleHeadlights,
  onPulseBrakeLights,
}: LightingControlsProps) {
  return (
    <div className="glass-panel flex items-center gap-2 rounded-full px-3 py-2">
      <button
        type="button"
        onClick={onToggleHeadlights}
        aria-pressed={headlightsOn}
        className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
          headlightsOn ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
      >
        Headlights {headlightsOn ? "On" : "Off"}
      </button>
      <button
        type="button"
        onClick={onPulseBrakeLights}
        className="rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Brake Pulse
      </button>
    </div>
  );
}

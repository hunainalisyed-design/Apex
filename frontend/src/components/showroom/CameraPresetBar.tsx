"use client";

import { CAMERA_PRESETS, type CameraPresetId } from "@/lib/showroom/cameraPresets";

export interface CameraPresetBarProps {
  currentPreset: CameraPresetId;
  onSelect: (id: CameraPresetId) => void;
  /** True until the 3D scene has mounted and exposed its transition controls — clicking
   * before then would otherwise silently no-op. */
  disabled?: boolean;
}

const NAMED_PRESETS = CAMERA_PRESETS.filter((p) => p.id !== "default");

export function CameraPresetBar({ currentPreset, onSelect, disabled = false }: CameraPresetBarProps) {
  return (
    <div
      className="glass-panel flex max-w-full gap-2 overflow-x-auto rounded-full px-3 py-2"
      role="group"
      aria-label="Camera presets"
    >
      {NAMED_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(preset.id)}
          aria-pressed={currentPreset === preset.id}
          className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition focus-ring disabled:cursor-not-allowed disabled:opacity-40 ${
            currentPreset === preset.id
              ? "bg-white text-black"
              : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          {preset.label}
        </button>
      ))}
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect("default")}
        aria-pressed={currentPreset === "default"}
        className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition focus-ring disabled:cursor-not-allowed disabled:opacity-40 ${
          currentPreset === "default"
            ? "bg-white text-black"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        }`}
      >
        Reset
      </button>
    </div>
  );
}

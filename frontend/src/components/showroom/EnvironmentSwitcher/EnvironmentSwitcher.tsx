"use client";

import { useTranslations } from "next-intl";
import type { EnvironmentDto } from "@/types/environments";

export interface EnvironmentSwitcherProps {
  environments: EnvironmentDto[];
  /** The environment currently shown (already resolved — never an unknown id). */
  selectedId: string;
  onSelect: (id: string) => void;
  /** True until the 3D scene is ready, matching CameraPresetBar. */
  disabled?: boolean;
}

/**
 * The showroom's scene picker (Spec 28, AC-1) — one thumbnail button per environment, styled
 * and structured like CameraPresetBar (a labelled group of aria-pressed toggle buttons, each
 * keyboard-reachable with a visible focus ring). Scrolls horizontally on narrow screens.
 */
export function EnvironmentSwitcher({ environments, selectedId, onSelect, disabled = false }: EnvironmentSwitcherProps) {
  const t = useTranslations("environments");
  if (environments.length < 2) return null;

  return (
    <div className="glass-panel flex max-w-full gap-2 overflow-x-auto rounded-2xl p-2" role="group" aria-label={t("label")}>
      {environments.map((environment) => {
        const selected = environment.id === selectedId;
        return (
          <button
            key={environment.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(environment.id)}
            aria-pressed={selected}
            className={`flex shrink-0 flex-col items-center gap-1 rounded-xl p-1.5 text-[11px] font-semibold uppercase tracking-wide transition focus-ring disabled:cursor-not-allowed disabled:opacity-40 ${
              selected ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {/* Decorative: the button's accessible name is the text label below it. Top-anchored so
                the 16:9 crop of the 4:3 Poly Haven preview hides its reference spheres strip. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny static thumbnails; next/image adds nothing here */}
            <img src={environment.thumbnailUrl} alt="" width={96} height={54} className="h-[54px] w-24 rounded-lg object-cover object-top" />
            <span>{environment.name}</span>
          </button>
        );
      })}
    </div>
  );
}

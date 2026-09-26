"use client";

import { useTranslations } from "next-intl";

export interface SoundToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

/** The showroom's sound on/off control (Spec 29, §5) — a speaker when on, a muted speaker
 * when off. `aria-pressed` carries the state; the accessible name says what a press does. */
export function SoundToggle({ enabled, onToggle }: SoundToggleProps) {
  const t = useTranslations("sound");
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={enabled}
      aria-label={enabled ? t("turnOff") : t("turnOn")}
      title={enabled ? t("turnOff") : t("turnOn")}
      className={`glass-panel focus-ring flex h-11 items-center gap-2 rounded-full px-4 text-xs font-semibold uppercase tracking-wide transition ${
        enabled ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 9h4l5-4v14l-5-4H4z" />
        {enabled ? (
          <>
            <path d="M16.5 8.5a5 5 0 0 1 0 7" />
            <path d="M19 6a8.5 8.5 0 0 1 0 12" />
          </>
        ) : (
          <path d="m17 9 5 6m0-6-5 6" />
        )}
      </svg>
      <span>{enabled ? t("on") : t("off")}</span>
    </button>
  );
}

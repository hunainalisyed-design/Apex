"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { formatNumber } from "@/lib/format/number";
import { useComboRarityStore } from "@/state/comboRarityStore";
import { useConfigurationStore } from "@/state/configurationStore";
import type { VehicleDetailDto } from "@/types/catalog";

export interface RarityBadgeProps {
  vehicle: VehicleDetailDto;
}

/**
 * "Only 3.5% of Apex GT builds choose this paint and wheel combination" (Spec 32). Everything
 * shown comes from the backend's last hourly aggregation, which only reports pairs that are
 * genuinely rare over a meaningful sample — so most builds show nothing (AC-3), and nothing
 * here ever estimates, pads, or rounds a number down (AC-4). Deliberately not a live region:
 * Spec 9 keeps the summary's one aria-live region for the total, so this is read in document
 * order with the rest of the summary rather than announced on every paint/wheels click.
 */
export function RarityBadge({ vehicle }: RarityBadgeProps) {
  const t = useTranslations("rarity");
  const paintId = useConfigurationStore((s) => s.singleSelections.PAINT);
  const wheelsId = useConfigurationStore((s) => s.singleSelections.WHEELS);
  const savedPublicId = useConfigurationStore((s) => s.savedConfiguration?.publicId ?? null);
  const isDirty = useConfigurationStore((s) => s.isDirtySinceLastSave());
  const load = useComboRarityStore((s) => s.load);
  const data = useComboRarityStore((s) => (s.vehicleSlug === vehicle.slug ? s.data : null));
  const fetchedFor = useComboRarityStore((s) => s.buildPublicId);

  useEffect(() => {
    void load(vehicle.slug, savedPublicId);
  }, [vehicle.slug, savedPublicId, load]);

  const rare = data?.rareCombos.find((combo) => combo.paintId === paintId && combo.wheelsId === wheelsId);
  // Only while the loaded saved build is exactly what's on screen — any change is a new build.
  const first = Boolean(data?.firstOfKind && savedPublicId && fetchedFor === savedPublicId && !isDirty);

  if (!rare && !first) return null;

  return (
    <div className="flex flex-col gap-1.5">
      {rare && data && (
        <p
          className="flex items-start gap-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.07] px-3 py-2 text-xs text-amber-100"
          title={t("basis", { count: data.sampleSize })}
          data-testid="rarity-badge"
        >
          <span aria-hidden="true" className="text-amber-300">
            ◆
          </span>
          <span>{t("rareCombo", { percent: formatNumber(rare.percentage, { fractionDigits: 1 }), vehicle: vehicle.name })}</span>
        </p>
      )}
      {first && (
        <p
          className="flex items-start gap-2 rounded-xl border border-white/15 bg-white/[0.05] px-3 py-2 text-xs text-white/85"
          data-testid="first-of-kind-badge"
        >
          <span aria-hidden="true">★</span>
          <span>{t("firstOfKind")}</span>
        </p>
      )}
    </div>
  );
}

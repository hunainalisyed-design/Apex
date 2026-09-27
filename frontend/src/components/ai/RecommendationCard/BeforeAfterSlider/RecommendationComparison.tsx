"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { mergeRecommendation } from "@/lib/ai/mergeRecommendation";
import { useComparisonStore } from "@/state/comparisonStore";
import { useConfigurationStore } from "@/state/configurationStore";
import type { AiConfigureRecommendation } from "@/types/ai";
import { BeforeAfterSlider } from "./BeforeAfterSlider";

export interface RecommendationComparisonProps {
  messageId: string;
  vehicleSlug: string;
  recommendation: AiConfigureRecommendation;
}

/**
 * The before/after preview on a CarAI recommendation card (Spec 36). "Before" is the build as
 * it is when the card first appears; "after" is that build with the recommendation merged in
 * exactly as Apply would do it. The pair is made once per recommendation by the hidden
 * ComparisonStudio; if that fails, this renders nothing and the card's list of changes stands
 * on its own (§5 Error). Purely a preview — applying stays the card's own button (AC-4).
 */
export function RecommendationComparison({ messageId, vehicleSlug, recommendation }: RecommendationComparisonProps) {
  const t = useTranslations("carai.comparison");
  const entry = useComparisonStore((s) => s.entries[messageId]);
  const request = useComparisonStore((s) => s.request);

  useEffect(() => {
    if (useComparisonStore.getState().entries[messageId]) return;
    const { singleSelections, multiSelections, customPaintHex } = useConfigurationStore.getState();
    const before = { singleSelections, multiSelections, customPaintHex };
    request({ messageId, vehicleSlug, before, after: mergeRecommendation(before, recommendation) });
  }, [messageId, vehicleSlug, recommendation, request]);

  if (!entry || entry.status === "pending") {
    return (
      <div role="status" className="flex aspect-video w-full items-center justify-center rounded-xl bg-white/5 motion-safe:animate-pulse" data-testid="comparison-preparing">
        <span className="text-xs text-white/60">{t("preparing")}</span>
      </div>
    );
  }
  if (entry.status === "error" || !entry.before || !entry.after) return null;

  return (
    <BeforeAfterSlider
      before={entry.before}
      after={entry.after}
      beforeLabel={t("before")}
      afterLabel={t("after")}
      label={t("label")}
      valueText={(percent) => t("valueText", { percent })}
      beforeAlt={t("beforeAlt")}
      afterAlt={t("afterAlt")}
    />
  );
}

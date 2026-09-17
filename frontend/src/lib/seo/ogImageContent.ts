import { formatPriceCents } from "@/lib/format/currency";
import { deriveBuildSummary } from "@/lib/showroom/buildSummary";
import type { VehicleDetailDto } from "@/types/catalog";
import type { SavedConfigurationDto } from "@/types/configuration";

export interface OgImageContent {
  vehicleName: string;
  tagline: string;
  priceLabel: string;
  /** 2-3 build-summary lines (Spec 9's deriveBuildSummary) for a shared build; empty when
   * rendering the vehicle's default/unconfigured state. */
  lines: string[];
}

/**
 * Pure content derivation for the dynamic OG image (Spec 23, AC-2) — kept separate from
 * src/app/api/og/route.tsx's ImageResponse/JSX rendering so it's unit-testable without
 * spinning up satori. Reuses Spec 9's own deriveBuildSummary rather than re-deriving
 * "what did they build" a second way.
 *
 * `saved` is ignored (falls back to the vehicle's default-state content) whenever it doesn't
 * actually belong to `vehicle` — defensive against a crawler hitting this route directly with
 * a stale or mismatched `slug`/`build` combination, since there's no redirect to fall back on
 * for an image response the way the page itself has (Spec 10, AC-5).
 */
export function deriveOgImageContent(vehicle: VehicleDetailDto, saved: SavedConfigurationDto | null): OgImageContent {
  const matchingSaved = saved && saved.vehicleSlug === vehicle.slug ? saved : null;

  const defaultContent: OgImageContent = {
    vehicleName: vehicle.name,
    tagline: vehicle.tagline,
    priceLabel: `Starting at ${formatPriceCents(vehicle.basePriceCents, vehicle.currency)}`,
    lines: [],
  };

  if (!matchingSaved) return defaultContent;

  try {
    // deriveBuildSummary re-validates selections against the vehicle's current live option
    // list and throws if any no longer resolve (e.g. an option deactivated, Spec 21 AC-3,
    // since this build was saved) — this route must never 500 for a crawler over a stale
    // build (this spec's own Rollout note), so an older, still-accurate summary beats none.
    const summary = deriveBuildSummary(
      vehicle,
      matchingSaved.singleSelections,
      matchingSaved.multiSelections,
      matchingSaved.customPaintHex,
    );
    const lines = summary.alwaysShown.slice(0, 3).map((line) => `${line.label}: ${line.optionName}`);

    return {
      vehicleName: vehicle.name,
      tagline: vehicle.tagline,
      priceLabel: formatPriceCents(matchingSaved.breakdown.totalPriceCents, vehicle.currency),
      lines,
    };
  } catch {
    return { ...defaultContent, priceLabel: formatPriceCents(matchingSaved.breakdown.totalPriceCents, vehicle.currency) };
  }
}

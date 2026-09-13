import Link from "next/link";
import { formatPriceCents } from "@/lib/format/currency";
import type { VehicleSummaryDto } from "@/types/catalog";
import { buildShowcaseStages } from "./showcaseStages";

export interface StaticScrollShowcaseProps {
  vehicle: VehicleSummaryDto;
}

/**
 * Shared simplified fallback for both `prefers-reduced-motion` (AC-10) and below-`lg`
 * viewports (AC-12) — a normal, non-pinned, stacked sequence of the vehicle's own
 * fallbackImageUrl (Spec 12, no new asset needed) repeated with each beat's real caption
 * text, no scroll-driven camera animation. One component for both conditions since neither
 * AC calls for a genuinely different experience, and there's no distinct photo per beat to
 * justify two different fallbacks (same "don't fabricate assets" treatment as
 * Static3DFallback).
 */
export function StaticScrollShowcase({ vehicle }: StaticScrollShowcaseProps) {
  const stages = buildShowcaseStages(vehicle.name);

  return (
    <section aria-label={`${vehicle.name} showcase`} className="flex flex-col items-center gap-10 px-6 py-16">
      {stages.map((stage) => (
        <div key={stage.id} className="glass-panel flex w-full max-w-md flex-col items-center gap-4 rounded-2xl p-6 text-center">
          {/* Skipped when empty (e.g. the API-unreachable FALLBACK_VEHICLE in app/page.tsx) —
              an <img src=""> makes the browser re-request the current document. */}
          {vehicle.fallbackImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={vehicle.fallbackImageUrl} alt="" className="max-h-40 w-auto object-contain" />
          )}
          <p className="text-sm text-white/80">{stage.caption}</p>
        </div>
      ))}

      <div className="glass-panel flex w-full max-w-md flex-col items-center gap-3 rounded-2xl p-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Starting at</p>
        <p className="text-2xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          {formatPriceCents(vehicle.basePriceCents, vehicle.currency)}
        </p>
        <Link
          href={`/configure/${vehicle.slug}`}
          className="focus-ring rounded-full bg-white px-8 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
        >
          Configure Your Car
        </Link>
      </div>
    </section>
  );
}

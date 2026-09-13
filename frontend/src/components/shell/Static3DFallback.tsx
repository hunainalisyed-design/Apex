import type { VehicleSummaryDto } from "@/types/catalog";

export interface Static3DFallbackProps {
  vehicle: VehicleSummaryDto;
}

/** Shown whenever a 3D canvas can't render — WebGL unavailable or a lost context (Spec 12,
 * AC-1). Consolidates what were previously two near-identical, vehicle-agnostic stand-ins
 * (Spec 4's HeroFallback, Spec 5's ShowroomFallback) into the real implementation the spec
 * actually asks for: the vehicle's own fallbackImageUrl plus its name and spec sheet, not
 * just a generic "3D preview unavailable" label. */
export function Static3DFallback({ vehicle }: Static3DFallbackProps) {
  return (
    <div
      className="glass-panel flex h-full w-full flex-col items-center justify-center gap-4 rounded-2xl p-6 text-center"
      style={{
        background: "radial-gradient(circle at 50% 40%, rgba(61,111,224,0.2), rgba(10,10,12,0.4) 70%)",
      }}
    >
      {/* No real static asset exists behind any placeholder URL in this catalog yet (Spec
          2 Risk #1) — a plain <img> tolerates a broken image rather than requiring
          next/image's optimizer to resolve a real file. Decorative (empty alt): the
          vehicle name is already announced as adjacent heading text. Skipped entirely when
          empty (e.g. the API-unreachable FALLBACK_VEHICLE in app/page.tsx) — an <img
          src=""> makes the browser re-request the current document. */}
      {vehicle.fallbackImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vehicle.fallbackImageUrl} alt="" className="max-h-40 w-auto object-contain" />
      )}
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">3D preview unavailable</p>
        <h2 className="text-xl font-bold tracking-tight" style={{ fontFamily: "var(--font-display)" }}>
          {vehicle.name}
        </h2>
      </div>
      <dl className="flex gap-6 text-xs text-white/70">
        <div>
          <dt className="uppercase tracking-wide text-white/40">Horsepower</dt>
          <dd className="font-semibold text-white">{vehicle.horsepower} hp</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-white/40">Top Speed</dt>
          <dd className="font-semibold text-white">{vehicle.topSpeedKph} km/h</dd>
        </div>
        <div>
          <dt className="uppercase tracking-wide text-white/40">0–100</dt>
          <dd className="font-semibold text-white">{vehicle.zeroToHundredSec}s</dd>
        </div>
      </dl>
    </div>
  );
}

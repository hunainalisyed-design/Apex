import type { Metadata } from "next";
import Link from "next/link";
import { getVehicles } from "@/lib/api/vehicles";
import { formatPriceCents } from "@/lib/format/currency";
import { VehicleModelPreview } from "@/components/models/VehicleModelPreview";
import { getRealGlbVehicleConfig, SHOWCASE_TARGET_LENGTH_RATIO } from "@/lib/showroom/realGlbVehicles";

const DESCRIPTION = "Explore the full Apex lineup and open any model in the 3D configurator.";

export const metadata: Metadata = {
  title: "Explore Models",
  description: DESCRIPTION,
  openGraph: { title: "Explore Models | APEX", description: DESCRIPTION },
};

export default async function ModelsPage() {
  const vehicles = await getVehicles();

  return (
    <main id="main-content" tabIndex={-1} className="flex min-h-full flex-1 flex-col items-center gap-10 px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-white/50">Apex Lineup</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
          Explore Models
        </h1>
      </div>

      <div className="grid w-full max-w-4xl grid-cols-1 gap-6 sm:grid-cols-2">
        {vehicles.map((vehicle) => {
          const glbConfig = getRealGlbVehicleConfig(vehicle.slug);
          return (
            <Link
              key={vehicle.slug}
              href={`/configure/${vehicle.slug}`}
              className="focus-ring glass-panel group flex flex-col gap-4 rounded-2xl p-6 transition hover:bg-white/[0.06]"
            >
              {glbConfig ? (
                <VehicleModelPreview
                  vehicle={vehicle}
                  modelUrl={vehicle.heroModelUrl}
                  targetLength={glbConfig.targetLength * SHOWCASE_TARGET_LENGTH_RATIO}
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="flex h-32 w-full items-center justify-center rounded-xl"
                  style={{
                    background:
                      "radial-gradient(circle at 50% 40%, rgba(61,111,224,0.25), rgba(10,10,12,0.5) 70%)",
                  }}
                >
                  <span className="text-xs uppercase tracking-[0.3em] text-white/40">
                    {vehicle.name}
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-1">
                <h2 className="text-xl font-bold tracking-tight">{vehicle.name}</h2>
                <p className="text-sm text-white/60">{vehicle.tagline}</p>
                <dl className="mt-1 flex gap-4 text-xs text-white/50">
                  <div>
                    <dt className="inline uppercase tracking-wide">HP </dt>
                    <dd className="inline text-white/70">{vehicle.horsepower}</dd>
                  </div>
                  <div>
                    <dt className="inline uppercase tracking-wide">Top </dt>
                    <dd className="inline text-white/70">{vehicle.topSpeedKph} km/h</dd>
                  </div>
                  <div>
                    <dt className="inline uppercase tracking-wide">0–100 </dt>
                    <dd className="inline text-white/70">{vehicle.zeroToHundredSec}s</dd>
                  </div>
                </dl>
                <p className="mt-2 text-sm font-semibold text-white/80">
                  From {formatPriceCents(vehicle.basePriceCents, vehicle.currency)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {vehicles.length === 0 && (
        <p className="text-sm text-white/50">No vehicles are available right now.</p>
      )}
    </main>
  );
}

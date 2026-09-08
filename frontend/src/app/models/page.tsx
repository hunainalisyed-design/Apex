import Link from "next/link";
import { formatPriceCents } from "@/lib/format/currency";
import type { VehicleSummaryDto } from "@/types/catalog";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function getVehicles(): Promise<VehicleSummaryDto[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/vehicles`, { cache: "no-store" });
    if (!res.ok) return [];
    const { data } = (await res.json()) as { data: VehicleSummaryDto[] };
    return data;
  } catch {
    return [];
  }
}

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
        {vehicles.map((vehicle) => (
          <Link
            key={vehicle.slug}
            href={`/configure/${vehicle.slug}`}
            className="focus-ring glass-panel group flex flex-col gap-4 rounded-2xl p-6 transition hover:bg-white/[0.06]"
          >
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
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold tracking-tight">{vehicle.name}</h2>
              <p className="text-sm text-white/60">{vehicle.tagline}</p>
              <p className="mt-2 text-sm font-semibold text-white/80">
                From {formatPriceCents(vehicle.basePriceCents, vehicle.currency)}
              </p>
            </div>
          </Link>
        ))}
      </div>

      {vehicles.length === 0 && (
        <p className="text-sm text-white/50">No vehicles are available right now.</p>
      )}
    </main>
  );
}

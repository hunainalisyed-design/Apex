import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { getVehicles } from "@/lib/api/vehicles";
import { ModelsSectionClient } from "./ModelsSectionClient";

/** Server-fetches the catalog once and derives the default-vehicle configure href from the
 * same already-ordered list (mirrors getDefaultVehicleSlug()'s own "first active vehicle"
 * semantics — see lib/api/vehicles.ts) rather than calling that helper separately, which
 * would issue a second, redundant `GET /api/vehicles` request for data already in hand. */
export async function ModelsSection() {
  const vehicles = await getVehicles();
  if (vehicles.length === 0) return null;

  const configureHref = `/configure/${vehicles[0].slug}`;

  // The catalog's thumbnailUrl fields point at /models/{slug}/thumbnail.jpg for every
  // vehicle, but no file exists behind any of those paths yet (real photos are pending —
  // only two of the three vehicles will get one at all). Checking existence here, on the
  // server, before ever handing a URL to the client <img>, means ModelCard never attempts a
  // doomed request — no 404, no console error — and each card silently starts using the
  // real photo the moment a file actually lands at that path, no code change needed. Same
  // "empty string means don't render the image" contract ModelCard/Static3DFallback
  // already use elsewhere in this codebase.
  const vehiclesWithVerifiedPhotos = vehicles.map((vehicle) => {
    const hasPhoto = vehicle.thumbnailUrl
      ? existsSync(join(process.cwd(), "public", vehicle.thumbnailUrl))
      : false;
    return { ...vehicle, thumbnailUrl: hasPhoto ? vehicle.thumbnailUrl : "" };
  });

  return (
    <section aria-label="Our models" className="mx-auto w-full max-w-6xl px-6 py-16 lg:px-16">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Our Models</p>
          <h2
            className="text-3xl font-bold tracking-tight sm:text-4xl"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Explore the Lineup
          </h2>
        </div>
        <Link
          href="/models"
          className="focus-ring text-xs font-semibold uppercase tracking-wide text-white/60 transition hover:text-white"
        >
          View All Models →
        </Link>
      </div>

      <ModelsSectionClient vehicles={vehiclesWithVerifiedPhotos} configureHref={configureHref} />
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect } from "react";
import { GarageCard } from "../GarageCard/GarageCard";
import { useGarageStore } from "@/state/garageStore";

function GarageSkeleton() {
  return (
    <div data-testid="garage-skeleton" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="glass-panel flex flex-col gap-3 rounded-2xl p-4">
          <div className="h-24 animate-pulse rounded-xl bg-white/5" />
          <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
        </div>
      ))}
    </div>
  );
}

/** The garage list (Spec 17): loading skeleton, an inline error+Retry on a failed fetch
 * (matching this codebase's existing SaveSharePanel inline-error convention, since no
 * dedicated shared "error state" component exists to reuse), AC-11's empty state, or a
 * responsive card grid — card grid on desktop, single column on mobile (§5). */
export function GarageList() {
  const status = useGarageStore((s) => s.status);
  const configurations = useGarageStore((s) => s.configurations);
  const vehiclesBySlug = useGarageStore((s) => s.vehiclesBySlug);
  const error = useGarageStore((s) => s.error);
  const load = useGarageStore((s) => s.load);

  useEffect(() => {
    void load();
  }, [load]);

  if (status === "loading" || status === "idle") {
    return <GarageSkeleton />;
  }

  if (status === "error") {
    return (
      <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-8 text-center">
        <p className="text-sm text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring"
        >
          Retry
        </button>
      </div>
    );
  }

  if (configurations.length === 0) {
    return (
      <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-8 text-center">
        <p className="text-sm text-white/70">You haven&apos;t saved any builds yet.</p>
        <Link
          href="/models"
          className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 focus-ring"
        >
          Start Configuring
        </Link>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {configurations.map((configuration) => (
        <GarageCard
          key={configuration.publicId}
          configuration={configuration}
          vehicle={vehiclesBySlug[configuration.vehicleSlug]}
        />
      ))}
    </div>
  );
}

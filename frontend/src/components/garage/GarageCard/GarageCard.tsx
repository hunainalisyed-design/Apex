"use client";

import Link from "next/link";
import { useState } from "react";
import { DeleteConfirmDialog } from "../GarageList/DeleteConfirmDialog";
import { formatPriceCents } from "@/lib/format/currency";
import { formatSavedDate } from "@/lib/format/date";
import { deriveBuildSummary, type BuildSummaryLine } from "@/lib/showroom/buildSummary";
import { useGarageStore } from "@/state/garageStore";
import type { VehicleDetailDto } from "@/types/catalog";
import type { SavedConfigurationDto } from "@/types/configuration";

export interface GarageCardProps {
  configuration: SavedConfigurationDto;
  /** undefined while its vehicle's detail fetch is still in flight (garageStore.load()
   * fetches every unique vehicle in parallel, not per-card) — kept as an explicit prop
   * rather than a try/catch fallback so "still loading" and "derivation genuinely failed"
   * render as visibly distinct states. */
  vehicle: VehicleDetailDto | undefined;
}

function CardSkeleton() {
  return (
    <div className="glass-panel flex flex-col gap-3 rounded-2xl p-4">
      <div className="h-24 animate-pulse rounded-xl bg-white/5" />
      <div className="h-4 w-2/3 animate-pulse rounded bg-white/5" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
    </div>
  );
}

/** One saved build (Spec 17, AC-2): vehicle thumbnail/name, a condensed build summary
 * (reusing Spec 9's deriveBuildSummary — only the "always shown" lines, not the full
 * scrollable breakdown BuildSummary.tsx shows in the live configurator), total price,
 * saved date, and Load/Delete actions. */
export function GarageCard({ configuration, vehicle }: GarageCardProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const isDeleting = useGarageStore((s) => s.deletingPublicIds[configuration.publicId] ?? false);
  const deleteError = useGarageStore((s) => s.deleteErrors[configuration.publicId] ?? null);
  const deleteConfigurationAction = useGarageStore((s) => s.deleteConfiguration);

  if (!vehicle) return <CardSkeleton />;

  let alwaysShownLines: BuildSummaryLine[];
  try {
    alwaysShownLines = deriveBuildSummary(
      vehicle,
      configuration.singleSelections,
      configuration.multiSelections,
      configuration.customPaintHex,
    ).alwaysShown;
  } catch {
    // A genuine derivation failure (e.g. a selected option no longer exists on this
    // vehicle) — degrade to showing the total without the condensed lines rather than
    // crashing the whole list.
    alwaysShownLines = [];
  }

  async function handleConfirmDelete() {
    await deleteConfigurationAction(configuration.publicId);
    setIsConfirming(false);
  }

  return (
    <div className="glass-panel flex flex-col gap-3 rounded-2xl p-4">
      {/* No real static asset pipeline exists yet (docs/CLAUDE.md's "Known open blocker")
          — a plain <img> tolerates a broken thumbnail URL, matching Static3DFallback's own
          convention rather than requiring next/image's optimizer to resolve a real file. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={vehicle.thumbnailUrl} alt="" className="h-24 w-full rounded-xl object-cover" />

      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">{vehicle.name}</p>
        <p className="text-xs text-white/50">{formatSavedDate(configuration.createdAt)}</p>
      </div>

      {alwaysShownLines.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-white/70">
          {alwaysShownLines.map((line) => (
            <li key={line.category}>
              {line.label}: {line.optionName}
            </li>
          ))}
        </ul>
      )}

      <p className="text-sm font-semibold text-white">
        {formatPriceCents(configuration.breakdown.totalPriceCents, vehicle.currency)}
      </p>

      {deleteError && <p className="text-xs text-red-300">{deleteError}</p>}

      <div className="flex gap-2">
        <Link
          href={`/configure/${configuration.vehicleSlug}?build=${configuration.publicId}`}
          className="flex-1 rounded-full bg-white px-4 py-2 text-center text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 focus-ring"
        >
          Load
        </Link>
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          className="flex-1 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring"
        >
          Delete
        </button>
      </div>

      <DeleteConfirmDialog
        isOpen={isConfirming}
        isDeleting={isDeleting}
        error={null}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsConfirming(false)}
      />
    </div>
  );
}

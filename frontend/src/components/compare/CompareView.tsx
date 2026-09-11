"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LoadingScreen } from "@/components/shell/LoadingScreen";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { buildCompareUrl, excludeVehicle } from "@/lib/compare/compareState";
import { useCompareStore } from "@/state/compareStore";
import { CompareSceneErrorBoundary } from "./CompareSceneErrorBoundary";
import { SpecTable } from "./SpecTable";
import { VehicleSelect } from "./VehicleSelect";

const CompareScene = dynamic(() => import("./CompareScene").then((m) => m.CompareScene), {
  ssr: false,
  loading: () => <LoadingScreen label="Loading 3D view…" />,
});

export interface CompareViewProps {
  initialLeftSlug?: string;
  initialRightSlug?: string;
}

function CompareSkeleton() {
  return (
    <div className="flex flex-col gap-6" data-testid="compare-skeleton">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="h-20 animate-pulse rounded-xl bg-white/5" />
        <div className="h-20 animate-pulse rounded-xl bg-white/5" />
      </div>
      <div className="h-56 animate-pulse rounded-xl bg-white/5" />
    </div>
  );
}

/**
 * Orchestrates the whole /compare page (Spec 18). All fetch-driven state lives in
 * compareStore.ts (a plain global Zustand store, matching this codebase's convention for
 * every other fetch-driven feature) — this component just reads it and wires up the two
 * effects that trigger its async actions, plus the one thing a store can't own: URL sync,
 * which needs the router hook.
 */
export function CompareView({ initialLeftSlug, initialRightSlug }: CompareViewProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const status = useCompareStore((s) => s.status);
  const vehicles = useCompareStore((s) => s.vehicles);
  const leftSlug = useCompareStore((s) => s.leftSlug);
  const rightSlug = useCompareStore((s) => s.rightSlug);
  const view = useCompareStore((s) => s.view);
  const threeDUnavailable = useCompareStore((s) => s.threeDUnavailable);
  const leftAppearance = useCompareStore((s) => s.leftAppearance);
  const rightAppearance = useCompareStore((s) => s.rightAppearance);
  const detailsLoading = useCompareStore((s) => s.detailsLoading);
  const load = useCompareStore((s) => s.load);
  const setPair = useCompareStore((s) => s.setPair);
  const setView = useCompareStore((s) => s.setView);
  const handle3DFailure = useCompareStore((s) => s.handle3DFailure);
  const loadDetails = useCompareStore((s) => s.loadDetails);

  useEffect(() => {
    void load(initialLeftSlug, initialRightSlug);
    // Only ever resolves the pair from the URL this component mounted with — a later
    // selector change updates the URL as a side effect of setPair below, not the reverse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === "3d" && !leftAppearance) {
      void loadDetails();
    }
  }, [view, leftAppearance, loadDetails]);

  function handleLeftChange(slug: string) {
    setPair(slug, rightSlug);
    router.replace(buildCompareUrl(slug, rightSlug), { scroll: false });
  }

  function handleRightChange(slug: string) {
    setPair(leftSlug, slug);
    router.replace(buildCompareUrl(leftSlug, slug), { scroll: false });
  }

  if (status === "loading") return <CompareSkeleton />;

  if (status === "error") {
    return (
      <div className="glass-panel flex flex-col items-center gap-3 rounded-2xl p-8 text-center">
        <p className="text-sm text-red-300">Unable to load vehicles. Please try again.</p>
        <button
          type="button"
          onClick={() => void load(initialLeftSlug, initialRightSlug)}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring"
        >
          Retry
        </button>
      </div>
    );
  }

  const leftVehicle = vehicles.find((v) => v.slug === leftSlug)!;
  const rightVehicle = vehicles.find((v) => v.slug === rightSlug)!;
  const leftOptions = excludeVehicle(vehicles, rightSlug);
  const rightOptions = excludeVehicle(vehicles, leftSlug);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <VehicleSelect label="Vehicle 1" vehicles={leftOptions} value={leftSlug} onChange={handleLeftChange} />
          <Link
            href={`/configure/${leftSlug}`}
            className="self-start rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring"
          >
            Configure This Vehicle
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          <VehicleSelect label="Vehicle 2" vehicles={rightOptions} value={rightSlug} onChange={handleRightChange} />
          <Link
            href={`/configure/${rightSlug}`}
            className="self-start rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring"
          >
            Configure This Vehicle
          </Link>
        </div>
      </div>

      <div role="tablist" aria-label="Comparison view" className="glass-panel flex w-fit gap-1 rounded-full p-1">
        <button
          type="button"
          role="tab"
          aria-selected={view === "table"}
          onClick={() => setView("table")}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition focus-ring ${
            view === "table" ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          Spec Table
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "3d"}
          disabled={threeDUnavailable}
          title={threeDUnavailable ? "3D view unavailable" : undefined}
          onClick={() => setView("3d")}
          className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition focus-ring disabled:cursor-not-allowed disabled:opacity-40 ${
            view === "3d" ? "bg-white text-black" : "text-white/70 hover:bg-white/10 hover:text-white"
          }`}
        >
          3D View
        </button>
      </div>

      {view === "table" && (
        <div className="overflow-x-auto">
          <SpecTable left={leftVehicle} right={rightVehicle} />
        </div>
      )}

      {view === "3d" && (
        <div className="aspect-video w-full">
          {detailsLoading || !leftAppearance || !rightAppearance ? (
            <LoadingScreen label="Loading 3D view…" />
          ) : (
            <CompareSceneErrorBoundary onError={handle3DFailure}>
              <CompareScene left={leftAppearance} right={rightAppearance} reducedMotion={reducedMotion} />
            </CompareSceneErrorBoundary>
          )}
        </div>
      )}
    </div>
  );
}

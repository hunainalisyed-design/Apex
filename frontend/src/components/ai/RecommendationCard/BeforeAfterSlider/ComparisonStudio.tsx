"use client";

import { useCallback, useEffect, useState } from "react";
import { useComparisonStore, type ComparisonJob } from "@/state/comparisonStore";
import type { VehicleDetailDto } from "@/types/catalog";
import { COMPARISON_HEIGHT, COMPARISON_WIDTH, StudioCanvas } from "./StudioCanvas";

/** A pair that isn't ready by then is given up on, and the card keeps its plain list (§5 Error). */
export const COMPARISON_TIMEOUT_MS = 15_000;

interface Progress {
  messageId: string;
  stage: "before" | "after";
  before: string | null;
}

/**
 * Works through the queue in ONE hidden 3D view: for each pair it draws "before", then "after",
 * by changing the build in place — no new 3D context per picture, or per pair. The view exists
 * only while there is work, so a batch of recommendations costs one context, created once.
 */
function StudioSession({ vehicle, job, onBroken }: { vehicle: VehicleDetailDto; job: ComparisonJob; onBroken: () => void }) {
  const complete = useComparisonStore((s) => s.complete);
  const fail = useComparisonStore((s) => s.fail);
  const [progress, setProgress] = useState<Progress>({ messageId: job.messageId, stage: "before", before: null });
  // A new job starts at "before" — derived, so there's no frame showing the old job's stage.
  const current: Progress = progress.messageId === job.messageId ? progress : { messageId: job.messageId, stage: "before", before: null };
  const captureId = `${current.messageId}:${current.stage}`;

  useEffect(() => {
    const timer = setTimeout(() => fail(job.messageId), COMPARISON_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [job.messageId, fail]);

  const onCapture = useCallback(
    (id: string, url: string) => {
      if (id !== captureId) return; // a late picture from a job that already moved on
      if (current.stage === "before") {
        setProgress({ messageId: current.messageId, stage: "after", before: url });
      } else if (current.before) {
        complete(current.messageId, current.before, url);
      }
    },
    [captureId, current.stage, current.messageId, current.before, complete],
  );

  const onError = useCallback(() => {
    fail(job.messageId);
    onBroken();
  }, [fail, job.messageId, onBroken]);

  return (
    <StudioCanvas
      vehicle={vehicle}
      selection={current.stage === "before" ? job.before : job.after}
      captureId={captureId}
      onCapture={onCapture}
      onError={onError}
    />
  );
}

/**
 * The hidden 3D studio that makes the before/after pictures for CarAI recommendation cards
 * (Spec 36). It is a separate, off-screen 3D view that exists only while pairs are being made —
 * the live showroom is never changed, so it can't flash the "after" build (Risk #1, avoided by
 * construction rather than timing). Anything that goes wrong (no WebGL, a model that won't
 * load, the timeout) just marks that pair failed, and its card keeps the plain list.
 */
export function ComparisonStudio({ vehicle }: { vehicle: VehicleDetailDto }) {
  const job = useComparisonStore((s) => s.current);
  const fail = useComparisonStore((s) => s.fail);
  // After a render failure the view is rebuilt once for the next pair (a broken context can't recover).
  const [generation, setGeneration] = useState(0);
  const onBroken = useCallback(() => setGeneration((g) => g + 1), []);

  useEffect(() => {
    if (job && job.vehicleSlug !== vehicle.slug) fail(job.messageId);
  }, [job, vehicle.slug, fail]);

  if (!job || job.vehicleSlug !== vehicle.slug) return null;

  return (
    <div
      aria-hidden="true"
      data-testid="comparison-studio"
      style={{ position: "fixed", left: -10_000, top: 0, width: COMPARISON_WIDTH, height: COMPARISON_HEIGHT, pointerEvents: "none" }}
    >
      <StudioSession key={generation} vehicle={vehicle} job={job} onBroken={onBroken} />
    </div>
  );
}

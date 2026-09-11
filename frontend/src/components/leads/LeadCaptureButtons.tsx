"use client";

import { useState } from "react";
import { LeadRequestDialog } from "./LeadRequestDialog";

/**
 * The two entry points into lead capture (Spec 19, AC-1) — a sibling of BuildSummary/
 * SaveSharePanel/CaptureBuild in ConfigureShowroom.tsx's panel, reachable from both a fresh
 * build and a loaded saved build (both render through that same component tree, so one
 * placement covers both of AC-1's scenarios).
 */
export function LeadCaptureButtons() {
  const [requestType, setRequestType] = useState<"QUOTE" | "TEST_DRIVE" | null>(null);

  return (
    <div className="glass-panel flex gap-2 rounded-2xl p-3">
      <button
        type="button"
        onClick={() => setRequestType("QUOTE")}
        className="flex-1 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring"
      >
        Request Quote
      </button>
      <button
        type="button"
        onClick={() => setRequestType("TEST_DRIVE")}
        className="flex-1 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring"
      >
        Book a Test Drive
      </button>

      {requestType && <LeadRequestDialog requestType={requestType} onClose={() => setRequestType(null)} />}
    </div>
  );
}

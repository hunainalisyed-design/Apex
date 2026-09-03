"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

type BackendState = "checking" | "connected" | "unreachable";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export function SystemStatus() {
  const [state, setState] = useState<BackendState>("checking");
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let cancelled = false;

    async function checkHealth() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/health`, { cache: "no-store" });
        if (cancelled) return;
        setState(res.ok ? "connected" : "unreachable");
      } catch {
        if (!cancelled) setState("unreachable");
      }
    }

    checkHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  const label =
    state === "checking"
      ? "Checking backend…"
      : state === "connected"
        ? "Backend connected"
        : "Backend unreachable";

  const dotColor =
    state === "connected" ? "bg-emerald-400" : state === "unreachable" ? "bg-red-400" : "bg-white/40";

  return (
    <div
      className="glass-panel inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-white/80"
      data-testid="system-status"
      data-state={state}
    >
      <span
        className={`h-2 w-2 rounded-full ${dotColor} ${
          state === "checking" && !reducedMotion ? "animate-pulse" : ""
        }`}
        aria-hidden="true"
      />
      {label}
    </div>
  );
}

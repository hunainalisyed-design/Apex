import type { NextFunction, Request, Response } from "express";

const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

interface WindowState {
  count: number;
  windowStart: number;
}

const hits = new Map<string, WindowState>();

/**
 * A small in-memory fixed-window limiter for POST /api/configurations (Spec 10 Risk #1 —
 * explicitly framed there as "lightweight," not production abuse infrastructure, which is
 * Phase 3). Hand-rolled rather than a new dependency: no rate-limiting package exists
 * anywhere in this codebase, and this project has otherwise added zero new runtime
 * dependencies across nine prior specs for equivalent needs. Single-process only — there's
 * no multi-instance deployment in this repo, so no shared store is needed either.
 */
export function configurationRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip ?? "unknown";
  const now = Date.now();
  const entry = hits.get(ip);

  if (!entry || now - entry.windowStart > WINDOW_MS) {
    hits.set(ip, { count: 1, windowStart: now });
    next();
    return;
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    res.status(429).json({ code: "RATE_LIMITED", message: "Too many save requests. Try again shortly." });
    return;
  }

  entry.count++;
  next();
}

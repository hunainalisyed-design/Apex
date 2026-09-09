import type { NextFunction, Request, Response } from "express";

interface WindowState {
  count: number;
  windowStart: number;
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  code: string;
  message: string;
}

/**
 * A small in-memory fixed-window limiter factory. Hand-rolled rather than a new
 * dependency: no rate-limiting package exists anywhere in this codebase, and this project
 * has otherwise added zero new runtime dependencies for equivalent needs (Spec 10 Risk #1).
 * Single-process only — there's no multi-instance deployment in this repo, so no shared
 * store is needed either. Extracted into a factory (Spec 14) now that a second consumer
 * needs a different cadence — each call gets its own independent `Map`, so the two limiters
 * never share state.
 */
function createRateLimit(options: RateLimitOptions) {
  const hits = new Map<string, WindowState>();

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip ?? "unknown";
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now - entry.windowStart > options.windowMs) {
      hits.set(ip, { count: 1, windowStart: now });
      next();
      return;
    }

    if (entry.count >= options.maxRequests) {
      res.status(429).json({ code: options.code, message: options.message });
      return;
    }

    entry.count++;
    next();
  };
}

/** POST /api/configurations (Spec 10 Risk #1) — explicitly framed there as "lightweight,"
 * not production abuse infrastructure, which is Phase 3. */
export const configurationRateLimit = createRateLimit({
  windowMs: 60_000,
  maxRequests: 10,
  code: "RATE_LIMITED",
  message: "Too many save requests. Try again shortly.",
});

/** POST /api/ai/configure (Spec 14 Risk #2) — tighter than the save limiter since this one
 * hits a paid external API per request: roughly one request per few seconds. */
export const aiRateLimit = createRateLimit({
  windowMs: 5_000,
  maxRequests: 1,
  code: "RATE_LIMITED",
  message: "Too many CarAI requests. Please wait a moment and try again.",
});

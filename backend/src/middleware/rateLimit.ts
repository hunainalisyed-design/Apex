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
  /** Groups hits by something other than the caller's IP — e.g. the login route's
   * per-email limiter (Spec 16 AC-5), which must catch credential stuffing against one
   * account from many IPs. Defaults to the original IP-keyed behavior. */
  keyFn?: (req: Request) => string;
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
  const keyFn = options.keyFn ?? ((req: Request) => req.ip ?? "unknown");

  return function rateLimit(req: Request, res: Response, next: NextFunction) {
    const key = keyFn(req);
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now - entry.windowStart > options.windowMs) {
      hits.set(key, { count: 1, windowStart: now });
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

/** POST /api/auth/login, IP dimension (Spec 16 AC-5) — catches brute-forcing many accounts
 * from one IP. Chained with loginRateLimitByEmail below; each owns its own Map, so chaining
 * them is safe and neither over- nor under-counts the other's hits. */
export const loginRateLimitByIp = createRateLimit({
  windowMs: 60_000,
  maxRequests: 10,
  code: "TOO_MANY_ATTEMPTS",
  message: "Too many login attempts. Please try again shortly.",
});

/** POST /api/auth/login, email dimension (Spec 16 AC-5) — catches credential stuffing
 * against one account from many IPs, which the IP-keyed limiter above can't see. */
export const loginRateLimitByEmail = createRateLimit({
  windowMs: 60_000,
  maxRequests: 5,
  code: "TOO_MANY_ATTEMPTS",
  message: "Too many login attempts. Please try again shortly.",
  keyFn: (req) => `email:${String(req.body?.email ?? "").trim().toLowerCase()}`,
});

/** POST /api/leads (Spec 19) — creates a real business record and sends two real emails
 * per request, matching this codebase's own convention of rate-limiting every endpoint
 * with a real side effect. */
export const leadRateLimit = createRateLimit({
  windowMs: 60_000,
  maxRequests: 5,
  code: "RATE_LIMITED",
  message: "Too many requests. Try again shortly.",
});

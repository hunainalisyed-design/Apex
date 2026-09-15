import type { NextFunction, Request, Response } from "express";
import { sendApiError } from "../lib/apiError.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { SESSION_COOKIE_NAME, validateSession } from "../services/auth/session.js";

/**
 * Gates every /api/admin/* route (Spec 21). Deliberately standalone rather than composed
 * with requireAuth: chaining would 401 a signed-out caller and 404 a signed-in-but-wrong-role
 * one, and that difference is itself an information leak (it would tell an unauthenticated
 * caller the route exists but needs auth, versus a signed-in regular user learning the route
 * exists but is off-limits). AC-1 wants exactly one response — a generic 404 — regardless of
 * why the caller doesn't qualify, so both cases collapse to the same branch below.
 */
export const requireAdmin = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const user = typeof token === "string" ? await validateSession(token) : null;

  if (!user || user.role !== "ADMIN") {
    sendApiError(res, 404, "NOT_FOUND", "Not found.");
    return;
  }

  req.user = user;
  req.sessionToken = token;
  next();
});

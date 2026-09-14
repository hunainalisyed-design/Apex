import type { NextFunction, Request, Response } from "express";
import { sendApiError } from "../lib/apiError.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { SESSION_COOKIE_NAME, validateSession } from "../services/auth/session.js";

/** Rejects with 401 when there's no valid session (Spec 16). Used by routes that require a
 * signed-in user, e.g. POST /api/auth/logout. */
export const requireAuth = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const user = typeof token === "string" ? await validateSession(token) : null;

  if (!user) {
    sendApiError(res, 401, "UNAUTHENTICATED", "You must be signed in to do this.");
    return;
  }

  req.user = user;
  req.sessionToken = token;
  next();
});

/** Attaches req.user when a valid session cookie is present, but never errors — used by
 * GET /api/auth/me (Spec 16 AC-10), which must succeed for both signed-in and guest callers. */
export const optionalAuth = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[SESSION_COOKIE_NAME];
  const user = typeof token === "string" ? await validateSession(token) : null;

  if (user) req.user = user;
  next();
});

import { Router } from "express";
import { sendApiError } from "../lib/apiError.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { logger } from "../lib/logger.js";
import { liveSessionRateLimit } from "../middleware/rateLimit.js";
import { getVehicleWithOptions } from "../services/catalog.js";
import {
  buildLiveCatalog,
  isLiveCollabEnabled,
  isSessionId,
  liveSessions,
  validateState,
} from "../services/liveSession/index.js";
import type { ApiResponse } from "../types/api.js";
import type { CreateLiveSessionRequest, LiveSessionDto } from "../types/liveSession.js";

export const liveSessionsRouter = Router();

function disabled(res: Parameters<typeof sendApiError>[0]) {
  sendApiError(res, 503, "LIVE_COLLAB_DISABLED", "Live sessions are turned off right now.");
}

/**
 * Starts a live session from the creator's current build (Spec 33, AC-1). No account needed
 * (AC-8). The starting state is checked against the vehicle's catalog exactly like a save, so
 * a session can never hold selections the configurator couldn't.
 */
liveSessionsRouter.post(
  "/live-sessions",
  liveSessionRateLimit,
  asyncHandler(async (req, res) => {
    if (!isLiveCollabEnabled()) {
      disabled(res);
      return;
    }
    const body = (req.body ?? {}) as Partial<CreateLiveSessionRequest>;
    if (typeof body.vehicleSlug !== "string" || !body.vehicleSlug) {
      sendApiError(res, 400, "VALIDATION_ERROR", "vehicleSlug is required.", { vehicleSlug: ["Required."] });
      return;
    }

    const found = await getVehicleWithOptions(body.vehicleSlug);
    if (!found) {
      sendApiError(res, 404, "VEHICLE_NOT_FOUND", "No vehicle matches this slug.");
      return;
    }

    const catalog = await buildLiveCatalog(found.options);
    const initial = {
      singleSelections: body.singleSelections ?? ({} as CreateLiveSessionRequest["singleSelections"]),
      multiSelections: body.multiSelections ?? ({} as CreateLiveSessionRequest["multiSelections"]),
      customPaintHex: body.customPaintHex ?? null,
      environmentId: body.environmentId ?? null,
    };
    const valid = validateState(initial, catalog);
    if (!valid.ok) {
      sendApiError(res, valid.code === "OPTION_VEHICLE_MISMATCH" ? 422 : 400, valid.code, valid.message);
      return;
    }

    const session = liveSessions.create(found.vehicle.slug, catalog, initial, Date.now());
    if (!session) {
      sendApiError(res, 503, "LIVE_SESSIONS_FULL", "Too many live sessions are running. Try again later.");
      return;
    }
    logger.info(
      { sessionId: session.id, vehicleSlug: session.vehicleSlug, sessions: liveSessions.size },
      "[live] created",
    );

    const responseBody: ApiResponse<LiveSessionDto> = {
      data: { sessionId: session.id, vehicleSlug: session.vehicleSlug, participantCount: 0 },
    };
    res.status(201).json(responseBody);
  }),
);

/** Whether a session link still works, and for which vehicle — the join page checks this first. */
liveSessionsRouter.get("/live-sessions/:sessionId", (req, res) => {
  if (!isLiveCollabEnabled()) return disabled(res);
  const session = isSessionId(req.params.sessionId) ? liveSessions.get(req.params.sessionId) : undefined;
  if (!session) {
    sendApiError(res, 404, "LIVE_SESSION_NOT_FOUND", "This live session has ended or never existed.");
    return;
  }
  res.set("Cache-Control", "no-store");
  const responseBody: ApiResponse<LiveSessionDto> = {
    data: {
      sessionId: session.id,
      vehicleSlug: session.vehicleSlug,
      participantCount: liveSessions.participantsOf(session).length,
    },
  };
  res.status(200).json(responseBody);
});

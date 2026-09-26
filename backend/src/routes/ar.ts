import express, { Router, type NextFunction, type Request, type Response } from "express";
import { sendApiError } from "../lib/apiError.js";
import { logger } from "../lib/logger.js";
import { arUploadRateLimit } from "../middleware/rateLimit.js";
import { AR_MODEL_MAX_BYTES, arModelStore, isGlb, resolvePublicBaseUrl } from "../services/ar/modelStore.js";
import type { ApiResponse } from "../types/api.js";
import type { ArModelUploadDto } from "../types/ar.js";

export const arRouter = Router();

const GLB_CONTENT_TYPE = "model/gltf-binary";

/** Checked before the body parser on upload, so a disabled endpoint never buffers up to
 * AR_MODEL_MAX_BYTES just to answer 503. */
function rejectIfArDisabled(_req: Request, res: Response, next: NextFunction) {
  if (!arDisabled(res)) next();
}

function arDisabled(res: Response): boolean {
  if (process.env.AR_ENABLED !== "false") return false;
  sendApiError(res, 503, "AR_DISABLED", "AR preview is temporarily unavailable.");
  return true;
}

/** The URL Scene Viewer downloads from must be absolute and publicly reachable over HTTPS.
 * AR_PUBLIC_BASE_URL sets it explicitly (e.g. behind a proxy/CDN); otherwise it's derived
 * from the request. */
function publicBaseUrl(req: Request): string {
  return resolvePublicBaseUrl(process.env.AR_PUBLIC_BASE_URL, `${req.protocol}://${req.get("host")}`);
}

/**
 * Spec 27, AC-3: short-lived hosting for an AR model the browser exported, because Android's
 * Scene Viewer is a separate app that downloads the model itself. The body is the raw GLB
 * (not JSON), capped at AR_MODEL_MAX_BYTES by its own body parser.
 */
arRouter.post(
  "/ar/models",
  arUploadRateLimit,
  rejectIfArDisabled,
  express.raw({ type: GLB_CONTENT_TYPE, limit: AR_MODEL_MAX_BYTES }),
  (req, res) => {
    const body = req.body as unknown;
    if (!Buffer.isBuffer(body) || !isGlb(body)) {
      logger.warn({ platform: "android", outcome: "rejected" }, "[ar] Upload rejected: not a valid GLB");
      sendApiError(res, 400, "VALIDATION_ERROR", `Body must be a binary glTF 2.0 file sent as ${GLB_CONTENT_TYPE}.`);
      return;
    }

    const { id, expiresAt } = arModelStore.put(body);
    logger.info({ platform: "android", outcome: "success", bytes: body.length }, "[ar] Model uploaded");
    const responseBody: ApiResponse<ArModelUploadDto> = {
      data: { url: `${publicBaseUrl(req)}/api/ar/models/${id}.glb`, expiresAt: expiresAt.toISOString() },
    };
    res.status(201).json(responseBody);
  },
);

arRouter.get("/ar/models/:id.glb", (req, res) => {
  if (arDisabled(res)) return;

  const data = arModelStore.get(req.params.id);
  if (!data) {
    sendApiError(res, 404, "AR_MODEL_NOT_FOUND", "This AR model has expired or never existed.");
    return;
  }
  res.set({
    "Content-Type": GLB_CONTENT_TYPE,
    "Content-Length": String(data.length),
    // Short-lived and user-specific: never cached by a shared cache.
    "Cache-Control": "private, max-age=600",
  });
  res.status(200).end(data);
});

/** An upload over AR_MODEL_MAX_BYTES makes express.raw throw before the handler runs; turn
 * that into this API's error envelope instead of the global handler's generic 500. */
arRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if ((err as { type?: string } | null)?.type === "entity.too.large") {
    logger.warn({ platform: "android", outcome: "too_large" }, "[ar] Upload rejected: too large");
    sendApiError(res, 413, "AR_MODEL_TOO_LARGE", `AR models must be at most ${AR_MODEL_MAX_BYTES / (1024 * 1024)} MB.`);
    return;
  }
  next(err);
});

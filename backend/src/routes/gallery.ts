import express, { Router, type NextFunction, type Request, type Response } from "express";
import { sendApiError } from "../lib/apiError.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { logger } from "../lib/logger.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { likeRateLimit, publishRateLimit } from "../middleware/rateLimit.js";
import {
  CAPTURE_HEIGHT,
  CAPTURE_WIDTH,
  GALLERY_IMAGE_MAX_BYTES,
  getGalleryImage,
  isValidCapturePng,
  listGallery,
  publishConfiguration,
  toggleLike,
  unpublishConfiguration,
} from "../services/gallery.js";
import type { ApiResponse } from "../types/api.js";
import type { GalleryPageDto, LikeToggleDto, PublishStatusDto } from "../types/gallery.js";

export const galleryRouter = Router();

const INVALID_IMAGE_MESSAGE = `The build image must be a ${CAPTURE_WIDTH}×${CAPTURE_HEIGHT} PNG capture, at most ${GALLERY_IMAGE_MAX_BYTES / (1024 * 1024)} MB.`;

/**
 * Spec 31, AC-1: publish the caller's own build. The body is the build's captured PNG (Spec 11),
 * sent by the configurator — validated to be exactly a capture-sized PNG.
 */
galleryRouter.post(
  "/configurations/:publicId/publish",
  publishRateLimit,
  requireAuth,
  express.raw({ type: "image/png", limit: GALLERY_IMAGE_MAX_BYTES }),
  asyncHandler(async (req, res) => {
    const body = req.body as unknown;
    if (!Buffer.isBuffer(body) || !isValidCapturePng(body)) {
      sendApiError(res, 400, "VALIDATION_ERROR", INVALID_IMAGE_MESSAGE, { image: [INVALID_IMAGE_MESSAGE] });
      return;
    }
    const result = await publishConfiguration(req.params.publicId, req.user!.id, body);
    if (!result.ok) {
      sendApiError(res, 404, "CONFIGURATION_NOT_FOUND", "No configuration matches this ID.");
      return;
    }
    logger.info({ publicId: req.params.publicId, bytes: body.length }, "[gallery] Build published");
    res.status(200).json({ data: result.status } satisfies ApiResponse<PublishStatusDto>);
  }),
);

/** Spec 31, AC-6: take the caller's build out of the gallery (likes are kept). */
galleryRouter.post(
  "/configurations/:publicId/unpublish",
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await unpublishConfiguration(req.params.publicId, req.user!.id);
    if (!result.ok) {
      sendApiError(res, 404, "CONFIGURATION_NOT_FOUND", "No configuration matches this ID.");
      return;
    }
    res.status(200).json({ data: result.status } satisfies ApiResponse<PublishStatusDto>);
  }),
);

/** Spec 31, AC-2: the public gallery — no account needed to browse. */
galleryRouter.get(
  "/gallery",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const sort = req.query.sort === undefined ? "recent" : req.query.sort;
    if (sort !== "recent" && sort !== "popular") {
      sendApiError(res, 400, "VALIDATION_ERROR", "sort must be recent or popular.", { sort: ["Must be recent or popular."] });
      return;
    }
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    if (!Number.isInteger(page) || page < 1) {
      sendApiError(res, 400, "VALIDATION_ERROR", "page must be a positive integer.", { page: ["Must be a positive integer."] });
      return;
    }
    const data = await listGallery({ sort, page, viewerId: req.user?.id ?? null });
    res.status(200).json({ data } satisfies ApiResponse<GalleryPageDto>);
  }),
);

/** Spec 31, AC-3/AC-4: toggle the caller's like. Signed-out callers get 401 (the UI prompts sign-in). */
galleryRouter.post(
  "/gallery/:publicId/like",
  likeRateLimit,
  requireAuth,
  asyncHandler(async (req, res) => {
    const result = await toggleLike(req.params.publicId, req.user!.id);
    if (!result.ok) {
      sendApiError(res, 404, "CONFIGURATION_NOT_FOUND", "No published build matches this ID.");
      return;
    }
    res.status(200).json({ data: result.result } satisfies ApiResponse<LikeToggleDto>);
  }),
);

/** A published build's image. The URL carries a hash of the image, so it can be cached forever. */
galleryRouter.get(
  "/gallery/:publicId/image/:hash.png",
  asyncHandler(async (req, res) => {
    if (!/^[0-9a-f]{16}$/.test(req.params.hash)) {
      sendApiError(res, 404, "CONFIGURATION_NOT_FOUND", "No published build image matches.");
      return;
    }
    const image = await getGalleryImage(req.params.publicId, req.params.hash);
    if (!image) {
      sendApiError(res, 404, "CONFIGURATION_NOT_FOUND", "No published build image matches.");
      return;
    }
    res.set({ "Content-Type": "image/png", "Content-Length": String(image.length), "Cache-Control": "public, max-age=31536000, immutable" });
    res.status(200).end(image);
  }),
);

/** An image over the size limit fails in express.raw — answer in this API's error envelope. */
galleryRouter.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
  if ((err as { type?: string } | null)?.type === "entity.too.large") {
    sendApiError(res, 400, "VALIDATION_ERROR", INVALID_IMAGE_MESSAGE, { image: [INVALID_IMAGE_MESSAGE] });
    return;
  }
  next(err);
});

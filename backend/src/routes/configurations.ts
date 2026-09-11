import { Router } from "express";
import { sendApiError } from "../lib/apiError.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { configurationRateLimit } from "../middleware/rateLimit.js";
import {
  claimConfigurationForUser,
  createConfiguration,
  deleteConfigurationForUser,
  getConfigurationByPublicId,
} from "../services/configurations.js";
import { getVehicleWithOptions } from "../services/catalog.js";
import { PricingError } from "../services/pricing.js";
import type { ApiResponse } from "../types/api.js";
import type { SaveConfigurationRequest, SavedConfigurationDto } from "../types/configuration.js";

export const configurationsRouter = Router();

const PRICING_ERROR_STATUS: Record<PricingError["code"], number> = {
  VALIDATION_ERROR: 400,
  OPTION_VEHICLE_MISMATCH: 422,
  DUPLICATE_OPTION_SELECTION: 422,
};

// optionalAuth (Spec 17, AC-6): a signed-in save is owned and never expires; a guest save
// is unchanged. No request/response shape change — driven entirely by the session cookie.
configurationsRouter.post("/configurations", configurationRateLimit, optionalAuth, async (req, res) => {
  const body = req.body as Partial<SaveConfigurationRequest> | undefined;

  if (!body || typeof body.vehicleSlug !== "string" || !body.vehicleSlug) {
    sendApiError(res, 400, "VALIDATION_ERROR", "vehicleSlug is required.");
    return;
  }

  const found = await getVehicleWithOptions(body.vehicleSlug);
  if (!found) {
    sendApiError(res, 404, "VEHICLE_NOT_FOUND", "No vehicle matches this slug.");
    return;
  }

  try {
    const saved = await createConfiguration({
      vehicle: found.vehicle,
      options: found.options,
      singleSelections: body.singleSelections ?? ({} as never),
      multiSelections: body.multiSelections ?? ({} as never),
      customPaintHex: body.customPaintHex ?? null,
      userId: req.user?.id ?? null,
    });

    const responseBody: ApiResponse<SavedConfigurationDto> = { data: saved };
    res.status(201).json(responseBody);
  } catch (err) {
    if (err instanceof PricingError) {
      sendApiError(res, PRICING_ERROR_STATUS[err.code], err.code, err.message);
      return;
    }
    throw err;
  }
});

configurationsRouter.get("/configurations/:publicId", async (req, res) => {
  const saved = await getConfigurationByPublicId(req.params.publicId);

  if (!saved) {
    sendApiError(res, 404, "CONFIGURATION_NOT_FOUND", "No configuration matches this ID.");
    return;
  }

  const responseBody: ApiResponse<SavedConfigurationDto> = { data: saved };
  res.status(200).json(responseBody);
});

// A non-owner deleting/claiming and a nonexistent publicId are indistinguishable to the
// caller (Spec 17's own error-table note) — both resolve to the same 404.
configurationsRouter.delete("/configurations/:publicId", requireAuth, async (req, res) => {
  const result = await deleteConfigurationForUser(req.params.publicId, req.user!.id);

  if (!result.ok) {
    if (result.reason === "HAS_LEADS") {
      sendApiError(
        res,
        409,
        "CONFIGURATION_HAS_LEADS",
        "This build has a quote or test-drive request attached and can't be deleted.",
      );
      return;
    }
    sendApiError(res, 404, "CONFIGURATION_NOT_FOUND", "No configuration matches this ID.");
    return;
  }

  res.status(204).end();
});

configurationsRouter.post("/configurations/:publicId/claim", requireAuth, async (req, res) => {
  const result = await claimConfigurationForUser(req.params.publicId, req.user!.id);

  if (!result.ok) {
    if (result.reason === "NOT_FOUND") {
      sendApiError(res, 404, "CONFIGURATION_NOT_FOUND", "No configuration matches this ID.");
      return;
    }
    sendApiError(res, 409, "ALREADY_CLAIMED", "This build has already been claimed by another account.");
    return;
  }

  const responseBody: ApiResponse<SavedConfigurationDto> = { data: result.dto };
  res.status(200).json(responseBody);
});

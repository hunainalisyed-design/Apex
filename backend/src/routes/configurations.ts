import { Router } from "express";
import { sendApiError } from "../lib/apiError.js";
import { configurationRateLimit } from "../middleware/rateLimit.js";
import { createConfiguration, getConfigurationByPublicId } from "../services/configurations.js";
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

configurationsRouter.post("/configurations", configurationRateLimit, async (req, res) => {
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

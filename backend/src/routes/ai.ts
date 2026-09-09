import { Router } from "express";
import { sendApiError } from "../lib/apiError.js";
import { aiRateLimit } from "../middleware/rateLimit.js";
import { getVehicleWithOptions } from "../services/catalog.js";
import { AiProviderError, configureVehicleWithAi } from "../services/ai/configureVehicle.js";
import { PricingError } from "../services/pricing.js";
import type { ApiResponse } from "../types/api.js";
import type { AiConfigureRequest, AiConfigureResponseDto } from "../types/ai.js";

export const aiRouter = Router();

const AI_PROVIDER_ERROR_MESSAGE = "CarAI is temporarily unavailable. You can continue configuring manually.";

aiRouter.post("/ai/configure", aiRateLimit, async (req, res) => {
  if (process.env.AI_ASSISTANT_ENABLED === "false") {
    sendApiError(res, 503, "AI_ASSISTANT_DISABLED", AI_PROVIDER_ERROR_MESSAGE);
    return;
  }

  const body = req.body as Partial<AiConfigureRequest> | undefined;

  if (!body || typeof body.vehicleSlug !== "string" || !body.vehicleSlug) {
    sendApiError(res, 400, "VALIDATION_ERROR", "vehicleSlug is required.");
    return;
  }
  if (typeof body.message !== "string" || !body.message.trim()) {
    sendApiError(res, 400, "VALIDATION_ERROR", "message is required.");
    return;
  }
  if (!body.currentSelections || typeof body.currentSelections !== "object") {
    sendApiError(res, 400, "VALIDATION_ERROR", "currentSelections is required.");
    return;
  }
  if (body.history !== undefined) {
    if (!Array.isArray(body.history)) {
      sendApiError(res, 400, "VALIDATION_ERROR", "history must be an array.");
      return;
    }
    // The API rejects a first message that isn't role "user" — checked here rather than
    // wasting a paid call on a request that would fail anyway.
    if (body.history.length > 0 && body.history[0]?.role !== "user") {
      sendApiError(res, 400, "VALIDATION_ERROR", "history's first entry must have role \"user\".");
      return;
    }
  }

  const found = await getVehicleWithOptions(body.vehicleSlug);
  if (!found) {
    sendApiError(res, 404, "VEHICLE_NOT_FOUND", "No vehicle matches this slug.");
    return;
  }

  try {
    const result = await configureVehicleWithAi({
      vehicle: found.vehicle,
      options: found.options,
      request: {
        message: body.message,
        history: body.history,
        currentSelections: body.currentSelections,
      },
    });

    const responseBody: ApiResponse<AiConfigureResponseDto> = { data: result };
    res.status(200).json(responseBody);
  } catch (err) {
    if (err instanceof AiProviderError) {
      sendApiError(res, 502, "AI_PROVIDER_ERROR", AI_PROVIDER_ERROR_MESSAGE);
      return;
    }
    if (err instanceof PricingError) {
      sendApiError(res, 400, "VALIDATION_ERROR", err.message);
      return;
    }
    throw err;
  }
});

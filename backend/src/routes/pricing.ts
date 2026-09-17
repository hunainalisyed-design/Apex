import { Router } from "express";
import { sendApiError } from "../lib/apiError.js";
import { logger } from "../lib/logger.js";
import { getVehicleWithOptions, mapOptionToDto } from "../services/catalog.js";
import { calculatePrice, PricingError } from "../services/pricing.js";
import type { ApiResponse } from "../types/api.js";
import type { PriceBreakdownDto, PriceCalculationRequest } from "../types/pricing.js";

export const pricingRouter = Router();

const PRICING_ERROR_STATUS: Record<PricingError["code"], number> = {
  VALIDATION_ERROR: 400,
  OPTION_VEHICLE_MISMATCH: 422,
  DUPLICATE_OPTION_SELECTION: 422,
};

pricingRouter.post("/pricing/calculate", async (req, res) => {
  const body = req.body as Partial<PriceCalculationRequest> | undefined;

  if (!body || typeof body.vehicleSlug !== "string" || !body.vehicleSlug) {
    sendApiError(res, 400, "VALIDATION_ERROR", "vehicleSlug is required.");
    return;
  }

  const found = await getVehicleWithOptions(body.vehicleSlug);
  if (!found) {
    sendApiError(res, 404, "VEHICLE_NOT_FOUND", "No vehicle matches this slug.");
    return;
  }

  // Spec 22 AC-4: every pricing calculation gets one structured log line — latency, outcome,
  // and the vehicle slug only (never the caller's selections, which aren't PII here but
  // aren't useful either — the outcome + PricingError code already say what went wrong).
  const startedAt = Date.now();
  try {
    const breakdown = calculatePrice({
      vehicle: {
        slug: found.vehicle.slug,
        basePriceCents: found.vehicle.basePriceCents,
        currency: found.vehicle.currency,
      },
      options: found.options.map(mapOptionToDto),
      singleSelections: body.singleSelections ?? {},
      multiSelections: body.multiSelections ?? {},
    });

    logger.info(
      { vehicleSlug: found.vehicle.slug, latencyMs: Date.now() - startedAt, outcome: "success" },
      "pricing.calculate",
    );
    const responseBody: ApiResponse<PriceBreakdownDto> = { data: breakdown };
    res.status(200).json(responseBody);
  } catch (err) {
    if (err instanceof PricingError) {
      logger.info(
        {
          vehicleSlug: found.vehicle.slug,
          latencyMs: Date.now() - startedAt,
          outcome: "validation-rejected",
          code: err.code,
        },
        "pricing.calculate",
      );
      sendApiError(res, PRICING_ERROR_STATUS[err.code], err.code, err.message);
      return;
    }
    logger.info(
      { vehicleSlug: found.vehicle.slug, latencyMs: Date.now() - startedAt, outcome: "error" },
      "pricing.calculate",
    );
    throw err;
  }
});

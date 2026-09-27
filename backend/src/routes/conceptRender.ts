import { Router, type NextFunction, type Request, type Response } from "express";
import { sendApiError } from "../lib/apiError.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { conceptRenderDailyLimit, conceptRenderRateLimit } from "../middleware/rateLimit.js";
import { getVehicleWithOptions, mapOptionToDto } from "../services/catalog.js";
import {
  generateConceptImage,
  getImageGenerationProvider,
  ImageProviderError,
  isConceptRendersEnabled,
  takeDailySlot,
} from "../services/imageGeneration/index.js";
import { buildConceptPrompt } from "../services/imageGeneration/buildConceptPrompt.js";
import { calculatePrice, PricingError } from "../services/pricing.js";
import type { ApiResponse } from "../types/api.js";
import type { ConceptRenderDto, ConceptRenderRequest } from "../types/conceptRender.js";

export const conceptRenderRouter = Router();

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const CUSTOM_PAINT_ASSET_REF = "paint-custom";
const PRICING_ERROR_STATUS: Record<PricingError["code"], number> = {
  VALIDATION_ERROR: 400,
  OPTION_VEHICLE_MISMATCH: 422,
  DUPLICATE_OPTION_SELECTION: 422,
};

/** Checked before the rate limits, so requests while it's off never count against anyone. */
function requireEnabled(_req: Request, res: Response, next: NextFunction) {
  if (!isConceptRendersEnabled() || !getImageGenerationProvider()) {
    sendApiError(res, 503, "CONCEPT_RENDERS_DISABLED", "Concept renders aren't available right now.");
    return;
  }
  next();
}

/**
 * "Imagine the Ultimate Version" (Spec 35): an AI concept image of a more extreme take on the
 * user's build — inspiration only, never a buildable configuration. The build is validated like a
 * save; the prompt is made from catalog names alone. Rate-limited per IP per minute and per day,
 * plus a site-wide daily cap (AC-5, Risk #2), because every call costs money.
 */
conceptRenderRouter.post(
  "/ai/concept-render",
  requireEnabled,
  conceptRenderRateLimit,
  conceptRenderDailyLimit,
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Partial<ConceptRenderRequest>;
    if (typeof body.vehicleSlug !== "string" || !body.vehicleSlug) {
      sendApiError(res, 400, "VALIDATION_ERROR", "vehicleSlug is required.", { vehicleSlug: ["Required."] });
      return;
    }
    const customPaintHex = body.customPaintHex ?? null;
    if (customPaintHex !== null && (typeof customPaintHex !== "string" || !HEX_COLOR.test(customPaintHex))) {
      sendApiError(res, 400, "VALIDATION_ERROR", "customPaintHex must be a #rrggbb color or null.", {
        customPaintHex: ["Must be a #rrggbb color."],
      });
      return;
    }

    const found = await getVehicleWithOptions(body.vehicleSlug);
    if (!found) {
      sendApiError(res, 404, "VEHICLE_NOT_FOUND", "No vehicle matches this slug.");
      return;
    }

    let breakdown;
    try {
      breakdown = calculatePrice({
        vehicle: { slug: found.vehicle.slug, basePriceCents: found.vehicle.basePriceCents, currency: found.vehicle.currency },
        options: found.options.map(mapOptionToDto),
        singleSelections: body.singleSelections ?? {},
        multiSelections: body.multiSelections ?? {},
      });
    } catch (err) {
      if (err instanceof PricingError) {
        sendApiError(res, PRICING_ERROR_STATUS[err.code], err.code, err.message);
        return;
      }
      throw err;
    }
    const paint = found.options.find((o) => o.id === body.singleSelections?.PAINT);
    if (customPaintHex !== null && paint?.assetRef !== CUSTOM_PAINT_ASSET_REF) {
      sendApiError(res, 400, "VALIDATION_ERROR", "A custom color needs the Custom Color paint.", {
        customPaintHex: ["Only with the Custom Color paint."],
      });
      return;
    }

    if (!takeDailySlot()) {
      sendApiError(res, 429, "CONCEPT_RENDER_DAILY_LIMIT", "Today's concept renders are used up. Try again tomorrow.");
      return;
    }

    const provider = getImageGenerationProvider()!;
    const prompt = buildConceptPrompt(found.vehicle.name, breakdown.lineItems, customPaintHex);
    try {
      const imageUrl = await generateConceptImage(provider, prompt, { vehicleSlug: found.vehicle.slug });
      const responseBody: ApiResponse<ConceptRenderDto> = { data: { imageUrl, isPlaceholder: provider.isPlaceholder } };
      res.status(200).json(responseBody);
    } catch (err) {
      if (err instanceof ImageProviderError) {
        sendApiError(res, 502, "IMAGE_PROVIDER_ERROR", "Couldn't generate a concept right now. Try again.");
        return;
      }
      throw err;
    }
  }),
);

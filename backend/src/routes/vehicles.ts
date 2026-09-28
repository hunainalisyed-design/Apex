import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { sendApiError } from "../lib/apiError.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import {
  getVehicleWithOptions,
  mapOptionToDto,
  mapVehicleToDetailDto,
  mapVehicleToSummaryDto,
} from "../services/catalog.js";
import { getComboRarity } from "../services/comboRarity.js";
import type { ApiResponse } from "../types/api.js";
import type { ComboRarityDto } from "../types/comboRarity.js";
import type { CustomizationOptionDto, VehicleDetailDto, VehicleSummaryDto } from "../types/catalog.js";

export const vehiclesRouter = Router();

vehiclesRouter.get(
  "/vehicles",
  asyncHandler(async (_req, res) => {
    const vehicles = await prisma.vehicle.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });

    const body: ApiResponse<VehicleSummaryDto[]> = {
      data: vehicles.map(mapVehicleToSummaryDto),
    };
    res.status(200).json(body);
  }),
);

vehiclesRouter.get(
  "/vehicles/:slug",
  asyncHandler(async (req, res) => {
    const found = await getVehicleWithOptions(req.params.slug);

    if (!found) {
      sendApiError(res, 404, "VEHICLE_NOT_FOUND", "No vehicle matches this slug.");
      return;
    }

    const body: ApiResponse<VehicleDetailDto> = {
      data: mapVehicleToDetailDto(found.vehicle, found.options),
    };
    res.status(200).json(body);
  }),
);

vehiclesRouter.get(
  "/vehicles/:slug/options",
  asyncHandler(async (req, res) => {
    const found = await getVehicleWithOptions(req.params.slug);

    if (!found) {
      sendApiError(res, 404, "VEHICLE_NOT_FOUND", "No vehicle matches this slug.");
      return;
    }

    const body: ApiResponse<CustomizationOptionDto[]> = {
      data: found.options.map(mapOptionToDto),
    };
    res.status(200).json(body);
  }),
);

/** Publicly shareable build IDs are short (e.g. APEX-7F82-K91X) — anything longer is not one. */
const MAX_BUILD_ID_LENGTH = 32;

/**
 * Spec 32: the cached paint + wheels rarity for a vehicle — rare pairs only — plus whether
 * `?build=` was the first saved build with its pair. Computed hourly, never per request, so
 * it's cheap and safely cacheable for a few minutes.
 */
vehiclesRouter.get(
  "/vehicles/:slug/combo-rarity",
  asyncHandler(async (req, res) => {
    const build = req.query.build;
    if (build !== undefined && (typeof build !== "string" || build.length === 0 || build.length > MAX_BUILD_ID_LENGTH)) {
      sendApiError(res, 400, "VALIDATION_ERROR", "Invalid build ID.", { build: ["Must be a build ID."] });
      return;
    }

    const rarity = await getComboRarity(req.params.slug, build);
    if (!rarity) {
      sendApiError(res, 404, "VEHICLE_NOT_FOUND", "No vehicle matches this slug.");
      return;
    }

    res.set("Cache-Control", "public, max-age=300");
    const body: ApiResponse<ComboRarityDto> = { data: rarity };
    res.status(200).json(body);
  }),
);

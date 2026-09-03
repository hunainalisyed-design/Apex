import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { sendApiError } from "../lib/apiError.js";
import {
  getVehicleWithOptions,
  mapOptionToDto,
  mapVehicleToDetailDto,
  mapVehicleToSummaryDto,
} from "../services/catalog.js";
import type { ApiResponse } from "../types/api.js";
import type { CustomizationOptionDto, VehicleDetailDto, VehicleSummaryDto } from "../types/catalog.js";

export const vehiclesRouter = Router();

vehiclesRouter.get("/vehicles", async (_req, res) => {
  const vehicles = await prisma.vehicle.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });

  const body: ApiResponse<VehicleSummaryDto[]> = {
    data: vehicles.map(mapVehicleToSummaryDto),
  };
  res.status(200).json(body);
});

vehiclesRouter.get("/vehicles/:slug", async (req, res) => {
  const found = await getVehicleWithOptions(req.params.slug);

  if (!found) {
    sendApiError(res, 404, "VEHICLE_NOT_FOUND", "No vehicle matches this slug.");
    return;
  }

  const body: ApiResponse<VehicleDetailDto> = {
    data: mapVehicleToDetailDto(found.vehicle, found.options),
  };
  res.status(200).json(body);
});

vehiclesRouter.get("/vehicles/:slug/options", async (req, res) => {
  const found = await getVehicleWithOptions(req.params.slug);

  if (!found) {
    sendApiError(res, 404, "VEHICLE_NOT_FOUND", "No vehicle matches this slug.");
    return;
  }

  const body: ApiResponse<CustomizationOptionDto[]> = {
    data: found.options.map(mapOptionToDto),
  };
  res.status(200).json(body);
});

import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { sendApiError } from "../lib/apiError.js";
import { mapOptionToDto, mapVehicleToDetailDto, mapVehicleToSummaryDto } from "../services/catalog.js";
import type { ApiResponse } from "../types/api.js";
import type { CustomizationOptionDto, VehicleDetailDto, VehicleSummaryDto } from "../types/catalog.js";

export const vehiclesRouter = Router();

async function findActiveVehicleWithOptions(slug: string) {
  const vehicle = await prisma.vehicle.findFirst({
    where: { slug, isActive: true },
  });

  if (!vehicle) {
    return null;
  }

  const options = await prisma.customizationOption.findMany({
    where: { vehicleId: vehicle.id },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  return { vehicle, options };
}

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
  const found = await findActiveVehicleWithOptions(req.params.slug);

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
  const found = await findActiveVehicleWithOptions(req.params.slug);

  if (!found) {
    sendApiError(res, 404, "VEHICLE_NOT_FOUND", "No vehicle matches this slug.");
    return;
  }

  const body: ApiResponse<CustomizationOptionDto[]> = {
    data: found.options.map(mapOptionToDto),
  };
  res.status(200).json(body);
});

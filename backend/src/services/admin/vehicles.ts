import { Prisma, type Vehicle } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { mapVehicleToSummaryDto } from "../catalog.js";
import { parsePagination } from "./pagination.js";
import type { CreateVehicleRequest, PaginationQuery, UpdateVehicleRequest, VehicleAdminDto } from "../../types/admin.js";

function mapVehicleToAdminDto(vehicle: Vehicle): VehicleAdminDto {
  return {
    ...mapVehicleToSummaryDto(vehicle),
    id: vehicle.id,
    heroModelUrl: vehicle.heroModelUrl,
    showroomModelUrl: vehicle.showroomModelUrl,
    isActive: vehicle.isActive,
  };
}

/** Unlike GET /vehicles (public, isActive:true only), the admin list shows every vehicle so
 * a deactivated one can be found and reactivated. */
export async function listVehicles(pagination: PaginationQuery): Promise<VehicleAdminDto[]> {
  const { skip, take } = parsePagination(pagination);
  const vehicles = await prisma.vehicle.findMany({ orderBy: { createdAt: "asc" }, skip, take });
  return vehicles.map(mapVehicleToAdminDto);
}

export type CreateVehicleResult =
  | { ok: true; vehicle: VehicleAdminDto }
  | { ok: false; reason: "SLUG_TAKEN" };

export async function createVehicle(input: CreateVehicleRequest): Promise<CreateVehicleResult> {
  try {
    const vehicle = await prisma.vehicle.create({ data: input });
    return { ok: true, vehicle: mapVehicleToAdminDto(vehicle) };
  } catch (err) {
    const isSlugCollision =
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002" &&
      (err.meta?.target as string[] | undefined)?.includes("slug");
    if (isSlugCollision) return { ok: false, reason: "SLUG_TAKEN" };
    throw err;
  }
}

export type UpdateVehicleResult = { ok: true; vehicle: VehicleAdminDto } | { ok: false; reason: "NOT_FOUND" };

/** `input.isActive: false` is this app's only "deactivate a vehicle" action (AC-2) — there's
 * no separate deactivate endpoint, matching CustomizationOption's own soft-delete shape. */
export async function updateVehicle(id: string, input: UpdateVehicleRequest): Promise<UpdateVehicleResult> {
  const existing = await prisma.vehicle.findUnique({ where: { id } });
  if (!existing) return { ok: false, reason: "NOT_FOUND" };

  const vehicle = await prisma.vehicle.update({ where: { id }, data: input });
  return { ok: true, vehicle: mapVehicleToAdminDto(vehicle) };
}

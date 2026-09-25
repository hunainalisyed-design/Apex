import { Prisma, type Vehicle } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { mapVehicleToSummaryDto } from "../catalog.js";
import { diffAssetUrls, type AssetUrlChange } from "../assets/changes.js";
import { VEHICLE_ASSET_FIELDS, validateVehicleAssetUrls } from "../assets/versioning.js";
import { parsePagination } from "./pagination.js";
import type { CreateVehicleRequest, PaginationQuery, UpdateVehicleRequest, VehicleAdminDto } from "../../types/admin.js";

function mapVehicleToAdminDto(vehicle: Vehicle): VehicleAdminDto {
  return {
    ...mapVehicleToSummaryDto(vehicle),
    id: vehicle.id,
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
  | { ok: false; reason: "SLUG_TAKEN" }
  | { ok: false; reason: "UNVERSIONED_ASSET"; errors: Record<string, string[]> };

export async function createVehicle(input: CreateVehicleRequest): Promise<CreateVehicleResult> {
  // Spec 25, AC-1: every asset URL on a new vehicle must be content-addressed.
  const assetErrors = validateVehicleAssetUrls(input, null);
  if (Object.keys(assetErrors).length > 0) return { ok: false, reason: "UNVERSIONED_ASSET", errors: assetErrors };

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

export type UpdateVehicleResult =
  | { ok: true; vehicle: VehicleAdminDto; assetChanges: AssetUrlChange[] }
  | { ok: false; reason: "NOT_FOUND" }
  | { ok: false; reason: "UNVERSIONED_ASSET"; errors: Record<string, string[]> };

/** `input.isActive: false` is this app's only "deactivate a vehicle" action (AC-2) — there's
 * no separate deactivate endpoint, matching CustomizationOption's own soft-delete shape. */
export async function updateVehicle(id: string, input: UpdateVehicleRequest): Promise<UpdateVehicleResult> {
  const existing = await prisma.vehicle.findUnique({ where: { id } });
  if (!existing) return { ok: false, reason: "NOT_FOUND" };

  // Spec 25, AC-2: a changed asset URL must be a new versioned URL. Only the row's pointer
  // is rewritten here — the old file is never touched, so the old URL stays resolvable.
  const assetErrors = validateVehicleAssetUrls(input, existing);
  if (Object.keys(assetErrors).length > 0) return { ok: false, reason: "UNVERSIONED_ASSET", errors: assetErrors };

  const vehicle = await prisma.vehicle.update({ where: { id }, data: input });
  return {
    ok: true,
    vehicle: mapVehicleToAdminDto(vehicle),
    assetChanges: diffAssetUrls(existing, input, VEHICLE_ASSET_FIELDS),
  };
}

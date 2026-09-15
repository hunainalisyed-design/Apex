import type { ApplyMode, CustomizationOptionDto, OptionCategory, VehicleSummaryDto } from "./catalog.js";

export interface CreateVehicleRequest {
  slug: string;
  name: string;
  tagline: string;
  basePriceCents: number;
  currency: string;
  horsepower: number;
  topSpeedKph: number;
  zeroToHundredSec: number;
  heroModelUrl: string;
  showroomModelUrl: string;
  thumbnailUrl: string;
  fallbackImageUrl: string;
}

/** Every field optional — a partial update. `isActive:false` here *is* the "deactivate a
 * vehicle" action (AC-2); there's no separate deactivate endpoint. */
export interface UpdateVehicleRequest {
  name?: string;
  tagline?: string;
  basePriceCents?: number;
  currency?: string;
  horsepower?: number;
  topSpeedKph?: number;
  zeroToHundredSec?: number;
  heroModelUrl?: string;
  showroomModelUrl?: string;
  thumbnailUrl?: string;
  fallbackImageUrl?: string;
  isActive?: boolean;
}

export interface CreateOptionRequest {
  category: OptionCategory;
  name: string;
  description: string | null;
  priceDeltaCents: number;
  assetRef: string;
  swatchColor: string | null;
  applyMode: ApplyMode;
  isDefault: boolean;
  sortOrder?: number;
}

/** Category is deliberately not editable here — moving an existing option to a different
 * category post-creation would silently change which single-select group it competes in for
 * the isDefault invariant; create a new option in the right category instead. */
export interface UpdateOptionRequest {
  name?: string;
  description?: string | null;
  priceDeltaCents?: number;
  assetRef?: string;
  swatchColor?: string | null;
  applyMode?: ApplyMode;
  isDefault?: boolean;
  sortOrder?: number;
  isActive?: boolean;
}

/** The admin catalog view needs to see (and toggle) deactivated options, unlike the public
 * CustomizationOptionDto (services/catalog.ts filters those out entirely before mapping). */
export interface OptionAdminDto extends CustomizationOptionDto {
  isActive: boolean;
}

/** Same reasoning as OptionAdminDto: the admin vehicle list needs to see (and reactivate)
 * deactivated vehicles, unlike the public VehicleSummaryDto (GET /vehicles filters those out
 * entirely). Also carries `id` (the public API only ever addresses a vehicle by its slug,
 * but the admin write endpoints require it) and heroModelUrl/showroomModelUrl (present on
 * VehicleDetailDto but not VehicleSummaryDto — an edit form needs to show and default them,
 * not just the public-facing summary fields). */
export interface VehicleAdminDto extends VehicleSummaryDto {
  id: string;
  heroModelUrl: string;
  showroomModelUrl: string;
  isActive: boolean;
}

export interface UpdateLeadStatusRequest {
  status: "CONTACTED" | "CLOSED";
}

/** Matches the shape of Express's req.query (qs.ParsedQs) loosely enough to accept it
 * directly without a cast at every call site — values are coerced defensively in
 * parsePagination regardless of their actual runtime type. */
export interface PaginationQuery {
  page?: unknown;
  pageSize?: unknown;
}

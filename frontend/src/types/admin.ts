import type { ApplyMode, CustomizationOptionDto, OptionCategory, VehicleSummaryDto } from "./catalog";

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

/** Every field optional — a partial update. `isActive:false` is this app's only "deactivate
 * a vehicle" action (AC-2); there's no separate deactivate endpoint. */
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

/** Category is deliberately not editable — moving an option to a different category
 * post-creation would silently change which single-select group it competes in. */
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

/** The admin catalog view needs to see (and toggle) deactivated options/vehicles, unlike the
 * public DTOs (the public catalog endpoints filter those out entirely). */
export interface OptionAdminDto extends CustomizationOptionDto {
  isActive: boolean;
}

/** Also carries `id` (the public API only ever addresses a vehicle by its slug, but the
 * admin write endpoints require it) and heroModelUrl/showroomModelUrl (present on
 * VehicleDetailDto but not VehicleSummaryDto — the edit form needs to show and default
 * them). */
export interface VehicleAdminDto extends VehicleSummaryDto {
  id: string;
  heroModelUrl: string;
  showroomModelUrl: string;
  isActive: boolean;
}

export interface UpdateLeadStatusRequest {
  status: "CONTACTED" | "CLOSED";
}

export type OptionCategory =
  // Exterior — SRS §7, one-at-a-time choices, each with an explicit default
  | "PAINT" // §7 Paint Options
  | "WHEELS" // §7 / §8 Wheel Customization
  | "BRAKE_CALIPER" // §7 / §9 Brake Calipers
  | "WINDOW_TINT" // §7 Window tint
  | "SPOILER" // §7 Spoiler (a "Carbon Spoiler" variant lives here, not in ACCESSORY)
  | "FRONT_ACCESSORY" // §7 Front accessories
  | "REAR_ACCESSORY" // §7 Rear accessories
  | "BODY_PACKAGE" // §7 Body package
  | "CARBON_COMPONENT" // §7 Carbon components (trim tier, e.g. None / Exterior Pack / Full Pack)

  // Interior — SRS §10, one-at-a-time choices per surface, each with an explicit default
  | "INTERIOR_MATERIAL" // §10 general finish/grade (e.g. Standard vs. Premium leather vs. Alcantara)
  | "INTERIOR_LIGHTING" // §10 Interior lighting color
  | "INTERIOR_SEATS" // §10 Seats color/trim
  | "INTERIOR_DASHBOARD" // §10 Dashboard color/trim
  | "INTERIOR_STEERING_WHEEL" // §10 Steering wheel color/trim
  | "INTERIOR_DOOR_PANELS" // §10 Door panels color/trim
  | "INTERIOR_FLOOR" // §10 Floor/carpet color/trim

  // Cross-cutting — SRS §11 / §12, zero-or-more independent add-ons, no default required
  | "ACCESSORY" // §11 free-standing accessories (e.g. sport exhaust, premium lighting)
  | "PACKAGE"; // §12 bundled option packages (e.g. Sport Package, Performance Package)

export const ALL_CATEGORIES: OptionCategory[] = [
  "PAINT",
  "WHEELS",
  "BRAKE_CALIPER",
  "WINDOW_TINT",
  "SPOILER",
  "FRONT_ACCESSORY",
  "REAR_ACCESSORY",
  "BODY_PACKAGE",
  "CARBON_COMPONENT",
  "INTERIOR_MATERIAL",
  "INTERIOR_LIGHTING",
  "INTERIOR_SEATS",
  "INTERIOR_DASHBOARD",
  "INTERIOR_STEERING_WHEEL",
  "INTERIOR_DOOR_PANELS",
  "INTERIOR_FLOOR",
  "ACCESSORY",
  "PACKAGE",
];

/** Exactly one selected option per vehicle per category; every row in these categories must include
 * an explicit default (a "None"/"Standard" option is a valid, priced default where the item is
 * optional in the real world). */
export const SINGLE_SELECT_CATEGORIES = [
  "PAINT",
  "WHEELS",
  "BRAKE_CALIPER",
  "WINDOW_TINT",
  "SPOILER",
  "FRONT_ACCESSORY",
  "REAR_ACCESSORY",
  "BODY_PACKAGE",
  "CARBON_COMPONENT",
  "INTERIOR_MATERIAL",
  "INTERIOR_LIGHTING",
  "INTERIOR_SEATS",
  "INTERIOR_DASHBOARD",
  "INTERIOR_STEERING_WHEEL",
  "INTERIOR_DOOR_PANELS",
  "INTERIOR_FLOOR",
] as const satisfies readonly OptionCategory[];

/** Zero or more selected options per vehicle per category; no default required. */
export const MULTI_SELECT_CATEGORIES = ["ACCESSORY", "PACKAGE"] as const satisfies readonly OptionCategory[];

/** How a selected option's assetRef should be applied to the 3D scene (Spec 6/8). */
export type ApplyMode = "MATERIAL_SWAP" | "MESH_VARIANT_SWAP" | "MESH_VISIBILITY";

export interface VehicleSummaryDto {
  slug: string;
  name: string;
  tagline: string;
  basePriceCents: number;
  currency: string; // ISO 4217, e.g. "EUR"
  horsepower: number;
  topSpeedKph: number;
  zeroToHundredSec: number;
  thumbnailUrl: string;
  fallbackImageUrl: string; // shown by <Static3DFallback> when WebGL is unavailable (Spec 12)
}

export interface VehicleDetailDto extends VehicleSummaryDto {
  heroModelUrl: string; // GLB used on the landing page hero
  showroomModelUrl: string; // GLB used in the 3D showroom
  options: Record<OptionCategory, CustomizationOptionDto[]>;
}

export interface CustomizationOptionDto {
  id: string;
  category: OptionCategory;
  name: string;
  description: string | null;
  priceDeltaCents: number;
  assetRef: string; // material name / GLB mesh variant key / hex color, interpreted by the 3D layer
  swatchColor: string | null; // hex, for the UI swatch — independent of assetRef
  applyMode: ApplyMode;
  isDefault: boolean;
  sortOrder: number;
}

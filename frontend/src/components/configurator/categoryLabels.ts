import type { OptionCategory } from "@/types/catalog";

/** Human-readable label per category, used for both the visible group heading and the
 * swatch aria-label (Spec 6/7/8). Shared across ExteriorPanel, InteriorPanel, and
 * AccessoriesPanel rather than each maintaining its own copy. */
export const CATEGORY_LABELS: Record<OptionCategory, string> = {
  PAINT: "Paint",
  WHEELS: "Wheels",
  BRAKE_CALIPER: "Brake Calipers",
  WINDOW_TINT: "Window Tint",
  SPOILER: "Spoiler",
  FRONT_ACCESSORY: "Front Accessory",
  REAR_ACCESSORY: "Rear Accessory",
  BODY_PACKAGE: "Body Package",
  CARBON_COMPONENT: "Carbon Components",
  INTERIOR_MATERIAL: "Overall Finish",
  INTERIOR_LIGHTING: "Interior Lighting",
  INTERIOR_SEATS: "Seats",
  INTERIOR_DASHBOARD: "Dashboard",
  INTERIOR_STEERING_WHEEL: "Steering Wheel",
  INTERIOR_DOOR_PANELS: "Door Panels",
  INTERIOR_FLOOR: "Floor",
  ACCESSORY: "Accessories",
  PACKAGE: "Packages",
};

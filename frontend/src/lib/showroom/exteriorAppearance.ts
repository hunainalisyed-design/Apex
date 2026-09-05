import { resolveAppearance } from "./applyModeDispatch";
import { findSelectedOption } from "./selectedOption";
import type { CustomizationOptionDto, VehicleDetailDto } from "@/types/catalog";
import type { SingleSelectCategory } from "@/types/pricing";

export interface ExteriorAppearance {
  paintColor: string;
  brakeCaliperColor: string;
  windowTintOpacity: number;
  wheelStyle: string;
  spoilerVisible: boolean;
  spoilerColor: string;
  frontAccessoryVisible: boolean;
  rearAccessoryVisible: boolean;
  bodyPackageVisible: boolean;
  carbonComponentVisible: boolean;
}

export const DEFAULT_EXTERIOR_APPEARANCE: ExteriorAppearance = {
  paintColor: "#d4d4d8",
  brakeCaliperColor: "#111111",
  windowTintOpacity: 0.15,
  wheelStyle: "wheel-standard",
  spoilerVisible: false,
  spoilerColor: "#d4d4d8",
  frontAccessoryVisible: false,
  rearAccessoryVisible: false,
  bodyPackageVisible: false,
  carbonComponentVisible: false,
};

function tintOpacityFor(option: CustomizationOptionDto | undefined): number {
  if (!option) return DEFAULT_EXTERIOR_APPEARANCE.windowTintOpacity;
  if (option.assetRef.includes("dark")) return 0.65;
  if (option.assetRef.includes("light")) return 0.35;
  return 0.15; // "none"
}

/**
 * Walks all nine exterior categories through resolveAppearance and produces the concrete
 * prop bundle PlaceholderShowroomRig needs. customPaintHex (live from the color picker or
 * a saved custom build) always overrides the catalog paint swatch when set.
 */
export function resolveExteriorAppearance(
  vehicle: VehicleDetailDto,
  singleSelections: Record<SingleSelectCategory, string>,
  customPaintHex: string | null,
): ExteriorAppearance {
  const paint = findSelectedOption(vehicle, "PAINT", singleSelections.PAINT);
  const wheels = findSelectedOption(vehicle, "WHEELS", singleSelections.WHEELS);
  const brake = findSelectedOption(vehicle, "BRAKE_CALIPER", singleSelections.BRAKE_CALIPER);
  const tint = findSelectedOption(vehicle, "WINDOW_TINT", singleSelections.WINDOW_TINT);
  const spoiler = findSelectedOption(vehicle, "SPOILER", singleSelections.SPOILER);
  const front = findSelectedOption(vehicle, "FRONT_ACCESSORY", singleSelections.FRONT_ACCESSORY);
  const rear = findSelectedOption(vehicle, "REAR_ACCESSORY", singleSelections.REAR_ACCESSORY);
  const body = findSelectedOption(vehicle, "BODY_PACKAGE", singleSelections.BODY_PACKAGE);
  const carbon = findSelectedOption(vehicle, "CARBON_COMPONENT", singleSelections.CARBON_COMPONENT);

  const paintAppearance = paint ? resolveAppearance(paint) : null;
  const paintColor =
    customPaintHex ??
    (paintAppearance?.kind === "material"
      ? paintAppearance.color
      : DEFAULT_EXTERIOR_APPEARANCE.paintColor);

  const brakeAppearance = brake ? resolveAppearance(brake) : null;
  const brakeCaliperColor =
    brakeAppearance?.kind === "material"
      ? brakeAppearance.color
      : DEFAULT_EXTERIOR_APPEARANCE.brakeCaliperColor;

  const wheelsAppearance = wheels ? resolveAppearance(wheels) : null;
  const wheelStyle =
    wheelsAppearance?.kind === "variant" ? wheelsAppearance.variant : DEFAULT_EXTERIOR_APPEARANCE.wheelStyle;

  const spoilerAppearance = spoiler ? resolveAppearance(spoiler) : null;
  const frontAppearance = front ? resolveAppearance(front) : null;
  const rearAppearance = rear ? resolveAppearance(rear) : null;
  const bodyAppearance = body ? resolveAppearance(body) : null;
  const carbonAppearance = carbon ? resolveAppearance(carbon) : null;

  return {
    paintColor,
    brakeCaliperColor,
    windowTintOpacity: tintOpacityFor(tint),
    wheelStyle,
    spoilerVisible:
      spoilerAppearance?.kind === "visibility"
        ? spoilerAppearance.visible
        : DEFAULT_EXTERIOR_APPEARANCE.spoilerVisible,
    spoilerColor:
      (spoilerAppearance?.kind === "visibility" && spoilerAppearance.color) ||
      DEFAULT_EXTERIOR_APPEARANCE.spoilerColor,
    frontAccessoryVisible:
      frontAppearance?.kind === "visibility"
        ? frontAppearance.visible
        : DEFAULT_EXTERIOR_APPEARANCE.frontAccessoryVisible,
    rearAccessoryVisible:
      rearAppearance?.kind === "visibility"
        ? rearAppearance.visible
        : DEFAULT_EXTERIOR_APPEARANCE.rearAccessoryVisible,
    bodyPackageVisible:
      bodyAppearance?.kind === "visibility"
        ? bodyAppearance.visible
        : DEFAULT_EXTERIOR_APPEARANCE.bodyPackageVisible,
    carbonComponentVisible:
      carbonAppearance?.kind === "visibility"
        ? carbonAppearance.visible
        : DEFAULT_EXTERIOR_APPEARANCE.carbonComponentVisible,
  };
}

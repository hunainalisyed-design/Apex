import { resolveAppearance } from "./applyModeDispatch";
import type { CustomizationOptionDto, VehicleDetailDto } from "@/types/catalog";
import type { MultiSelectCategory } from "@/types/pricing";

export interface AccessoryAppearance {
  roofColor: string;
  mirrorCapsColor: string;
  exhaustTipVisible: boolean;
}

const DEFAULT_PAINT_COLOR = "#d4d4d8"; // matches exteriorAppearance's own default

export const DEFAULT_ACCESSORY_APPEARANCE: AccessoryAppearance = {
  roofColor: DEFAULT_PAINT_COLOR,
  mirrorCapsColor: DEFAULT_PAINT_COLOR,
  exhaustTipVisible: false,
};

// Only accessories with an obvious, cheap physical representation get a mesh mapping.
// "Premium Lighting Package", "Performance Package", and "Special Interior Package" are
// deliberately absent — AC-6 requires them to still price correctly while warning in dev,
// not have a visual fabricated for them.
const ACCESSORY_MESH_MAP: Record<string, "roof" | "mirror_caps" | "exhaust_tip"> = {
  "accessory-carbon-roof": "roof",
  "accessory-carbon-mirror-caps": "mirror_caps",
  "accessory-sport-exhaust": "exhaust_tip",
};

function warnMissingMapping(option: CustomizationOptionDto) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      `[accessoryAppearance] "${option.name}" (${option.assetRef}) has no 3D asset mapping yet — pricing and the summary still apply, but no visual change occurs (AC-6).`,
    );
  }
}

function collectActiveOptions(
  vehicle: VehicleDetailDto,
  multiSelections: Record<MultiSelectCategory, string[]>,
  categories: MultiSelectCategory[],
): CustomizationOptionDto[] {
  const active: CustomizationOptionDto[] = [];
  for (const category of categories) {
    const options = vehicle.options[category] ?? [];
    for (const id of multiSelections[category] ?? []) {
      const option = options.find((o) => o.id === id);
      if (option) active.push(option);
    }
  }
  return active;
}

/**
 * Resolves every active ACCESSORY/PACKAGE selection into the placeholder rig's visual
 * state. Mirror caps and the roof default to whatever paint is currently selected (AC-3 —
 * never a hardcoded color) and switch to carbon when their accessory is active; the
 * exhaust tip is hidden until Sport Exhaust is active (AC-2). Anything without a mesh
 * mapping is skipped with a dev warning (AC-6) rather than getting a fabricated visual.
 */
export function resolveAccessoryAppearance(
  vehicle: VehicleDetailDto,
  multiSelections: Record<MultiSelectCategory, string[]>,
  paintColor: string,
): AccessoryAppearance {
  const active = collectActiveOptions(vehicle, multiSelections, ["ACCESSORY", "PACKAGE"]);

  const result: AccessoryAppearance = {
    roofColor: paintColor,
    mirrorCapsColor: paintColor,
    exhaustTipVisible: false,
  };

  for (const option of active) {
    const target = ACCESSORY_MESH_MAP[option.assetRef];
    if (!target) {
      warnMissingMapping(option);
      continue;
    }

    const appearance = resolveAppearance(option);
    if (target === "roof" && appearance.kind === "material") {
      result.roofColor = appearance.color;
    } else if (target === "mirror_caps" && appearance.kind === "material") {
      result.mirrorCapsColor = appearance.color;
    } else if (target === "exhaust_tip" && appearance.kind === "visibility") {
      result.exhaustTipVisible = appearance.visible;
    }
  }

  return result;
}

import { composeInteriorMaterial, type ThreeMaterialParams } from "./interiorMaterial";
import { findSelectedOption } from "./selectedOption";
import type { VehicleDetailDto } from "@/types/catalog";
import type { SingleSelectCategory } from "@/types/pricing";

export interface InteriorAppearance {
  seat: ThreeMaterialParams;
  dashboard: ThreeMaterialParams;
  steeringWheel: ThreeMaterialParams;
  doorPanel: ThreeMaterialParams;
  floor: ThreeMaterialParams;
  lightingColor: string;
}

const DEFAULT_SURFACE_COLOR = "#111111";
const DEFAULT_LIGHTING_COLOR = "#f5f5f5";
const DEFAULT_GRADE_ASSET_REF = "interior-material-standard-cloth";

const DEFAULT_SURFACE_MATERIAL = composeInteriorMaterial(DEFAULT_GRADE_ASSET_REF, DEFAULT_SURFACE_COLOR);

export const DEFAULT_INTERIOR_APPEARANCE: InteriorAppearance = {
  seat: DEFAULT_SURFACE_MATERIAL,
  dashboard: DEFAULT_SURFACE_MATERIAL,
  steeringWheel: DEFAULT_SURFACE_MATERIAL,
  doorPanel: DEFAULT_SURFACE_MATERIAL,
  floor: DEFAULT_SURFACE_MATERIAL,
  lightingColor: DEFAULT_LIGHTING_COLOR,
};

/**
 * Walks all seven interior categories: one shared grade (INTERIOR_MATERIAL) composed with
 * each of the five per-surface colors (five composeInteriorMaterial call sites, per the
 * spec), plus INTERIOR_LIGHTING resolved independently for the ambient light/emissive trim.
 */
export function resolveInteriorAppearance(
  vehicle: VehicleDetailDto,
  singleSelections: Record<SingleSelectCategory, string>,
): InteriorAppearance {
  const grade = findSelectedOption(vehicle, "INTERIOR_MATERIAL", singleSelections.INTERIOR_MATERIAL);
  const gradeAssetRef = grade?.assetRef ?? DEFAULT_GRADE_ASSET_REF;

  const colorFor = (category: SingleSelectCategory, selectionId: string) =>
    findSelectedOption(vehicle, category, selectionId)?.swatchColor ?? DEFAULT_SURFACE_COLOR;

  const lighting = findSelectedOption(vehicle, "INTERIOR_LIGHTING", singleSelections.INTERIOR_LIGHTING);

  return {
    seat: composeInteriorMaterial(gradeAssetRef, colorFor("INTERIOR_SEATS", singleSelections.INTERIOR_SEATS)),
    dashboard: composeInteriorMaterial(
      gradeAssetRef,
      colorFor("INTERIOR_DASHBOARD", singleSelections.INTERIOR_DASHBOARD),
    ),
    steeringWheel: composeInteriorMaterial(
      gradeAssetRef,
      colorFor("INTERIOR_STEERING_WHEEL", singleSelections.INTERIOR_STEERING_WHEEL),
    ),
    doorPanel: composeInteriorMaterial(
      gradeAssetRef,
      colorFor("INTERIOR_DOOR_PANELS", singleSelections.INTERIOR_DOOR_PANELS),
    ),
    floor: composeInteriorMaterial(gradeAssetRef, colorFor("INTERIOR_FLOOR", singleSelections.INTERIOR_FLOOR)),
    lightingColor: lighting?.swatchColor ?? DEFAULT_LIGHTING_COLOR,
  };
}

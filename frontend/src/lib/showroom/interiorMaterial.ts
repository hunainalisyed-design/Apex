export interface ThreeMaterialParams {
  color: string;
  roughness: number;
  metalness: number;
}

// No production texture/grain assets exist yet (same "no 3D asset" constraint as the rest
// of this rig) — grade is expressed through material properties instead of a texture map.
const GRADE_PROPERTIES: Record<string, { roughness: number; metalness: number }> = {
  "interior-material-standard-cloth": { roughness: 0.9, metalness: 0 },
  "interior-material-premium-leather": { roughness: 0.35, metalness: 0.05 },
  "interior-material-alcantara": { roughness: 0.75, metalness: 0 },
};

const DEFAULT_GRADE = GRADE_PROPERTIES["interior-material-standard-cloth"];

/**
 * Combines an overall finish grade with a per-surface color into one material's props.
 * Grade and color are independent inputs — calling this with the same color and a
 * different grade never changes the color, and vice versa (AC-2/AC-3).
 */
export function composeInteriorMaterial(gradeAssetRef: string, colorHex: string): ThreeMaterialParams {
  const grade = GRADE_PROPERTIES[gradeAssetRef] ?? DEFAULT_GRADE;
  return { color: colorHex, roughness: grade.roughness, metalness: grade.metalness };
}

import type { CustomizationOptionDto } from "@/types/catalog";

export type ResolvedAppearance =
  | { kind: "material"; color: string }
  | { kind: "variant"; variant: string }
  | { kind: "visibility"; visible: boolean; color?: string };

// Convention established in Spec 2's seed data: a MESH_VISIBILITY option whose assetRef
// ends in one of these suffixes is the category's "hidden" state (e.g. "spoiler-none",
// "body-package-standard"); every other option in that category is shown.
const HIDDEN_SUFFIXES = ["-none", "-standard"];

function isHiddenOption(option: CustomizationOptionDto): boolean {
  return HIDDEN_SUFFIXES.some((suffix) => option.assetRef.endsWith(suffix));
}

/**
 * Resolves a single selected option into what the 3D scene should do with it, purely from
 * its applyMode/swatchColor/assetRef — generic and reusable (Spec 8's multi-select
 * dispatch calls this same function).
 */
export function resolveAppearance(option: CustomizationOptionDto): ResolvedAppearance {
  switch (option.applyMode) {
    case "MATERIAL_SWAP":
      return { kind: "material", color: option.swatchColor ?? "#8a8d91" };
    case "MESH_VARIANT_SWAP":
      return { kind: "variant", variant: option.assetRef };
    case "MESH_VISIBILITY":
      return {
        kind: "visibility",
        visible: !isHiddenOption(option),
        color: option.swatchColor ?? undefined,
      };
  }
}

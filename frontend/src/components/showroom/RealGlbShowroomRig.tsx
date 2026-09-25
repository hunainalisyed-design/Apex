"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { RealGlbVehicleConfig } from "@/lib/showroom/realGlbVehicles";
import type { ExteriorAppearance } from "@/lib/showroom/exteriorAppearance";

export interface RealGlbShowroomRigProps {
  config: RealGlbVehicleConfig;
  /** The vehicle's own content-addressed showroomModelUrl from the API (Spec 25). */
  modelUrl: string;
  appearance: ExteriorAppearance;
}

/**
 * Renders a real, downloaded GLB in the configurator/showroom in place of
 * PlaceholderShowroomRig — dispatched per-vehicle by ShowroomScene.tsx for every slug listed
 * in realGlbVehicles.ts. Generalized from the original Porsche-only PorscheShowroomRig (see
 * git history) once a second real-GLB vehicle needed the identical load/auto-fit/tint logic,
 * parameterized only by config (paint material name(s), auto-fit target length) plus the
 * vehicle's own model URL, rather than duplicated per car.
 *
 * Customization scope is deliberately honest, not exhaustive: each of these is a downloaded
 * asset with its own real (but placeholder-rig-unrelated) mesh/material names — none has an
 * equivalent to the placeholder rig's purpose-built per-option mesh graph (Spec 6/8's
 * applyMode dispatch). Only PAINT is wired to a real visual change: tinting the body-paint
 * material(s) named in config.paintMaterialNames. Every other exterior category (wheels,
 * brake calipers, window tint, spoiler, accessories) and every interior/accessory option has
 * no honestly-mappable target on these assets, so those selections stay fully functional —
 * selectable, priced, saved, reserved, quoted — without a matching visual change here, the
 * same "warn, don't fabricate" policy docs/CLAUDE.md already established for the placeholder
 * rig's own unmapped options (Spec 8 AC-6) rather than inventing geometry that isn't in the
 * file.
 */
export function RealGlbShowroomRig({ config, modelUrl, appearance }: RealGlbShowroomRigProps) {
  const { scene } = useGLTF(modelUrl);

  const { object, scale, bodyMaterials } = useMemo(() => {
    const clone = scene.clone(true);
    const tintedMaterials: MeshStandardMaterial[] = [];

    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      if (!materials.some((m) => config.paintMaterialNames.includes(m.name))) return;

      // Clones only the matched material(s) before mutating them — useGLTF's cache shares
      // the parsed scene (and its materials, by reference) across every consumer of this
      // URL (showroom, Hero, /models preview); without this clone, tinting here would leak
      // this vehicle's paint color into every other consumer sharing the same cached asset.
      const rename = (m: MeshStandardMaterial) => {
        if (!config.paintMaterialNames.includes(m.name) || !(m instanceof MeshStandardMaterial)) return m;
        const tinted = m.clone();
        // A near-perfect mirror (metalness ~1, roughness ~0) has essentially zero real
        // diffuse component in the standard PBR model — a metal's visible color comes
        // entirely from reflecting its environment, so .color changes stay invisible in
        // this showroom scene, which has no environment map (unlike the Hero/showcase
        // scenes' backdrop). Discovered on the Mustang's "CarPrimaryColor" (metalness 1,
        // roughness 0): even after raising roughness alone, most of the body still read
        // as black outside the couple of directional lights' reflection angles. Pulling
        // metalness down to a normal automotive-metallic-paint range (real car paint is
        // usually modeled well under 1.0, unlike this asset's literal chrome-level value)
        // gives the surface a genuine diffuse response so the selected color actually
        // reads as the car's paint, while roughness keeps a glossy, non-matte finish.
        // Every other vehicle's paint material already has a real diffuse component
        // (lower metalness and/or higher roughness) and renders correctly as-is, so this
        // is a no-op for them.
        if (tinted.metalness >= 0.9 && tinted.roughness <= 0.05) {
          tinted.metalness = 0.4;
          tinted.roughness = 0.3;
        }
        tintedMaterials.push(tinted);
        return tinted;
      };
      child.material = Array.isArray(child.material) ? child.material.map(rename) : rename(child.material);
    });

    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const longestSide = Math.max(size.x, size.z);
    const computedScale = longestSide > 0 ? config.targetLength / longestSide : 1;
    clone.position.set(-center.x, -box.min.y, -center.z);

    return { object: clone, scale: computedScale, bodyMaterials: tintedMaterials };
  }, [scene, config.paintMaterialNames, config.targetLength]);

  useEffect(() => {
    for (const material of bodyMaterials) material.color.set(appearance.paintColor);
  }, [bodyMaterials, appearance.paintColor]);

  return (
    <group scale={scale}>
      <primitive object={object} />
    </group>
  );
}

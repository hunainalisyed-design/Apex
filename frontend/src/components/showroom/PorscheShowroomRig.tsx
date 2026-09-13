"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Mesh, MeshStandardMaterial, Vector3 } from "three";
import type { ExteriorAppearance } from "@/lib/showroom/exteriorAppearance";

const MODEL_URL = "/assets/models/porsche-992-gt3-r.glb";

// Matches the placeholder rig's own ~2.4-unit body length closely enough to read correctly
// against the showroom's fixed camera presets (cameraPresets.ts) without changing them.
const TARGET_LENGTH = 4.2;

// The mesh carrying the exterior body-shell's material — confirmed by dumping this exact
// file's node/material graph with @gltf-transform/core (not guessed): the mesh named
// "porsche_992_gt3_r_exterior_SUB0_EXT_Carpaint_Inst_0" uses material "EXT_Carpaint_Inst",
// the model's actual car-paint material (by far the largest exterior body surface once
// verified against the raw, pre-optimization source file's vertex counts — gltf-transform
// optimize's own material-deduplication pass was silently merging this material into an
// unrelated one during the standard Hero-asset optimization, which is why this model was
// re-exported via a custom pipeline that skips that step; see the .glb's own generation
// history for details).
const BODY_PAINT_MATERIAL_NAME = "EXT_Carpaint_Inst";

useGLTF.preload(MODEL_URL);

export interface PorscheShowroomRigProps {
  appearance: ExteriorAppearance;
}

/**
 * Renders the real Porsche 992 GT3 R GLB in the configurator/showroom, in place of
 * PlaceholderShowroomRig — dispatched per-vehicle by ShowroomScene.tsx (only for
 * vehicle.slug === "porsche-992-gt3-r"; every other vehicle keeps using the placeholder rig
 * exactly as before). Same GLB, cache, and useGLTF/auto-fit approach as the landing-page
 * Hero and /models preview (HeroVehicleModel.tsx) — one asset, three consumers, no
 * duplicate download.
 *
 * Customization scope is deliberately honest, not exhaustive: this is a downloaded
 * Sketchfab racing-car asset with a baked livery texture and its own real (but
 * placeholder-rig-unrelated) mesh/material names — it has no equivalent to the placeholder
 * rig's purpose-built per-option mesh graph (Spec 6/8's applyMode dispatch). Only PAINT is
 * wired to a real visual change: tinting the body-shell material located above. Every other
 * exterior category (wheels, brake calipers, window tint, spoiler, accessories) and every
 * interior/accessory option has no honestly-mappable target on this specific asset, so
 * those selections stay fully functional — selectable, priced, saved, reserved, quoted —
 * without a matching visual change here, the same "warn, don't fabricate" policy
 * docs/CLAUDE.md already established for the placeholder rig's own unmapped options (Spec 8
 * AC-6) rather than inventing geometry that isn't in the file.
 */
export function PorscheShowroomRig({ appearance }: PorscheShowroomRigProps) {
  const { scene } = useGLTF(MODEL_URL);

  const { object, scale, bodyMaterial } = useMemo(() => {
    const clone = scene.clone(true);
    const tintedMaterials: MeshStandardMaterial[] = [];

    clone.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      const match = materials.find((m) => m.name === BODY_PAINT_MATERIAL_NAME);
      if (!match || !(match instanceof MeshStandardMaterial)) return;

      // Clones this one material before mutating it — useGLTF's cache shares the parsed
      // scene (and its materials, by reference) across every consumer of this URL; without
      // this clone, tinting it here would leak the Porsche's paint color into the Hero and
      // /models preview too.
      const tinted = match.clone();
      child.material = Array.isArray(child.material)
        ? child.material.map((m) => (m.name === BODY_PAINT_MATERIAL_NAME ? tinted : m))
        : tinted;
      tintedMaterials.push(tinted);
    });

    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const longestSide = Math.max(size.x, size.z);
    const computedScale = longestSide > 0 ? TARGET_LENGTH / longestSide : 1;
    clone.position.set(-center.x, -box.min.y, -center.z);

    return { object: clone, scale: computedScale, bodyMaterial: tintedMaterials[0] ?? null };
  }, [scene]);

  useEffect(() => {
    bodyMaterial?.color.set(appearance.paintColor);
  }, [bodyMaterial, appearance.paintColor]);

  return (
    <group scale={scale}>
      <primitive object={object} />
    </group>
  );
}

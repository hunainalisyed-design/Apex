"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Vector3 } from "three";

// The one hardcoded model URL left after Spec 25: the landing hero is a brand visual, not a
// catalog row, and it must be preloadable at module load (below) before any API data exists.
// Keep it equal to the Porsche's seeded heroModelUrl — when a new Porsche version is
// published, update this too (the old file stays on disk, so nothing breaks in between).
const DEFAULT_MODEL_URL = "/assets/models/porsche-992-gt3-r.93062210.glb";

// The placeholder box this replaces was 2.4 units long, but at that scale the real (much more
// detailed) model reads as small and distant against HeroScene's existing camera (position z
// 5.5-8.5, fov 35) — visually verified against a render and increased for a bolder hero
// presence while confirming the car still stays fully inside frame at both camera distances.
const TARGET_LENGTH = 4.2;

// Starts the ~2.7MB (Meshopt-compressed geometry + WebP textures, down from a raw 36.6MB
// Sketchfab export via `gltf-transform optimize`) download as soon as this module is
// evaluated — i.e. as soon as HeroScene's own dynamic import chunk loads — rather than
// waiting for HeroVehicleModel to first render.
useGLTF.preload(DEFAULT_MODEL_URL);

export interface HeroVehicleModelProps {
  /** Called once, the first time this component successfully renders — since useGLTF
   * suspends until the asset is fully loaded, a successful render IS "loaded" (Spec-less
   * landing-page GLB integration task). Lets HeroRig gate its reveal-scale animation on
   * real load completion instead of only the fixed reveal timer, so a slow network doesn't
   * make the car pop in abruptly mid-way through the rest of the reveal sequence. */
  onReady?: () => void;
  /** Overrides TARGET_LENGTH for a smaller consumer (e.g. the /models page's compact
   * showcase card) that frames the same model tighter than the Hero does. */
  targetLength?: number;
  /** Overrides DEFAULT_MODEL_URL so other real-GLB catalog vehicles (realGlbVehicles.ts) can
   * reuse this same load/auto-fit logic for their own /models showcase preview, without the
   * Hero itself (which never passes this) changing which model it shows. Not eagerly
   * preloaded like the default — only the above-the-fold Hero asset earns that. */
  modelUrl?: string;
}

/**
 * The real hero vehicle — replaces PlaceholderVehicleMesh here only. ScrollShowcaseScene
 * still renders PlaceholderVehicleMesh; that's a separate part of the landing page and out
 * of scope for this change.
 *
 * Auto-fits to the scene regardless of the source model's own units/orientation: computes
 * a real bounding box, centers it at the local origin and grounds its lowest point at y=0
 * (so it can never clip out of frame off-center), then scales uniformly so its longest
 * horizontal dimension matches TARGET_LENGTH. This model's raw export used some non-meter
 * CAD unit (bounding box on the order of 0.01-0.05 units) — hardcoding a scale factor would
 * silently break the moment a differently-scaled model was ever swapped in.
 */
export function HeroVehicleModel({
  onReady,
  targetLength = TARGET_LENGTH,
  modelUrl = DEFAULT_MODEL_URL,
}: HeroVehicleModelProps) {
  const { scene } = useGLTF(modelUrl);

  const { object, scale } = useMemo(() => {
    const clone = scene.clone(true);
    const box = new Box3().setFromObject(clone);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());

    const longestSide = Math.max(size.x, size.z);
    const computedScale = longestSide > 0 ? targetLength / longestSide : 1;

    // Values are in the clone's own pre-scale units — the parent <group>'s scale below
    // applies uniformly to this offset too, so the model ends up centered/grounded at the
    // group's origin once scaled, not just in its own raw coordinate space.
    clone.position.set(-center.x, -box.min.y, -center.z);

    return { object: clone, scale: computedScale };
  }, [scene, targetLength]);

  useEffect(() => {
    onReady?.();
    // Only ever fires once per mount — a fresh mount only happens after Suspense resolves
    // (useGLTF above), so "mounted" already means "loaded."
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <group scale={scale}>
      <primitive object={object} />
    </group>
  );
}

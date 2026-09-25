// Registry of catalog vehicles backed by a real, downloaded GLB asset rather than the
// procedural PlaceholderShowroomRig (docs/CLAUDE.md's "Known open blocker"). Started as a
// single hardcoded PORSCHE_GT3_R_SLUG constant (see git history); generalized here so adding
// another real-GLB vehicle is a one-entry registry addition, not a new hardcoded slug check
// in every consumer (ShowroomScene.tsx's rig dispatch, /models page's live-preview dispatch).
// Not a "use client" module, so both the server-rendered /models page and client-only
// showroom/preview components can import it without crossing the server/client boundary just
// to read these constants.
//
// The model URL itself is deliberately NOT here (Spec 25): it comes from the vehicle's own
// `showroomModelUrl`/`heroModelUrl` in the API, a content-addressed path an admin can point at
// a newly published version. This registry only holds what's specific to one GLB's internals
// (its paint material names and auto-fit length) — a newly published version of the same car
// is expected to keep those, so it needs no code change here.
export interface RealGlbVehicleConfig {
  slug: string;
  /** Body-paint material name(s) inside this specific GLB, tinted live when the PAINT option
   * changes (Spec 6/8's MATERIAL_SWAP dispatch is keyed to PlaceholderShowroomRig's own mesh
   * names; a real GLB instead keys directly to its own material name(s), each confirmed by
   * inspecting the asset's node/material graph and comparing surface area/position, not
   * guessed from naming alone — a "paint"-sounding material can just as easily be a small
   * badge or a wheel-well liner). Multiple names cover a car whose paint is split across
   * several material slots (e.g. body panels vs. carbon-adjacent duplicate flagged
   * separately by the exporter); every name in the array gets tinted together.
   */
  paintMaterialNames: string[];
  /** Auto-fit target length in scene units (bounding-box longest horizontal axis) for the
   * showroom/hero — matches the existing rigs' ~4.2-unit convention so the shared, fixed
   * camera presets (cameraPresets.ts) still frame the car correctly without per-vehicle
   * camera tuning. */
  targetLength: number;
}

// Ratio between PorscheShowcaseScene's original hardcoded showcase targetLength (1.6) and
// its showroom/hero targetLength (4.2) — reused so every real-GLB vehicle's /models card
// preview stays proportionally framed the same way without hardcoding a second number per car.
export const SHOWCASE_TARGET_LENGTH_RATIO = 1.6 / 4.2;

export const REAL_GLB_VEHICLES: Record<string, RealGlbVehicleConfig> = {
  "porsche-992-gt3-r": {
    slug: "porsche-992-gt3-r",
    paintMaterialNames: ["EXT_Carpaint_Inst"],
    targetLength: 4.2,
  },
  "pagani-huayra-codalunga-speedster": {
    slug: "pagani-huayra-codalunga-speedster",
    // Confirmed via @gltf-transform/core inspection: material "Paint" is the sole
    // textureless, vertex-color-driven material used by the "Paint_Geo_lodA.*" body meshes.
    paintMaterialNames: ["Paint"],
    targetLength: 4.35,
  },
  "lamborghini-revuelto": {
    slug: "lamborghini-revuelto",
    // Confirmed via world-space bounding-box analysis of the raw source GLB: "car_paint_v3_03"
    // covers the full-length body panels (doors, bumpers, gas cap — bbox length 4.89 of the
    // car's ~4.91 total), and "M_CarPaint" covers the body-colored door jambs/sills (a much
    // smaller, body-colored trim area). "M_PaintedMetal" was deliberately excluded despite its
    // similar-sounding name and large bbox — it's also applied to the wheel hub nodes
    // (Wheel_FL/FR/RL/RR), so tinting it would incorrectly recolor the wheels along with the
    // paint.
    paintMaterialNames: ["car_paint_v3_03", "M_CarPaint"],
    targetLength: 4.45,
  },
  "mustang-1965": {
    slug: "mustang-1965",
    // Confirmed via world-space bounding-box analysis: "CarPrimaryColor" spans the full body
    // length. "Car Secondary" was deliberately excluded — its bbox is much narrower
    // (0.39 vs. 1.33 units wide) at the same length, i.e. a two-tone accent stripe, not the
    // primary body color; tinting it together with the primary paint would erase the car's
    // intentional two-tone look instead of just recoloring the body.
    paintMaterialNames: ["CarPrimaryColor"],
    targetLength: 4.25,
  },
};

export function getRealGlbVehicleConfig(slug: string): RealGlbVehicleConfig | undefined {
  return REAL_GLB_VEHICLES[slug];
}

export function isRealGlbVehicle(slug: string): boolean {
  return slug in REAL_GLB_VEHICLES;
}

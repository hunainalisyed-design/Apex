import type { ApplyMode, OptionCategory } from "../src/types/catalog.js";

export interface SeedOption {
  category: OptionCategory;
  name: string;
  description: string | null;
  priceDeltaCents: number;
  assetRef: string;
  swatchColor: string | null;
  applyMode: ApplyMode;
  isDefault: boolean;
  sortOrder: number;
}

export interface SeedVehicle {
  slug: string;
  name: string;
  tagline: string;
  basePriceCents: number;
  currency: string;
  horsepower: number;
  topSpeedKph: number;
  zeroToHundredSec: number;
  heroModelUrl: string;
  showroomModelUrl: string;
  thumbnailUrl: string;
  fallbackImageUrl: string;
  options: SeedOption[];
}

/**
 * One representative option catalog, reused (as fresh, independent rows) for every seeded
 * vehicle — Spec 02 Risk #2 resolves this as duplicate-per-vehicle rows rather than a shared
 * catalog, since there are only two vehicles today.
 */
function buildOptionCatalog(): SeedOption[] {
  let sortOrder = 0;
  const next = () => sortOrder++;
  // applyMode is uniform per category for most categories (Spec 6): for MESH_VISIBILITY
  // categories, which row hides vs. shows its mesh is derived at dispatch time from the
  // assetRef's "-none"/"-standard" suffix convention already used below, not from a
  // different applyMode value. ACCESSORY is the first category needing a genuine per-row
  // override (Spec 8: Sport Exhaust is MESH_VISIBILITY while its siblings stay
  // MATERIAL_SWAP) — a row's own applyMode wins when present, else the category default.
  const category = (
    cat: OptionCategory,
    defaultApplyMode: ApplyMode,
    rows: (Omit<SeedOption, "category" | "sortOrder" | "applyMode"> & { applyMode?: ApplyMode })[],
  ) => {
    sortOrder = 0;
    return rows.map((row) => ({
      ...row,
      category: cat,
      applyMode: row.applyMode ?? defaultApplyMode,
      sortOrder: next(),
    }));
  };

  return [
    ...category("PAINT", "MATERIAL_SWAP", [
      { name: "Obsidian Black", description: null, priceDeltaCents: 0, assetRef: "paint-obsidian-black", swatchColor: "#0a0a0c", isDefault: true },
      { name: "Pearl White", description: null, priceDeltaCents: 150000, assetRef: "paint-pearl-white", swatchColor: "#f5f5f0", isDefault: false },
      { name: "Racing Red", description: null, priceDeltaCents: 150000, assetRef: "paint-racing-red", swatchColor: "#b3121b", isDefault: false },
      { name: "Metallic Blue", description: null, priceDeltaCents: 180000, assetRef: "paint-metallic-blue", swatchColor: "#1f4b8f", isDefault: false },
      { name: "Titanium Grey", description: null, priceDeltaCents: 150000, assetRef: "paint-titanium-grey", swatchColor: "#6b6f75", isDefault: false },
      { name: "Custom Color", description: "A bespoke paint match, priced at a flat premium.", priceDeltaCents: 250000, assetRef: "paint-custom", swatchColor: null, isDefault: false },
    ]),
    ...category("WHEELS", "MESH_VARIANT_SWAP", [
      { name: "Standard Wheels", description: null, priceDeltaCents: 0, assetRef: "wheel-standard", swatchColor: null, isDefault: true },
      { name: "Sport Wheels", description: '20" sport alloy wheels.', priceDeltaCents: 450000, assetRef: "wheel-sport-20", swatchColor: null, isDefault: false },
      { name: "Performance Wheels", description: null, priceDeltaCents: 650000, assetRef: "wheel-performance", swatchColor: null, isDefault: false },
      { name: "Carbon Wheels", description: null, priceDeltaCents: 900000, assetRef: "wheel-carbon", swatchColor: null, isDefault: false },
    ]),
    ...category("BRAKE_CALIPER", "MATERIAL_SWAP", [
      { name: "Black", description: null, priceDeltaCents: 0, assetRef: "brake-caliper-black", swatchColor: "#111111", isDefault: true },
      { name: "Silver", description: null, priceDeltaCents: 30000, assetRef: "brake-caliper-silver", swatchColor: "#c7c9cc", isDefault: false },
      { name: "Red", description: null, priceDeltaCents: 45000, assetRef: "brake-caliper-red", swatchColor: "#c81e2c", isDefault: false },
      { name: "Yellow", description: null, priceDeltaCents: 45000, assetRef: "brake-caliper-yellow", swatchColor: "#f2c11c", isDefault: false },
      { name: "Blue", description: null, priceDeltaCents: 45000, assetRef: "brake-caliper-blue", swatchColor: "#1f5fbf", isDefault: false },
    ]),
    ...category("WINDOW_TINT", "MATERIAL_SWAP", [
      { name: "None", description: null, priceDeltaCents: 0, assetRef: "tint-none", swatchColor: null, isDefault: true },
      { name: "Light Tint", description: null, priceDeltaCents: 30000, assetRef: "tint-light", swatchColor: null, isDefault: false },
      { name: "Dark Tint", description: null, priceDeltaCents: 45000, assetRef: "tint-dark", swatchColor: null, isDefault: false },
    ]),
    ...category("SPOILER", "MESH_VISIBILITY", [
      { name: "None", description: null, priceDeltaCents: 0, assetRef: "spoiler-none", swatchColor: null, isDefault: true },
      { name: "Sport Spoiler", description: null, priceDeltaCents: 180000, assetRef: "spoiler-sport", swatchColor: null, isDefault: false },
      { name: "Carbon Spoiler", description: null, priceDeltaCents: 350000, assetRef: "spoiler-carbon", swatchColor: null, isDefault: false },
    ]),
    ...category("FRONT_ACCESSORY", "MESH_VISIBILITY", [
      { name: "None", description: null, priceDeltaCents: 0, assetRef: "front-accessory-none", swatchColor: null, isDefault: true },
      { name: "Front Splitter", description: null, priceDeltaCents: 120000, assetRef: "front-accessory-splitter", swatchColor: null, isDefault: false },
    ]),
    ...category("REAR_ACCESSORY", "MESH_VISIBILITY", [
      { name: "None", description: null, priceDeltaCents: 0, assetRef: "rear-accessory-none", swatchColor: null, isDefault: true },
      { name: "Rear Diffuser", description: null, priceDeltaCents: 120000, assetRef: "rear-accessory-diffuser", swatchColor: null, isDefault: false },
    ]),
    ...category("BODY_PACKAGE", "MESH_VISIBILITY", [
      { name: "Standard", description: null, priceDeltaCents: 0, assetRef: "body-package-standard", swatchColor: null, isDefault: true },
      { name: "Sport Body Kit", description: null, priceDeltaCents: 500000, assetRef: "body-package-sport", swatchColor: null, isDefault: false },
      { name: "Track Body Kit", description: null, priceDeltaCents: 800000, assetRef: "body-package-track", swatchColor: null, isDefault: false },
    ]),
    ...category("CARBON_COMPONENT", "MESH_VISIBILITY", [
      { name: "None", description: null, priceDeltaCents: 0, assetRef: "carbon-component-none", swatchColor: null, isDefault: true },
      { name: "Exterior Carbon Pack", description: null, priceDeltaCents: 500000, assetRef: "carbon-component-exterior-pack", swatchColor: null, isDefault: false },
      { name: "Full Carbon Pack", description: null, priceDeltaCents: 900000, assetRef: "carbon-component-full-pack", swatchColor: null, isDefault: false },
    ]),
    ...category("INTERIOR_MATERIAL", "MATERIAL_SWAP", [
      { name: "Standard Cloth", description: null, priceDeltaCents: 0, assetRef: "interior-material-standard-cloth", swatchColor: null, isDefault: true },
      { name: "Premium Leather", description: null, priceDeltaCents: 600000, assetRef: "interior-material-premium-leather", swatchColor: null, isDefault: false },
      { name: "Alcantara", description: null, priceDeltaCents: 800000, assetRef: "interior-material-alcantara", swatchColor: null, isDefault: false },
    ]),
    ...category("INTERIOR_LIGHTING", "MATERIAL_SWAP", [
      { name: "White", description: null, priceDeltaCents: 0, assetRef: "interior-lighting-white", swatchColor: "#f5f5f5", isDefault: true },
      { name: "Blue", description: null, priceDeltaCents: 20000, assetRef: "interior-lighting-blue", swatchColor: "#3d6fe0", isDefault: false },
      { name: "Purple", description: null, priceDeltaCents: 20000, assetRef: "interior-lighting-purple", swatchColor: "#8a3de0", isDefault: false },
      { name: "Red", description: null, priceDeltaCents: 20000, assetRef: "interior-lighting-red", swatchColor: "#e03d3d", isDefault: false },
    ]),
    ...category("INTERIOR_SEATS", "MATERIAL_SWAP", [
      { name: "Black", description: null, priceDeltaCents: 0, assetRef: "interior-seats-black", swatchColor: "#111111", isDefault: true },
      { name: "Tan", description: null, priceDeltaCents: 50000, assetRef: "interior-seats-tan", swatchColor: "#c9a876", isDefault: false },
      { name: "Burgundy", description: null, priceDeltaCents: 50000, assetRef: "interior-seats-burgundy", swatchColor: "#5c1a2b", isDefault: false },
      { name: "Grey", description: null, priceDeltaCents: 50000, assetRef: "interior-seats-grey", swatchColor: "#8a8d91", isDefault: false },
    ]),
    ...category("INTERIOR_DASHBOARD", "MATERIAL_SWAP", [
      { name: "Black", description: null, priceDeltaCents: 0, assetRef: "interior-dashboard-black", swatchColor: "#111111", isDefault: true },
      { name: "Carbon Trim", description: null, priceDeltaCents: 150000, assetRef: "interior-dashboard-carbon", swatchColor: null, isDefault: false },
    ]),
    ...category("INTERIOR_STEERING_WHEEL", "MATERIAL_SWAP", [
      { name: "Leather", description: null, priceDeltaCents: 0, assetRef: "interior-steering-wheel-leather", swatchColor: null, isDefault: true },
      { name: "Alcantara Sport", description: null, priceDeltaCents: 90000, assetRef: "interior-steering-wheel-alcantara", swatchColor: null, isDefault: false },
    ]),
    ...category("INTERIOR_DOOR_PANELS", "MATERIAL_SWAP", [
      { name: "Black", description: null, priceDeltaCents: 0, assetRef: "interior-door-panels-black", swatchColor: "#111111", isDefault: true },
      { name: "Two-Tone", description: null, priceDeltaCents: 70000, assetRef: "interior-door-panels-two-tone", swatchColor: null, isDefault: false },
    ]),
    ...category("INTERIOR_FLOOR", "MATERIAL_SWAP", [
      { name: "Standard Carpet", description: null, priceDeltaCents: 0, assetRef: "interior-floor-standard", swatchColor: null, isDefault: true },
      { name: "Premium Floor Mats", description: null, priceDeltaCents: 40000, assetRef: "interior-floor-premium-mats", swatchColor: null, isDefault: false },
    ]),
    ...category("ACCESSORY", "MATERIAL_SWAP", [
      { name: "Carbon Mirror Caps", description: null, priceDeltaCents: 60000, assetRef: "accessory-carbon-mirror-caps", swatchColor: "#0d0d10", isDefault: false },
      { name: "Sport Exhaust", description: null, priceDeltaCents: 250000, assetRef: "accessory-sport-exhaust", swatchColor: null, applyMode: "MESH_VISIBILITY", isDefault: false },
      { name: "Premium Lighting Package", description: null, priceDeltaCents: 150000, assetRef: "accessory-premium-lighting", swatchColor: null, isDefault: false },
      { name: "Carbon Roof", description: null, priceDeltaCents: 400000, assetRef: "accessory-carbon-roof", swatchColor: "#0d0d10", isDefault: false },
    ]),
    ...category("PACKAGE", "MATERIAL_SWAP", [
      { name: "Performance Package", description: null, priceDeltaCents: 800000, assetRef: "package-performance", swatchColor: null, isDefault: false },
      { name: "Special Interior Package", description: null, priceDeltaCents: 600000, assetRef: "package-special-interior", swatchColor: null, isDefault: false },
    ]),
  ];
}

export const seedVehicles: SeedVehicle[] = [
  {
    slug: "apex-gt",
    name: "Apex GT",
    tagline: "Performance sports car.",
    basePriceCents: 8_500_000,
    currency: "EUR",
    horsepower: 450,
    topSpeedKph: 280,
    zeroToHundredSec: 4.2,
    heroModelUrl: "/models/apex-gt/hero.glb",
    showroomModelUrl: "/models/apex-gt/showroom.glb",
    thumbnailUrl: "/models/apex-gt/thumbnail.e8f2cc4d.jpg",
    fallbackImageUrl: "/models/apex-gt/fallback.jpg",
    options: buildOptionCatalog(),
  },
  {
    slug: "apex-rs",
    name: "Apex RS",
    tagline: "High-performance sports car.",
    basePriceCents: 10_500_000,
    currency: "EUR",
    horsepower: 510,
    topSpeedKph: 305,
    zeroToHundredSec: 3.8,
    heroModelUrl: "/models/apex-rs/hero.glb",
    showroomModelUrl: "/models/apex-rs/showroom.glb",
    thumbnailUrl: "/models/apex-rs/thumbnail.c5be7a7f.jpg",
    fallbackImageUrl: "/models/apex-rs/fallback.jpg",
    options: buildOptionCatalog(),
  },
  {
    // Real GLB #1 (see frontend/src/lib/showroom/realGlbVehicles.ts). heroModelUrl and
    // showroomModelUrl both point at the one real, content-addressed asset (Spec 25) — the
    // showroom/compare/models views load whatever URL is stored here, so an admin publishing
    // a new version and saving its URL is what changes the rendered model. Options still
    // reuse the shared procedural-rig catalog. The two Apex entries above keep pre-Spec-25
    // placeholder paths (no file exists to version yet); fallback.jpg paths likewise.
    slug: "porsche-992-gt3-r",
    name: "Porsche 992 GT3 R",
    tagline: "GT3 racing homologation car.",
    basePriceCents: 45_000_000,
    currency: "EUR",
    horsepower: 510,
    topSpeedKph: 296,
    zeroToHundredSec: 3.2,
    heroModelUrl: "/assets/models/porsche-992-gt3-r.93062210.glb",
    showroomModelUrl: "/assets/models/porsche-992-gt3-r.93062210.glb",
    thumbnailUrl: "/models/porsche-992-gt3-r/thumbnail.311a7f95.jpg",
    fallbackImageUrl: "/models/porsche-992-gt3-r/fallback.jpg",
    options: buildOptionCatalog(),
  },
  {
    // Real GLB #2 (see frontend/src/lib/showroom/realGlbVehicles.ts) — same pattern as the
    // Porsche entry above: heroModelUrl/showroomModelUrl both point at the one real
    // versioned asset, options still reuse the shared procedural-rig catalog.
    slug: "pagani-huayra-codalunga-speedster",
    name: "Pagani Huayra Codalunga Speedster",
    tagline: "Open-top carbon-titanium hypercar.",
    basePriceCents: 780_000_00,
    currency: "EUR",
    horsepower: 838,
    topSpeedKph: 322,
    zeroToHundredSec: 3.3,
    heroModelUrl: "/assets/models/pagani-huayra-codalunga-speedster.8612ea2d.glb",
    showroomModelUrl: "/assets/models/pagani-huayra-codalunga-speedster.8612ea2d.glb",
    thumbnailUrl: "/models/pagani-huayra-codalunga-speedster/thumbnail.b73e04d0.jpg",
    fallbackImageUrl: "/models/pagani-huayra-codalunga-speedster/fallback.jpg",
    options: buildOptionCatalog(),
  },
  {
    // Real GLB #3 — see comment on the Pagani entry above.
    slug: "lamborghini-revuelto",
    name: "Lamborghini Revuelto",
    tagline: "High-performance electrified V12 hybrid.",
    basePriceCents: 608_000_00,
    currency: "EUR",
    horsepower: 1015,
    topSpeedKph: 350,
    zeroToHundredSec: 2.5,
    heroModelUrl: "/assets/models/lamborghini-revuelto.a6657f10.glb",
    showroomModelUrl: "/assets/models/lamborghini-revuelto.a6657f10.glb",
    thumbnailUrl: "/models/lamborghini-revuelto/thumbnail.766013ab.jpg",
    fallbackImageUrl: "/models/lamborghini-revuelto/fallback.jpg",
    options: buildOptionCatalog(),
  },
  {
    // Real GLB #4 — see comment on the Pagani entry above. The one heritage/classic entry in
    // the catalog rather than a modern supercar; basePriceCents reflects a numbers-matching,
    // fully restored 1965 example rather than its original period sticker price.
    slug: "mustang-1965",
    name: "1965 Ford Mustang Fastback",
    tagline: "American classic muscle car, fully restored.",
    basePriceCents: 120_000_00,
    currency: "EUR",
    horsepower: 271,
    topSpeedKph: 190,
    zeroToHundredSec: 8.0,
    heroModelUrl: "/assets/models/mustang-1965.41520fd5.glb",
    showroomModelUrl: "/assets/models/mustang-1965.41520fd5.glb",
    thumbnailUrl: "/models/mustang-1965/thumbnail.6b464e8d.jpg",
    fallbackImageUrl: "/models/mustang-1965/fallback.jpg",
    options: buildOptionCatalog(),
  },
];

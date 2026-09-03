# Spec: Vehicle & Customization Catalog Data Model

**File:** `docs/specs/02-vehicle-catalog-data-model.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §6 (Vehicle Models), §7 (Exterior customization items), §10 (Interior customization items), §12 (Dynamic Pricing — entities implied)

---

## 1. Problem statement

**Today:** No vehicle, customization option, or saved-configuration data exists anywhere. Every later Phase 1 spec (showroom, exterior/interior customization, accessories, pricing, save/share) needs to read from and write to the same underlying shapes, or they will each invent incompatible ones.

**Who is affected:** Every Phase 1 and Phase 2 spec that touches vehicle data, pricing, or saved builds. This spec exists specifically to be the one place those shapes are defined, so feature specs reference it instead of redefining it.

**Why it matters now:** SRS §6 explicitly requires "the architecture should allow additional vehicles to be added later without rewriting the application" and requires clean separation between vehicle model, materials, wheels, interior, accessories, configuration data, and pricing data. Getting this schema right now avoids a migration rewrite once six feature specs already depend on it.

**Success looks like:** A backend developer can query `GET /api/vehicles` and get back the two seeded vehicles from SRS §6 (Apex GT, Apex RS), each with their full customization option catalog, and every price is expressed in a way that can never silently drift from what the 3D scene shows (SRS §12: "pricing cannot become inconsistent with the selected options").

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** the database has been seeded **When** `GET /api/vehicles` is called **Then** it returns `200` with both seeded vehicles (Apex GT, Apex RS) matching the specs and starting prices in SRS §6 |
| AC-2 | **Given** a valid vehicle slug **When** `GET /api/vehicles/apex-gt` is called **Then** it returns `200` with the vehicle plus its full `CustomizationOption` list, grouped by category, each with `priceDeltaCents` and an `assetRef` the 3D layer can resolve to a material/mesh/color |
| AC-3 | **Given** an unknown vehicle slug **When** `GET /api/vehicles/does-not-exist` is called **Then** it returns `404` with code `VEHICLE_NOT_FOUND` |
| AC-4 | **Given** any `SINGLE_SELECT_CATEGORIES` category for a vehicle **When** its options are queried **Then** exactly one row has `isDefault: true` (including an explicit "None"/"Standard" row for categories like spoiler or body package where the real-world item is optional), so the frontend always has a valid starting selection without guessing |
| AC-5 | **Given** the seed data **When** inspected **Then** every price is stored as an integer number of cents (never a float), preventing rounding drift when prices are summed |
| AC-6 | **Given** a new vehicle needs to be added **When** a developer inserts one `Vehicle` row and its `CustomizationOption` rows **Then** no code change is required anywhere in the customization, pricing, or showroom logic for the new vehicle to work |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/vehicles` | none | `200` `ApiResponse<VehicleSummaryDto[]>` | only `isActive: true` vehicles |
| `GET` | `/api/vehicles/:slug` | none | `200` `ApiResponse<VehicleDetailDto>` | includes full option catalog |
| `GET` | `/api/vehicles/:slug/options` | none | `200` `ApiResponse<CustomizationOptionDto[]>` | used by the pricing engine and customization panels independently of the full vehicle payload |

Write endpoints (create/update vehicle or options) are intentionally not part of this spec — they belong to the Phase 3 Admin/CMS spec (SRS §34.1). Until then, the catalog is seeded directly via `prisma/seed.ts`.

### Request and response DTOs

```ts
// backend/src/types/catalog.ts

export type OptionCategory =
  // Exterior — SRS §7, one-at-a-time choices, each with an explicit default
  | "PAINT"                  // §7 Paint Options
  | "WHEELS"                 // §7 / §8 Wheel Customization
  | "BRAKE_CALIPER"          // §7 / §9 Brake Calipers
  | "WINDOW_TINT"            // §7 Window tint
  | "SPOILER"                // §7 Spoiler (a "Carbon Spoiler" variant lives here, not in ACCESSORY)
  | "FRONT_ACCESSORY"        // §7 Front accessories
  | "REAR_ACCESSORY"         // §7 Rear accessories
  | "BODY_PACKAGE"           // §7 Body package
  | "CARBON_COMPONENT"       // §7 Carbon components (trim tier, e.g. None / Exterior Pack / Full Pack)

  // Interior — SRS §10, one-at-a-time choices per surface, each with an explicit default
  | "INTERIOR_MATERIAL"        // §10 general finish/grade (e.g. Standard vs. Premium leather vs. Alcantara)
  | "INTERIOR_LIGHTING"        // §10 Interior lighting color
  | "INTERIOR_SEATS"           // §10 Seats color/trim
  | "INTERIOR_DASHBOARD"       // §10 Dashboard color/trim
  | "INTERIOR_STEERING_WHEEL"  // §10 Steering wheel color/trim
  | "INTERIOR_DOOR_PANELS"     // §10 Door panels color/trim
  | "INTERIOR_FLOOR"           // §10 Floor/carpet color/trim

  // Cross-cutting — SRS §11 / §12, zero-or-more independent add-ons, no default required
  | "ACCESSORY"               // §11 free-standing accessories (e.g. sport exhaust, premium lighting)
  | "PACKAGE";                // §12 bundled option packages (e.g. Sport Package, Performance Package)

/** Exactly one selected option per vehicle per category; every row in these categories must include an explicit default (a "None"/"Standard" option is a valid, priced default where the item is optional in the real world). */
export const SINGLE_SELECT_CATEGORIES: OptionCategory[] = [
  "PAINT", "WHEELS", "BRAKE_CALIPER", "WINDOW_TINT", "SPOILER",
  "FRONT_ACCESSORY", "REAR_ACCESSORY", "BODY_PACKAGE", "CARBON_COMPONENT",
  "INTERIOR_MATERIAL", "INTERIOR_LIGHTING", "INTERIOR_SEATS", "INTERIOR_DASHBOARD",
  "INTERIOR_STEERING_WHEEL", "INTERIOR_DOOR_PANELS", "INTERIOR_FLOOR",
];

/** Zero or more selected options per vehicle per category; no default required. */
export const MULTI_SELECT_CATEGORIES: OptionCategory[] = ["ACCESSORY", "PACKAGE"];

export interface VehicleSummaryDto {
  slug: string;
  name: string;
  tagline: string;
  basePriceCents: number;
  currency: string; // ISO 4217, e.g. "EUR"
  horsepower: number;
  topSpeedKph: number;
  zeroToHundredSec: number;
  thumbnailUrl: string;
}

export interface VehicleDetailDto extends VehicleSummaryDto {
  heroModelUrl: string;      // GLB used on the landing page hero
  showroomModelUrl: string;  // GLB used in the 3D showroom
  options: Record<OptionCategory, CustomizationOptionDto[]>;
}

export interface CustomizationOptionDto {
  id: string;
  category: OptionCategory;
  name: string;
  description: string | null;
  priceDeltaCents: number;
  assetRef: string;        // material name / GLB mesh variant key / hex color, interpreted by the 3D layer
  swatchColor: string | null; // hex, for the UI swatch — independent of assetRef
  isDefault: boolean;
  sortOrder: number;
}
```

All monetary fields are integer cents. The frontend formats for display (`Intl.NumberFormat`); it never receives or sends floating-point currency values.

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `404` | `VEHICLE_NOT_FOUND` | slug does not match any vehicle, or matches one with `isActive: false` |
| `404` | `OPTION_NOT_FOUND` | referenced in later specs (e.g. save/share) when a `CustomizationOption` id no longer exists |

### Breaking-change check

- [x] First version of this contract — nothing to break yet.

---

## 4. Data model changes

### Entities (Prisma schema, `backend/prisma/schema.prisma`)

```prisma
enum OptionCategory {
  PAINT
  WHEELS
  BRAKE_CALIPER
  WINDOW_TINT
  SPOILER
  FRONT_ACCESSORY
  REAR_ACCESSORY
  BODY_PACKAGE
  CARBON_COMPONENT
  INTERIOR_MATERIAL
  INTERIOR_LIGHTING
  INTERIOR_SEATS
  INTERIOR_DASHBOARD
  INTERIOR_STEERING_WHEEL
  INTERIOR_DOOR_PANELS
  INTERIOR_FLOOR
  ACCESSORY
  PACKAGE
}

model Vehicle {
  id               String    @id @default(cuid())
  slug             String    @unique
  name             String
  tagline          String
  basePriceCents   Int
  currency         String    @default("EUR")
  horsepower       Int
  topSpeedKph      Int
  zeroToHundredSec Decimal   @db.Decimal(3, 1)
  heroModelUrl     String
  showroomModelUrl String
  thumbnailUrl     String
  isActive         Boolean   @default(true)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  options        CustomizationOption[]
  configurations Configuration[]
}

model CustomizationOption {
  id              String         @id @default(cuid())
  vehicleId       String
  vehicle         Vehicle        @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  category        OptionCategory
  name            String
  description     String?
  priceDeltaCents Int            @default(0)
  assetRef        String
  swatchColor     String?
  isDefault       Boolean        @default(false)
  sortOrder       Int            @default(0)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  selections ConfigurationSelection[]

  @@index([vehicleId, category])
}

model Configuration {
  id              String   @id @default(cuid())
  publicId        String   @unique // e.g. "APEX-7F82-K91X", generated in the save/share spec
  vehicleId       String
  vehicle         Vehicle  @relation(fields: [vehicleId], references: [id])
  userId          String?  // null = guest build; FK constraint added when Phase 2 auth spec introduces User
  totalPriceCents Int
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  selections ConfigurationSelection[]
}

model ConfigurationSelection {
  id              String              @id @default(cuid())
  configurationId String
  configuration   Configuration       @relation(fields: [configurationId], references: [id], onDelete: Cascade)
  optionId        String
  option          CustomizationOption @relation(fields: [optionId], references: [id])

  @@unique([configurationId, optionId])
}
```

**Relationships and invariants:**
- One `Vehicle` has many `CustomizationOption`s, grouped by `category`. Adding a vehicle means inserting rows only — no schema change (satisfies AC-6).
- Exactly one `CustomizationOption` per `(vehicleId, category)` must have `isDefault: true` for every category in `SINGLE_SELECT_CATEGORIES`. This is **not** a DB constraint (Postgres partial unique indexes on a boolean-true subset are possible but add complexity for little benefit at this scale) — it is enforced by the seed script and by a validation check in the catalog read path. `ACCESSORY` and `PACKAGE` (`MULTI_SELECT_CATEGORIES`) are the exception: they are optional and zero-or-more, so no default is required there. For single-select categories where the real-world item is itself optional (window tint, spoiler, front/rear accessories, body package, carbon components), the default is an explicit "None"/"Standard" row priced at `priceDeltaCents: 0` — "no row selected" is never a valid state, only "the None row is selected" is.
- `ConfigurationSelection` guarantees a given option is only attached once to a given configuration (`@@unique`), but does **not** enforce "one selection per category" at the DB level — that invariant belongs to the pricing engine (Spec 3), which is the single place selections are validated and written.
- `Configuration.userId` is nullable now to support guest saves (SRS §36.5); it becomes a real foreign key to `User` when the Phase 2 auth spec adds that table. No migration of existing guest rows is implied — a later "claim this build" flow (also Phase 2) sets `userId` on an existing row.

### Seed data

`backend/prisma/seed.ts` must create both vehicles from SRS §6 with a representative option catalog per category, using placeholder GLB URLs pointing at a single free CC0 sedan/sports-car model with separate wheel, body, and interior-surface material slots (tracked as Risk #1 below).

| Entity | Change | Fields |
|---|---|---|
| `Vehicle` | new | Apex GT (450 HP, 4.2s, €85,000), Apex RS (510 HP, 3.8s, €105,000) |
| `CustomizationOption` | new | per vehicle, minimum row counts below |

| Category | Minimum rows | Notes |
|---|---|---|
| `PAINT` | ≥6 | from §7.1 |
| `WHEELS` | ≥4 | from §8 |
| `BRAKE_CALIPER` | ≥5 | from §9 |
| `WINDOW_TINT` | ≥2 | includes a "None" default |
| `SPOILER` | ≥2 | includes a "None" default; a "Carbon Spoiler" variant belongs here, not in `ACCESSORY` |
| `FRONT_ACCESSORY` | ≥1 | includes a "None" default |
| `REAR_ACCESSORY` | ≥1 | includes a "None" default |
| `BODY_PACKAGE` | ≥2 | includes a "Standard" default |
| `CARBON_COMPONENT` | ≥1 | includes a "None" default |
| `INTERIOR_MATERIAL` | ≥3 | e.g. Standard / Premium / Alcantara grade, one default |
| `INTERIOR_LIGHTING` | ≥4 | from §10 |
| `INTERIOR_SEATS` | ≥2 | one default |
| `INTERIOR_DASHBOARD` | ≥2 | one default |
| `INTERIOR_STEERING_WHEEL` | ≥2 | one default |
| `INTERIOR_DOOR_PANELS` | ≥2 | one default |
| `INTERIOR_FLOOR` | ≥2 | one default |
| `ACCESSORY` | ≥1 | e.g. Sport Exhaust, Premium Lighting, Carbon Mirror Caps, Carbon Roof |
| `PACKAGE` | ≥1 | e.g. Performance Package, Special Interior Package |

Categories where "no selection" is a valid real-world state (window tint, spoiler, front/rear accessories, body package, carbon components) seed an explicit "None"/"Standard" row marked `isDefault: true` and `priceDeltaCents: 0`, so AC-4's "always a valid starting selection" guarantee holds for optional-feeling items too, not only for items every car must have.

### Migration

- **Name:** `InitVehicleCatalog`
- **Reversible:** yes — `prisma migrate` down is a plain drop of these five new objects (one enum, four tables), nothing else references them yet.
- **Backfill required:** no — seed data is fixture data, not a backfill of production data.
- **Downtime:** none expected (new database, no existing traffic).
- **Reviewed SQL:** generated as `backend/prisma/migrations/20260903180122_init_vehicle_catalog/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "OptionCategory" AS ENUM ('PAINT', 'WHEELS', 'BRAKE_CALIPER', 'WINDOW_TINT', 'SPOILER', 'FRONT_ACCESSORY', 'REAR_ACCESSORY', 'BODY_PACKAGE', 'CARBON_COMPONENT', 'INTERIOR_MATERIAL', 'INTERIOR_LIGHTING', 'INTERIOR_SEATS', 'INTERIOR_DASHBOARD', 'INTERIOR_STEERING_WHEEL', 'INTERIOR_DOOR_PANELS', 'INTERIOR_FLOOR', 'ACCESSORY', 'PACKAGE');

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tagline" TEXT NOT NULL,
    "basePriceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "horsepower" INTEGER NOT NULL,
    "topSpeedKph" INTEGER NOT NULL,
    "zeroToHundredSec" DECIMAL(3,1) NOT NULL,
    "heroModelUrl" TEXT NOT NULL,
    "showroomModelUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationOption" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "category" "OptionCategory" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceDeltaCents" INTEGER NOT NULL DEFAULT 0,
    "assetRef" TEXT NOT NULL,
    "swatchColor" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomizationOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuration" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "userId" TEXT,
    "totalPriceCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigurationSelection" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "optionId" TEXT NOT NULL,

    CONSTRAINT "ConfigurationSelection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_slug_key" ON "Vehicle"("slug");

-- CreateIndex
CREATE INDEX "CustomizationOption_vehicleId_category_idx" ON "CustomizationOption"("vehicleId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "Configuration_publicId_key" ON "Configuration"("publicId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationSelection_configurationId_optionId_key" ON "ConfigurationSelection"("configurationId", "optionId");

-- AddForeignKey
ALTER TABLE "CustomizationOption" ADD CONSTRAINT "CustomizationOption_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationSelection" ADD CONSTRAINT "ConfigurationSelection_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "Configuration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationSelection" ADD CONSTRAINT "ConfigurationSelection_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "CustomizationOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

### Retention and privacy

`Vehicle` and `CustomizationOption` are non-personal catalog data with no retention concerns. `Configuration` rows created by guests contain no personal data at this stage (no `userId`, no name/email) — retention policy for `Configuration` rows is addressed in the save/share spec (Spec 10), since that is where a TTL-for-guest-builds decision belongs.

---

## 5. UI states

Not applicable — this spec has no UI surface of its own. It is consumed by every Phase 1 UI spec's data layer.

**Route(s):** none (data layer only)
**Directory:** `backend/prisma/`, `backend/src/routes/vehicles.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | DTO mapping (Prisma model → DTO), default-option validation helper | `backend/tests/catalog.test.ts` |
| **Integration** | all three endpoints against a seeded test database, including 404 path | `backend/tests/integration/vehicles.int.test.ts` |
| **Unit** | seed script produces exactly one default per required category per vehicle | `backend/tests/seed.test.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1 | `vehicles.int.test.ts :: GET /api/vehicles` |
| AC-2 | `vehicles.int.test.ts :: GET /api/vehicles/:slug` |
| AC-3 | `vehicles.int.test.ts :: 404 on unknown slug` |
| AC-4 | `seed.test.ts :: exactly one default per category` |
| AC-5 | `catalog.test.ts :: all price fields are integers` |
| AC-6 | manual verification: add a third vehicle via seed data only, re-run integration tests unmodified |

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** load/performance testing of the catalog endpoints — traffic at this stage is trivial (two vehicles); revisit if/when the Admin/CMS spec (Phase 3) makes the catalog large or frequently written.

---

## 7. Out of scope

- Any write/create/update/delete endpoint for vehicles or options (Phase 3 Admin/CMS, §34.1).
- The `User` model and the real foreign key on `Configuration.userId` (Phase 2 auth spec).
- Computing `totalPriceCents` from selections — that logic lives in Spec 3 (Dynamic Pricing Engine); this spec only stores the result.
- Actual GLB/GLTF asset production — this spec references placeholder asset URLs; real asset creation is a content task, not a code spec.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | No production 3D asset exists yet. Need one free, portfolio-safe (CC0/permissive license) GLB car model with separably-addressable wheel meshes and a body material slot, used as the placeholder for both seeded vehicles until real assets are commissioned. | Product owner | Open — must be resolved before Spec 5 (3D Showroom Core) can be implemented, since `heroModelUrl`/`showroomModelUrl`/`assetRef` all depend on knowing the real mesh/material names inside the chosen GLB. |
| 2 | Should `CustomizationOption` support a shared catalog reused across vehicles (e.g. the same "Racing Red" paint on both Apex GT and Apex RS, priced differently per vehicle) instead of duplicating rows per vehicle? | Product owner | Resolved for Phase 1 — duplicate rows per vehicle, since there are only two vehicles and it avoids a join-table abstraction with no current payoff. Revisit if the catalog grows past a handful of vehicles. |
| 3 | Guest `Configuration` rows have no owner and no TTL yet — could accumulate indefinitely. | Product owner | Deferred to Spec 10 (Save/Share), which owns the guest-build lifecycle decision. |
| 4 | SRS §7 frames "Carbon components" as one exterior category, while SRS §11 separately lists "Carbon mirror caps" and "Carbon roof" as individually toggleable accessories — a user may want both active on different parts at once, which a single-select `CARBON_COMPONENT` category cannot represent by itself. | Product owner | Resolved — `CARBON_COMPONENT` (single-select) represents a coarse overall carbon trim tier (e.g. None / Exterior Pack / Full Pack), while Spec 8 separately offers fine-grained carbon accessories (mirror caps, roof) as independent multi-select toggles per §11. The two are not mutually exclusive or bundled in Phase 1 (consistent with Spec 8's no-bundling decision) — a known, accepted overlap in the SRS's own taxonomy rather than an error to design away. |

---

## 9. Rollout

- **Feature flag:** none — foundational data, not a toggleable feature.
- **Migration order:** ships before any Phase 1 feature code; nothing reads from these tables until Spec 3 onward.
- **Rollback:** drop the migration; no dependents exist yet if rolled back immediately after this spec.
- **Observability:** none beyond the health check from Spec 1 — add query-count/slow-query logging when the Phase 3 hygiene spec (§34.2) sets up structured logging.

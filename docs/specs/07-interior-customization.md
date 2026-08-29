# Spec: Interior Customization

**File:** `docs/specs/07-interior-customization.md`
**Status:** Approved
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §10 (Interior Configurator — all seven items); depends on `02-vehicle-catalog-data-model.md` (7 interior categories), `03-dynamic-pricing-engine.md`, `05-3d-showroom-core.md`, `06-exterior-customization.md` (canonical configuration store)

---

## 1. Problem statement

**Today:** The exterior customization spec (Spec 6) established the configuration store, the pricing engine wiring, and the "select swatch → update 3D material" pattern for nine exterior categories. Nothing yet uses that pattern for the interior, and the showroom's interior/cockpit camera views (Spec 5) currently show an uncustomizable default interior.

**Who is affected:** Every user who wants the interior of their build to match the rest of their configuration — SRS §10 names seats, dashboard, steering wheel, door panels, interior materials, interior lighting, and floor/carpet materials as seven separately listed customizable items.

**Why it matters now:** It is the second customization spec (after exterior) and is the one that has to reconcile two things SRS §10 states simultaneously: a general "interior materials" grade (its own bullet) and specific named surfaces (seats, dashboard, steering wheel, door panels, floor/carpet) that can each carry a color independently of that grade.

**Success looks like:** A user opens the interior panel, sets the overall finish to "Premium Leather," and every surface's material grain/quality updates together — then independently recolors just the seats to "Burgundy" while the dashboard, door panels, and floor keep their own previously chosen colors, with the ambient interior lighting color changeable independently of both.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** the interior panel is open **When** it renders **Then** it shows all seven interior categories (`INTERIOR_MATERIAL`, `INTERIOR_LIGHTING`, `INTERIOR_SEATS`, `INTERIOR_DASHBOARD`, `INTERIOR_STEERING_WHEEL`, `INTERIOR_DOOR_PANELS`, `INTERIOR_FLOOR`) for the current vehicle as labeled swatches, grouped as "Overall Finish" (`INTERIOR_MATERIAL`, `INTERIOR_LIGHTING`) and "Surface Colors" (the five per-surface categories), with the currently selected option in each visually marked |
| AC-2 | **Given** an `INTERIOR_MATERIAL` (overall finish grade — e.g. Standard Leather / Premium Leather / Alcantara) swatch is selected **When** the selection is applied **Then** every one of the five surface meshes updates its material grain/texture/finish to the new grade *while keeping each surface's currently selected color* — grade and color are independent material inputs combined per surface, not a single flat swap |
| AC-3 | **Given** a per-surface color swatch is selected (e.g. `INTERIOR_SEATS` → Burgundy) **When** the selection is applied **Then** only that surface's mesh recolors, combined with whatever `INTERIOR_MATERIAL` grade is currently active — the other four surfaces are unaffected |
| AC-4 | **Given** an `INTERIOR_LIGHTING` swatch is selected **When** the selection is applied **Then** the interior ambient light color and any emissive interior trim (e.g. a light strip) update to match, independently of `INTERIOR_MATERIAL` and every per-surface color |
| AC-5 | **Given** the interior panel is opened **When** the showroom camera is not already in the Interior or Cockpit preset (Spec 5) **Then** the camera automatically transitions to the Interior preset (including the door-open animation from Spec 5, AC-6), so the user can see what they're changing |
| AC-6 | **Given** the user then manually switches to an exterior camera preset while the interior panel is still open **When** they return to an interior preset **Then** all seven interior selections have persisted — switching camera views never resets configuration state |
| AC-7 | **Given** any interior selection changes **When** the total price is displayed **Then** it updates per Spec 3, identically to exterior selections |
| AC-8 | **Given** a keyboard-only user **When** they Tab through the interior panel **Then** every swatch across all seven categories is focusable and selectable via Enter/Space with a visible focus ring (SRS §29) |

---

## 3. API contract

No new backend endpoints. Reuses `GET /api/vehicles/:slug` (Spec 2) for the option catalog and the frontend pricing function (Spec 3). No server round trip during interactive customization.

### Breaking-change check

- [x] N/A — no new contract.

---

## 4. Data model changes

None beyond what Spec 2 already defines — this spec is the first consumer of all seven interior categories already in Spec 2's enum and seed data; no new tables, columns, or enum values.

### `assetRef` convention for interior categories (documentation, not a schema change)

Because `INTERIOR_MATERIAL` and the five per-surface categories combine into one rendered material per surface, their `assetRef` values are interpreted differently by the 3D layer even though both are plain strings in the same `CustomizationOption.assetRef` column:

| Category | `assetRef` meaning |
|---|---|
| `INTERIOR_MATERIAL` | a material preset key (e.g. `"leather-standard"`, `"leather-premium"`, `"alcantara"`) controlling grain/texture/roughness |
| `INTERIOR_SEATS`, `INTERIOR_DASHBOARD`, `INTERIOR_STEERING_WHEEL`, `INTERIOR_DOOR_PANELS`, `INTERIOR_FLOOR` | a hex color, tinting that surface's material |
| `INTERIOR_LIGHTING` | a hex color, applied to the ambient light and emissive trim, unrelated to the material system above |

### Configuration store

No new fields — all seven interior categories are already part of the canonical store shape defined in Spec 6 (`frontend/src/state/configurationStore.ts`, part of its `singleSelections` record). This spec is the first to actually read and write them.

### Interior material composition module

```ts
// frontend/src/lib/showroom/interiorMaterial.ts
export function composeInteriorMaterial(
  gradeAssetRef: string,   // from INTERIOR_MATERIAL selection
  colorAssetRef: string,   // from the relevant per-surface category selection
): ThreeMaterialParams;    // texture/roughness from grade, color tint applied on top
```

One shared function, called once per surface mesh (five call sites: seats, dashboard, steering wheel, door panels, floor) whenever either the surface's own color or the shared grade changes.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | skeleton swatch placeholders while the vehicle's catalog is fetched (same request as the showroom's own load, per Spec 6's pattern) |
| **Empty** | not applicable — every vehicle has seeded options with a default for all seven categories (Spec 2, AC-4) |
| **Error** | not applicable independently — covered by the showroom's own error state (Spec 5) if the initial vehicle fetch fails |
| **Success** | swatches render; selection updates the 3D scene and price immediately per AC-2/AC-3/AC-4/AC-7 |

Also specify:
- **Validation:** none — all interior swatches are always valid choices; there is no free-form "custom interior color" equivalent to exterior's Custom Color (not requested in SRS §10).
- **Keyboard/screen-reader:** covered by AC-8; each swatch has an `aria-label` naming the option and its category (e.g. "Seats: Burgundy, +€400", "Overall finish: Premium Leather, +€1,200").
- **Responsive:** same panel placement pattern as the exterior panel (Spec 6) — fixed sidebar on desktop, bottom sheet on mobile, with the "Overall Finish" / "Surface Colors" grouping from AC-1 carried through to both layouts.
- **Permission-gated content:** none — guest mode (SRS §36.5).

**Route(s):** integrated into `/configure/[slug]` (Spec 5) — this spec adds the interior panel component and an interior tab alongside the exterior tab, not a new route.
**Directory:** `frontend/src/components/configurator/InteriorPanel/`, `frontend/src/lib/showroom/interiorMaterial.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | `composeInteriorMaterial` — grade and color combine correctly, grade change preserves existing colors, color change preserves existing grade | `frontend/tests/showroom/interiorMaterial.test.ts` |
| **Component** | panel renders all seven categories in the two groups from AC-1, selection updates visual selected state, keyboard navigation | `frontend/tests/configurator/InteriorPanel.test.tsx` |
| **E2E** | open interior panel → camera auto-transitions to Interior preset → change overall finish → assert all five surfaces update grain while keeping colors → recolor one surface → assert only it changes → change lighting → assert ambient/emissive updates → switch to an exterior preset and back → assert all selections persisted | `frontend/e2e/interior-customization.spec.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1, AC-8 | `InteriorPanel.test.tsx` |
| AC-2 | `interiorMaterial.test.ts :: grade change preserves per-surface colors` + `interior-customization.spec.ts` |
| AC-3 | `interiorMaterial.test.ts :: color change preserves grade` + `interior-customization.spec.ts :: single-surface recolor` |
| AC-4 | `interior-customization.spec.ts :: lighting update` |
| AC-5 | `interior-customization.spec.ts :: auto camera transition` |
| AC-6 | `interior-customization.spec.ts :: selections persist across camera switch` |
| AC-7 | `interior-customization.spec.ts :: price updates` |

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** visual regression across every grade × color combination — spot-checked manually, consistent with Spec 6's approach.

---

## 7. Out of scope

- Accessories and packages (Spec 8).
- Persisting a configuration (Spec 10).
- Any further subdivision beyond the seven categories named in SRS §10 (e.g. separately coloring left vs. right door panels) — not requested anywhere in the SRS.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Same placeholder-asset dependency as prior specs — the chosen GLB must expose five separately addressable interior surface meshes (seats, dashboard, steering wheel, door panels, floor), each able to take an independently parameterized material (grade + color), rather than one shared material for the whole interior. This is a stronger asset requirement than the single coordinated-theme design this spec originally used before Spec 2's catalog review (superseded). | Product owner | Open — blocking, same resolution as Spec 2 Risk #1, now with the added constraint that the five surfaces must be separable in the GLB, not just visually grouped. |
| 2 | Combining a grade (texture) and a color (tint) into one material per surface (`composeInteriorMaterial`) is more complex than a flat material swap — worth confirming the chosen 3D asset pipeline (e.g. Three.js `MeshStandardMaterial` with a base color multiplied over a grade's texture map) actually supports this cleanly before implementation. | Implementer | Open — a technical spike during implementation, not a product decision; flagged so it isn't discovered late. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A — no schema change beyond what Spec 2 already ships.
- **Rollback:** remove the interior panel component, `interiorMaterial.ts`, and the camera-auto-transition behavior; showroom continues working with exterior customization only.
- **Observability:** none beyond what Spec 5/12 already provide.

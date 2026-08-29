# Spec: Exterior Customization

**File:** `docs/specs/06-exterior-customization.md`
**Status:** Approved
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §7 (Car Customization System / Exterior — all nine items), §7.1 (Paint Options), §8 (Wheel Customization), §9 (Brake Calipers); depends on `02-vehicle-catalog-data-model.md` (`SINGLE_SELECT_CATEGORIES`), `03-dynamic-pricing-engine.md`, `05-3d-showroom-core.md`

---

## 1. Problem statement

**Today:** The showroom (Spec 5) renders a vehicle in its default configuration with a hotspot/highlight mechanism, but nothing lets the user actually change any exterior attribute. SRS §7 lists nine independently customizable exterior items — paint, wheels, brake calipers, window tint, spoiler, front accessories, rear accessories, body package, and carbon components — each a single-select choice with its own default. SRS §32's "no fake interactions" rule means none of these can be a swatch that only changes a label — the corresponding 3D material or mesh must visibly change wherever the asset supports it.

**Who is affected:** Every user in the showroom — this is the first real customization capability in the product and establishes the pattern (client-side configuration state + immediate 3D update + immediate price update) that interior customization (Spec 7) and, for the separate multi-select accessories/packages, Spec 8, both reuse.

**Why it matters now:** It is the first consumer of Spec 3's pricing engine and Spec 5's hotspot system, and it introduces the shared client-side configuration store that Specs 7–10 all depend on.

**Success looks like:** A user opens the exterior panel, picks "Racing Red," and the vehicle's body is red within one frame, at no cost to page responsiveness; the same immediacy holds for wheels, brake calipers, window tint, spoiler, front/rear accessories, body package, and carbon components, and the total price and hover labels (Spec 5, AC-7) update to match.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** the exterior panel is open **When** it renders **Then** it shows every option for all nine exterior categories (`PAINT`, `WHEELS`, `BRAKE_CALIPER`, `WINDOW_TINT`, `SPOILER`, `FRONT_ACCESSORY`, `REAR_ACCESSORY`, `BODY_PACKAGE`, `CARBON_COMPONENT`) for the current vehicle as a labeled swatch/thumbnail, grouped by category, with the currently selected option in each category visually marked |
| AC-2 | **Given** a paint swatch is clicked **When** the selection is applied **Then** the vehicle body's 3D material color/finish updates immediately (same render frame family — no network round trip required), the swatch shows as selected, and the total price updates per Spec 3 |
| AC-3 | **Given** "Custom Color" is selected **When** the user picks a color from the color picker **Then** the body material updates live as the picker is dragged (not only on confirm), and the resulting hex is what gets saved (Spec 10), distinct from any catalog paint option |
| AC-4 | **Given** a wheel option is clicked **When** the selection is applied **Then** the actual wheel geometry in the 3D scene is swapped to that wheel's model/variant — never a texture or color substitute standing in for a different wheel — and the total price updates |
| AC-5 | **Given** a brake caliper color is clicked **When** the selection is applied **Then** only the caliper mesh's material color changes; no other component is affected |
| AC-6 | **Given** a window tint level is selected **When** the selection is applied **Then** the glass material's opacity/tint shade updates immediately |
| AC-7 | **Given** a spoiler option (including "None" and any "Carbon Spoiler" variant) is selected **When** the selection is applied **Then** the spoiler mesh's visibility and/or material updates to match — selecting "None" hides it entirely, selecting any spoiler style shows the correct mesh |
| AC-8 | **Given** a front accessory, rear accessory, body package, or carbon component option is selected **When** the selection is applied **Then** the corresponding mesh(es) update (visibility and/or material, per that option's `applyMode` — see Spec 2's `ApplyMode` enum, introduced by Spec 8 and reused here) |
| AC-9 | **Given** any exterior selection changes **When** the user then hovers the corresponding hotspot in the showroom (Spec 5, AC-7) **Then** the hover label reflects the newly selected option's name, not the previous one |
| AC-10 | **Given** the exterior panel on a page refresh **When** the page reloads **Then** every one of the nine exterior categories is hydrated from the vehicle's default options (per Spec 2's `isDefault` flags), never left empty/undefined — including categories whose default is an explicit "None"/"Standard" option |
| AC-11 | **Given** a keyboard-only user **When** they Tab through the exterior panel **Then** every swatch across all nine categories is focusable and selectable via Enter/Space, with a visible focus ring (SRS §29) |

---

## 3. API contract

No new backend endpoints. This spec reads `GET /api/vehicles/:slug` (Spec 2, already filtered/grouped by category) and calls the frontend's local pricing function (Spec 3) on every change. No server round trip occurs during interactive customization — persistence only happens at save time (Spec 10).

### Breaking-change check

- [x] N/A — no new contract.

---

## 4. Data model changes

### Entities

| Entity | Change | Fields |
|---|---|---|
| `Configuration` (from Spec 2) | modified | add nullable `customPaintHex: string?` |

**Why:** SRS §7.1 lists "Custom Color" as a paint option distinct from the fixed catalog swatches. A genuinely arbitrary hex value cannot be represented by a `CustomizationOption` row (the catalog is finite, seeded data), so it needs its own column on `Configuration`, populated only when the selected `PAINT` option is the reserved `CUSTOM_COLOR` catalog entry (one such entry is seeded per vehicle in Spec 2's seed data, with `assetRef: "custom"`). When any other paint option is selected, `customPaintHex` is cleared to `null`.

This spec also depends on Spec 8's `ApplyMode` enum (`MATERIAL_SWAP` / `MESH_VARIANT_SWAP` / `MESH_VISIBILITY`) on `CustomizationOption`, since `SPOILER`, `FRONT_ACCESSORY`, `REAR_ACCESSORY`, `BODY_PACKAGE`, and `CARBON_COMPONENT` — like `ACCESSORY` — mix "recolor an existing part" and "show/hide an optional part" behaviors within the same category (e.g. `SPOILER` needs `MESH_VISIBILITY` for its "None" option and `MESH_VARIANT_SWAP` or `MESH_VISIBILITY` for its styled options). Build order note: because of this, the `ApplyMode` migration (owned by Spec 8) must land before or alongside this spec's implementation, even though Spec 8 is sequenced after this spec in the index — see Risk #3.

### Client-side configuration store (canonical definition — reused by Specs 7, 8, 9, 10)

```ts
// frontend/src/state/configurationStore.ts
import { SingleSelectCategory, MultiSelectCategory } from "./catalogTypes"; // re-exported from Spec 2's types

interface ConfigurationState {
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>; // one CustomizationOption id per category (16 keys, Spec 2)
  customPaintHex: string | null; // set only when singleSelections.PAINT === the CUSTOM_COLOR option id
  multiSelections: Record<MultiSelectCategory, string[]>; // ACCESSORY, PACKAGE — zero or more ids each

  setSingleSelection(category: SingleSelectCategory, optionId: string): void;
  setCustomPaintHex(hex: string): void;
  toggleMultiSelection(category: MultiSelectCategory, optionId: string): void;
  hydrateDefaults(vehicle: VehicleDetailDto): void; // called on showroom mount and on refresh (AC-10)
  reset(): void;
}
```

This store shape mirrors Spec 3's `PriceCalculationRequest` exactly (`singleSelections` / `multiSelections` as `Record`s keyed by the same category constants), so pricing calls pass the store's state through with no reshaping. Implemented as a single Zustand store scoped per showroom session (keyed by `vehicleSlug`, reset on navigation to a different vehicle). Specs 7, 8, and 9 read/write this same store rather than creating parallel state.

### Migration

- **Name:** `AddCustomPaintHexToConfiguration`
- **Reversible:** yes — drop the nullable column.
- **Backfill required:** no — additive nullable column on a table with no production rows yet (Spec 2 has not shipped to production).
- **Downtime:** none.
- **Reviewed SQL:** to be pasted once generated.

### Retention and privacy

No change to Spec 2's assessment — `customPaintHex` is not personal data.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | panel shows skeleton swatch placeholders while the vehicle's option catalog is fetched (same request as the showroom's own load — this panel does not issue a second fetch) |
| **Empty** | not applicable — every vehicle has a seeded catalog for all nine categories, including explicit "None"/"Standard" defaults where the real-world item is optional (Spec 2, AC-4) |
| **Error** | if the initial vehicle fetch failed, the panel is not shown at all — the showroom's own error state (Spec 5) already covers this case, so this panel has no independent error state |
| **Success** | swatches render, selection updates instantly per AC-2 through AC-8 |

Also specify:
- **Validation:** the custom color picker rejects invalid hex input inline; no other validation applies (all catalog swatches, including "None" options, are always valid choices).
- **Keyboard/screen-reader:** covered by AC-11; each swatch has an `aria-label` naming the option (e.g. "Racing Red paint, +€0", "No Spoiler, +€0", "Carbon Spoiler, +€1,800").
- **Responsive:** desktop shows the panel as a fixed sidebar beside the 3D vehicle, with the nine categories organized into collapsible groups (Paint & Finish; Wheels & Brakes; Aero & Body) so the panel doesn't become one long undifferentiated list; mobile shows the same grouping as a bottom sheet below the vehicle (SRS §27).
- **Permission-gated content:** none — customization requires no auth (guest mode, SRS §36.5).

**Route(s):** integrated into `/configure/[slug]` (Spec 5) — this spec adds the exterior panel component, not a new route.
**Directory:** `frontend/src/components/configurator/ExteriorPanel/`, `frontend/src/state/configurationStore.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | configuration store actions (set/toggle/hydrate/reset) across all 16 single-select categories, custom-hex clearing on paint change | `frontend/tests/state/configurationStore.test.ts` |
| **Unit** | `applyMode` dispatch for the exterior categories that mix behaviors (`SPOILER`, `FRONT_ACCESSORY`, `REAR_ACCESSORY`, `BODY_PACKAGE`, `CARBON_COMPONENT`) — shared with Spec 8's dispatch tests | `frontend/tests/showroom/applyModeDispatch.test.ts` |
| **Component** | panel renders all nine categories grouped correctly, selection updates visual selected state, keyboard navigation | `frontend/tests/configurator/ExteriorPanel.test.tsx` |
| **E2E** | select one option in each of the nine exterior categories in sequence; assert the 3D scene's material/mesh/visibility state and the displayed price all reflect every choice | `frontend/e2e/exterior-customization.spec.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1, AC-11 | `ExteriorPanel.test.tsx` |
| AC-2, AC-4, AC-5, AC-6 | `exterior-customization.spec.ts` |
| AC-3 | `configurationStore.test.ts :: custom paint hex` + `exterior-customization.spec.ts :: custom color picker` |
| AC-7, AC-8 | `applyModeDispatch.test.ts` + `exterior-customization.spec.ts :: aero and body categories` |
| AC-9 | `exterior-customization.spec.ts :: hotspot label reflects selection` |
| AC-10 | `configurationStore.test.ts :: hydrateDefaults covers all 16 categories` |

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** exhaustive visual regression across every combination of nine categories' options — spot-checked manually; the state-management and 3D-update wiring is what's under test, not every combination's exact rendered pixels.

---

## 7. Out of scope

- Interior customization (Spec 7) — reads/writes different keys of the same shared store.
- The multi-select `ACCESSORY`/`PACKAGE` categories and the `ApplyMode` enum's definition (both owned by Spec 8) — this spec *consumes* `ApplyMode` for its own single-select categories but does not define it.
- Persisting a configuration (Spec 10) — this spec only manages in-memory/session state.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Same placeholder-asset dependency as Specs 2, 4, 5 — wheel swap in particular requires the chosen GLB to expose multiple selectable wheel variants or separately loadable wheel GLBs, and spoiler/body-package/carbon-component options require optional meshes to exist (hidden by default) in that same GLB. | Product owner | Open — blocking, same resolution as prior specs. |
| 2 | Live-drag color picker (AC-3) updating a Three.js material on every pointer-move event could cause a performance stutter on low-end devices if not throttled. | Implementer | Open — implementer should throttle/debounce material updates during drag; not a product decision, tracked here so it isn't silently dropped. |
| 3 | This spec's `SPOILER`/`FRONT_ACCESSORY`/`REAR_ACCESSORY`/`BODY_PACKAGE`/`CARBON_COMPONENT` categories need Spec 8's `ApplyMode` column to exist, but Spec 8 is sequenced after this spec in the build order (index #6 vs. #8). | Implementer | Resolved — the `ApplyMode` migration itself is small and self-contained; implement it as part of this spec's migration work (crediting Spec 8 as the spec of record for the enum's definition) rather than blocking this spec on Spec 8's full accessories-panel implementation. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** ships after Spec 2's initial migration; adds the nullable `customPaintHex` column and (per Risk #3) the `ApplyMode` enum/column via its own migrations.
- **Rollback:** revert the migrations and remove the exterior panel component; showroom continues working in default configuration only.
- **Observability:** none beyond what Spec 5/12 already provide.

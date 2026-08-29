# Spec: Accessories & Packages

**File:** `docs/specs/08-accessories-packages.md`
**Status:** Approved
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §11 (Accessories); depends on `02-vehicle-catalog-data-model.md`, `03-dynamic-pricing-engine.md`, `05-3d-showroom-core.md`, `06-exterior-customization.md` (canonical configuration store; also ships the `ApplyMode` migration this spec defines, see §4), `07-interior-customization.md`

---

## 1. Problem statement

**Today:** Exterior (Spec 6) and interior (Spec 7) customization both handle **single-select** categories, where choosing a new option always replaces the previous one. Accessories and packages (SRS §11) are **multi-select** — a user can add a sport exhaust *and* a performance package *and* premium lighting simultaneously — and unlike the earlier categories, individual accessories differ in *how* they change the 3D scene: some add a part that isn't present by default (a sport exhaust tip), others recolor a part that already exists (carbon mirror caps, carbon roof). Note that a "Carbon Spoiler" is *not* an `ACCESSORY` in this design — spoiler style, carbon or otherwise, is a single-select choice owned by Spec 6's `SPOILER` category, since a vehicle has exactly one spoiler configuration at a time.

**Who is affected:** Every user assembling a build, and the build summary (Spec 9) and save/share (Spec 10) specs, which both need to enumerate however many accessories/packages are active.

**Why it matters now:** It's the third and final piece of the customization surface before the build summary and save/share specs can be written against a complete configuration shape.

**Success looks like:** A user can freely toggle any combination of accessories and packages on and off; each one that has 3D representation visibly appears or changes the vehicle, the price reflects the sum of everything currently active, and toggling one accessory never affects another.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** the accessories/packages panel is open **When** it renders **Then** it shows every `ACCESSORY` and `PACKAGE` option for the current vehicle as a toggle (not a radio), grouped by category, each showing its name and price delta, with currently-active options visibly marked |
| AC-2 | **Given** an accessory whose `applyMode` is `MESH_VISIBILITY` (e.g. a Sport Exhaust tip) **When** it is toggled on **Then** the corresponding mesh becomes visible in the 3D scene; toggled off, it is hidden again — never destroyed/reloaded |
| AC-3 | **Given** an accessory whose `applyMode` is `MATERIAL_SWAP` (e.g. Carbon Mirror Caps, Carbon Roof) **When** it is toggled on **Then** the corresponding existing mesh's material changes to the carbon finish; toggled off, it reverts to whatever the vehicle's currently selected paint/material is for that part (not a hardcoded default) |
| AC-4 | **Given** any accessory or package is toggled **When** the change is applied **Then** the total price (Spec 3) and the active-items list (feeding Spec 9's build summary) update immediately, and toggling one item never changes another item's state |
| AC-5 | **Given** multiple accessories are active at once **When** inspected in the 3D scene **Then** all of their visual effects are present simultaneously with no visual conflict (e.g. spoiler visible and roof recolored together) |
| AC-6 | **Given** an accessory or package has no asset mapping yet for the currently loaded placeholder model **When** it is toggled on **Then** its price and summary entry still apply correctly, and a development-only console warning notes the missing mapping — the UI never fabricates a visual change that isn't backed by a real asset (SRS §32) |
| AC-7 | **Given** a keyboard-only user **When** they Tab through the panel **Then** every toggle is focusable, operable via Enter/Space, exposes its on/off state via `aria-pressed`, and shows a visible focus ring |

---

## 3. API contract

No new backend endpoints. Reuses `GET /api/vehicles/:slug` (Spec 2) and the frontend pricing function (Spec 3), which already sums arrays of `ACCESSORY`/`PACKAGE` option ids (Spec 3, AC-2).

### Breaking-change check

- [x] N/A — no new contract.

---

## 4. Data model changes

### Entities

| Entity | Change | Fields |
|---|---|---|
| `CustomizationOption` (from Spec 2) | already modified by Spec 6 | `applyMode: ApplyMode` (enum defined below) |

```prisma
enum ApplyMode {
  MATERIAL_SWAP     // recolors/re-materials an existing, always-present mesh
  MESH_VARIANT_SWAP // swaps an existing mesh for a different one (used by WHEELS)
  MESH_VISIBILITY   // shows/hides an optional mesh that isn't present by default
}
```

**Why:** every one of the earlier single-select categories (Specs 6 and 7) had one uniform behavior per category, so the 3D layer could infer behavior from the category alone. `ACCESSORY` and `PACKAGE` options are heterogeneous — the same category holds both "add a part that isn't there" (a sport exhaust tip) and "recolor a part that is" (carbon mirror caps) — so the behavior must be stored explicitly per option rather than inferred from category. Several of Spec 6's own exterior categories (`SPOILER`, `FRONT_ACCESSORY`, `REAR_ACCESSORY`, `BODY_PACKAGE`, `CARBON_COMPONENT`) turned out to need the same per-option distinction, so **this spec is the spec of record for `ApplyMode`'s definition and semantics, but the migration that actually adds the column ships as part of Spec 6** (see that spec's Risk #3) — Spec 6 is sequenced earlier in the build order and its own categories couldn't wait for this spec. By the time this spec is implemented, `applyMode` already exists on `CustomizationOption`; this spec only adds new `ACCESSORY`/`PACKAGE` rows that populate it, with no migration of its own.

Seed data for this spec's `ACCESSORY`/`PACKAGE` rows sets `applyMode` explicitly per option based on what SRS §11 describes: `MESH_VISIBILITY` for a sport exhaust tip, `MATERIAL_SWAP` for carbon mirror caps and a carbon roof, and whichever mode fits each package's own visual effect.

### Migration

- **Name:** none owned by this spec — see above; `AddApplyModeToCustomizationOption` is Spec 6's migration.
- **Reversible:** N/A here.
- **Backfill required:** N/A here — this spec only inserts new seed rows with `applyMode` set at creation time, no backfill of existing rows.
- **Downtime:** none.
- **Reviewed SQL:** N/A — see Spec 6.

### Retention and privacy

No change — `applyMode` is catalog metadata, not personal data.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | skeleton toggle placeholders while the vehicle's catalog is fetched (same request as the showroom's own load) |
| **Empty** | if a vehicle has zero seeded accessories or packages, that category's section is hidden entirely rather than shown empty — an empty section with no explanation would look broken on a two-vehicle catalog where this shouldn't normally happen, but the UI should not assume a non-zero count |
| **Error** | not applicable independently — covered by the showroom's own error state (Spec 5) |
| **Success** | toggles render and respond immediately per AC-2 through AC-5 |

Also specify:
- **Validation:** none — every accessory/package is independently valid; there is no mutual-exclusivity or dependency logic between them in Phase 1 (see Risk #1).
- **Keyboard/screen-reader:** covered by AC-7.
- **Responsive:** same panel placement pattern as exterior/interior panels — fixed sidebar on desktop, bottom sheet on mobile.
- **Permission-gated content:** none — guest mode (SRS §36.5).

**Route(s):** integrated into `/configure/[slug]` (Spec 5) — adds an accessories/packages tab alongside exterior and interior, not a new route.
**Directory:** `frontend/src/components/configurator/AccessoriesPanel/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | configuration store's multi-select toggle logic (add/remove from `ACCESSORY`/`PACKAGE` arrays, no duplicates) — extends Spec 6's store tests | `frontend/tests/state/configurationStore.test.ts` |
| **Unit** | `applyMode` dispatch: routes each option to the correct 3D update function (visibility vs. material swap vs. variant swap) | `frontend/tests/showroom/applyModeDispatch.test.ts` |
| **Component** | panel renders both categories as toggles, active state and `aria-pressed` reflect store state, keyboard navigation | `frontend/tests/configurator/AccessoriesPanel.test.tsx` |
| **E2E** | toggle a visibility accessory on/off, toggle a material-swap accessory on/off, activate several at once, assert price and 3D state all track correctly | `frontend/e2e/accessories-packages.spec.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1, AC-7 | `AccessoriesPanel.test.tsx` |
| AC-2 | `applyModeDispatch.test.ts` + `accessories-packages.spec.ts :: visibility toggle` |
| AC-3 | `applyModeDispatch.test.ts` + `accessories-packages.spec.ts :: material swap toggle` |
| AC-4 | `configurationStore.test.ts` + `accessories-packages.spec.ts :: price and summary update` |
| AC-5 | `accessories-packages.spec.ts :: multiple active simultaneously` |
| AC-6 | `applyModeDispatch.test.ts :: missing asset mapping warns, does not throw` |

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** any cross-option dependency/conflict rules (e.g. a package requiring a specific wheel) — explicitly out of scope, see §7.

---

## 7. Out of scope

- Any bundling logic where selecting a package auto-selects or locks other options (e.g. "Performance Package requires Sport Wheels"). SRS §12's pricing example treats packages as flat additive line items, not conditional bundles, so Phase 1 keeps every accessory/package fully independent. Revisit only if a real bundling requirement is stated explicitly.
- Persisting a configuration (Spec 10).
- The build summary display itself (Spec 9) — this spec only ensures the active-items data it needs is available in the store.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Should packages be allowed to bundle/require other options (e.g. Performance Package forcing Sport wheels), matching how real configurators often work? | Product owner | Resolved for Phase 1 — no, treated as flat independent line items per SRS §12's own pricing example. Open for reconsideration in a later phase if desired. |
| 2 | Same placeholder-asset dependency as prior specs, compounded here: `MESH_VISIBILITY` accessories specifically require the chosen GLB to already contain the optional part (e.g. an exhaust tip mesh) even while hidden, which is a stronger asset requirement than the material-swap-only categories. | Product owner | Open — blocking for `MESH_VISIBILITY` accessories specifically; `MATERIAL_SWAP` accessories can ship against the same placeholder asset already required by Spec 2 Risk #1 without additional geometry. |
| 3 | SRS §7's `CARBON_COMPONENT` (Spec 6, single-select coarse carbon trim tier) overlaps in subject matter with this spec's individual "Carbon Mirror Caps"/"Carbon Roof" `ACCESSORY` toggles from SRS §11 — a user could reach a similar visual result two different ways. | Product owner | Resolved — see Spec 2 Risk #4. The two are intentionally independent and not bundled/mutually exclusive in Phase 1; this is an accepted overlap in the SRS's own taxonomy rather than a defect in this schema. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** ships after Spec 2's initial migration and Spec 6's `ApplyMode`/`customPaintHex` migrations — this spec adds no migration of its own, only seed rows.
- **Rollback:** remove the accessories/packages panel and its seed rows; showroom continues working with exterior and interior customization only (Spec 6's `ApplyMode` column remains, since its own categories depend on it).
- **Observability:** the AC-6 missing-asset console warning should be promoted to real structured logging once Phase 3 monitoring (§34.2) exists, so gaps in asset coverage are visible without opening dev tools.

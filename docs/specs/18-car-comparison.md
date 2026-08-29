# Spec: Car Comparison

**File:** `docs/specs/18-car-comparison.md`
**Status:** Approved
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §20 (Car Comparison); depends on `02-vehicle-catalog-data-model.md`, `05-3d-showroom-core.md`, `13-navigation-scroll-shell.md` (Compare nav placeholder), `12-loading-error-a11y-shell.md`

---

## 1. Problem statement

**Today:** The nav bar has reserved a place for "Compare" since Spec 13, shown disabled with a "Coming Soon" affordance. SRS §20 wants a real comparison view: a spec-for-spec table between two vehicles, and, where feasible, an interactive 3D side-by-side.

**Who is affected:** Any user deciding between the catalog's vehicles (currently Apex GT and Apex RS, with the catalog designed in Spec 2 to grow without code changes).

**Why it matters now:** It's the last Phase 2 spec — after this, every SRS §2 journey step (landing → explore → select → showroom → customize → AI → price → review → save/share → compare) has a real, approved spec behind it.

**Success looks like:** A user picks any two vehicles from the catalog, sees their key specs side by side exactly like SRS §20's example table, and can optionally switch to a 3D view showing both vehicles together — with a clear path from either straight into that vehicle's configurator.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** `/compare` with no query parameters **When** it loads **Then** it defaults to comparing the first two active vehicles by `sortOrder` (Apex GT vs. Apex RS today), each chosen via a labeled vehicle selector |
| AC-2 | **Given** two vehicles are selected **When** the spec table renders **Then** it shows Power (`horsepower`), 0–100 km/h (`zeroToHundredSec`), Top Speed (`topSpeedKph`), and Starting Price (`basePriceCents`) for both, side by side — matching SRS §20's example table's structure exactly, using only base-vehicle data already in Spec 2's schema (this compares vehicles, not customized builds — see Risk #1) |
| AC-3 | **Given** either selector is changed **When** a different vehicle is chosen **Then** the URL updates to `/compare?left={slugA}&right={slugB}` (making any comparison shareable via link) and the table/3D view update immediately without a full page reload |
| AC-4 | **Given** a vehicle is already selected on one side **When** the user opens the other side's selector **Then** that vehicle is excluded from the second selector's options — comparing a vehicle to itself is prevented, not just discouraged |
| AC-5 | **Given** a "3D View" toggle (default view is the spec table) **When** activated **Then** both vehicles' `showroomModelUrl` GLBs load into one shared scene, side by side in their default configurations, orbitable via a single shared camera (not independent per-vehicle cameras) |
| AC-6 | **Given** WebGL is unavailable or a GLB fails to load in the 3D view **When** this is detected **Then** the view falls back to the spec table only (Spec 12's fallback pattern) — satisfying SRS §20's own "where possible" qualifier rather than presenting a broken 3D view |
| AC-7 | **Given** the nav's "Compare" item (Spec 13, previously disabled) **When** this spec ships **Then** it becomes a real working link to `/compare`, and its "Coming Soon" affordance is removed |
| AC-8 | **Given** `prefers-reduced-motion` **When** the 3D view is active **Then** idle rotation is disabled per Spec 12's `withReducedMotion` contract; the spec table has no motion to begin with |
| AC-9 | **Given** a keyboard-only or screen-reader user **When** using `/compare` **Then** both vehicle selectors are operable via keyboard, and the spec table uses proper `<th scope="col">`/`<th scope="row">` semantics so screen readers can announce which value belongs to which vehicle and which metric |
| AC-10 | **Given** a narrow viewport **When** the spec table renders **Then** it remains usable — either by stacking the two vehicles' columns vertically or by scrolling horizontally within its own container, never causing the page itself to scroll horizontally |
| AC-11 | **Given** either vehicle in the comparison **When** its "Configure This Vehicle" action is clicked **Then** it navigates to `/configure/{slug}` (Spec 5) — Compare always has a clear next step back into the real configurator |

---

## 3. API contract

No new endpoints. Reuses `GET /api/vehicles` (Spec 2) to populate both selectors and their spec/price data.

### Breaking-change check

- [x] N/A — no new contract.

---

## 4. Data model changes

None — every field this spec displays (`horsepower`, `zeroToHundredSec`, `topSpeedKph`, `basePriceCents`, `showroomModelUrl`) already exists on `Vehicle` (Spec 2).

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | selectors and table show skeleton placeholders while `GET /api/vehicles` resolves |
| **Empty** | not applicable — the catalog always has at least the two seeded vehicles |
| **Error** | vehicle list fetch failure shows Spec 12's generic error state with retry; a 3D view load failure falls back per AC-6 without treating it as a page-level error |
| **Success** | table and, optionally, 3D view render per AC-2/AC-5 |

Also specify:
- **Validation:** none — selectors only ever offer valid, existing vehicles.
- **Keyboard/screen-reader:** AC-9.
- **Responsive:** AC-10; the 3D view toggle stacks above the scene on mobile rather than sitting beside it.
- **Permission-gated content:** none — guest mode (SRS §36.5); comparison requires no account.

**Route(s):** `/compare`
**Directory:** `frontend/src/app/compare/`, `frontend/src/components/compare/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | default-pair selection, mutual-exclusion logic between the two selectors (AC-4), URL query-param sync | `frontend/tests/compare/compareState.test.ts` |
| **Component** | spec table renders correct values and semantics, 3D-view WebGL-failure fallback, reduced-motion behavior | `frontend/tests/compare/CompareView.test.tsx` |
| **E2E** | load `/compare` with defaults → change one selector → assert URL and table update → toggle 3D view → assert both models load → click "Configure This Vehicle" → arrives at the right showroom | `frontend/e2e/car-comparison.spec.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1, AC-4 | `compareState.test.ts` |
| AC-2 | `CompareView.test.tsx :: spec table values` |
| AC-3 | `car-comparison.spec.ts :: URL sync` |
| AC-5, AC-6, AC-8 | `CompareView.test.tsx :: 3D view` |
| AC-7 | `frontend/tests/shell/Nav.test.tsx` (Spec 13's suite, updated) |
| AC-9, AC-10 | `car-comparison.spec.ts` keyboard/mobile-viewport passes |
| AC-11 | `car-comparison.spec.ts :: configure CTA` |

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** visual regression of the 3D side-by-side layout — spot-checked manually, consistent with how every other 3D-touching spec in this index treats visual QA.

---

## 7. Out of scope

- Comparing two customized builds (e.g. two saved configurations) rather than two base vehicles — SRS §20's own example table only compares base specs, so that's this spec's scope; comparing full builds is a plausible future enhancement, not requested here.
- More than two vehicles at once — SRS §20 says "compare two vehicles," singular pair.
- Any 3D customization within the comparison view (paint/wheels/etc.) — both vehicles show only their default configuration; if a user wants to compare customized builds, they use two browser tabs against `/configure/[slug]` today.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | SRS §20 sits right after §12–19's customization/pricing/build-summary flow, which could be read as implying comparison should include a user's actual customized builds, not just base vehicles. | Product owner | Resolved — SRS §20's own worked example only shows base-vehicle specs and starting prices, no customization, so that's the literal scope implemented here. A "compare two of my saved builds" feature is a reasonable follow-up but would need its own spec (different data source: `Configuration` rows via Spec 17's My Garage, not `Vehicle` rows). |
| 2 | Loading two full vehicle GLBs into one scene simultaneously for the 3D view (AC-5) is a heavier load than the single-vehicle showroom (Spec 5) — worth confirming this stays within SRS §26's performance expectations, especially on mobile. | Implementer | Open — a performance check during implementation; the AC-6 fallback exists partly as a safety valve if this proves too heavy on some devices, not only for outright WebGL absence. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A — no schema.
- **Rollback:** revert Spec 13's nav item back to its disabled "Coming Soon" state and remove the `/compare` route; nothing else depends on this spec.
- **Observability:** none beyond what Spec 5/12 already provide.

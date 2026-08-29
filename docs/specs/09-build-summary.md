# Spec: Build Summary Panel

**File:** `docs/specs/09-build-summary.md`
**Status:** Approved
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §17 (Build Summary); depends on `02-vehicle-catalog-data-model.md`, `03-dynamic-pricing-engine.md`, `06-exterior-customization.md` (configuration store), `07-interior-customization.md`, `08-accessories-packages.md`

---

## 1. Problem statement

**Today:** A user can select options across nine exterior categories, seven interior categories, and any number of accessories/packages (Specs 6–8), and the total price is computed correctly (Spec 3), but nothing shows the user a single, readable "here is what you've built" view. SRS §17 calls this the "Your Build" panel.

**Who is affected:** Every user assembling a configuration — this is how they confirm what they've actually chosen before moving on to save/share (Spec 10) or capturing an image (Spec 11).

**Why it matters now:** Spec 10 (save/share) and Spec 11 (screenshot) both need a finished, reusable summary view rather than building their own; this spec is where that view is defined once.

**Success looks like:** At any point while configuring, a user can glance at the build summary and see the vehicle, every meaningfully-changed option, and an accurate total — never a stale or partially-updated number.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a configuration in progress **When** the summary panel renders **Then** it shows, in order: the vehicle name, the current exterior color (or "Custom Color" with its hex, per AC-2), the current wheels, and the current interior overall finish — always shown regardless of whether they're at their default, since these four identify the build |
| AC-2 | **Given** the selected `PAINT` option is the reserved `CUSTOM_COLOR` entry **When** the summary renders the exterior line **Then** it shows "Custom Color" with a small swatch of the stored `customPaintHex`, not the catalog option's generic name |
| AC-3 | **Given** any single-select category *other than* paint/wheels/interior-finish currently holds a non-default option, or a default option with a non-zero price **When** the summary renders **Then** that category appears as its own line (e.g. "Brake Calipers: Red", "Spoiler: Carbon Spoiler") — categories left at a free "None"/"Standard" default do not clutter the list |
| AC-4 | **Given** zero accessories and zero packages are active **When** the summary renders **Then** it shows "Accessories: None" and "Packages: None" rather than omitting those sections — an intentionally empty choice is still shown, not hidden |
| AC-5 | **Given** one or more accessories or packages are active **When** the summary renders **Then** each active one is listed individually by name |
| AC-6 | **Given** any selection changes anywhere in the configurator **When** the change is applied **Then** the summary panel (line items and total) updates within the same render pass, using the same local pricing calculation as Spec 3 — no network round trip |
| AC-7 | **Given** the summary panel **When** the total price updates **Then** it is wrapped in an `aria-live="polite"` region so screen-reader users hear the new total without it being announced on every intermediate keystroke of unrelated UI |
| AC-8 | **Given** the summary panel **When** displayed **Then** base price, each line item's price delta (only for non-zero deltas), and the total are all formatted via `Intl.NumberFormat` for the vehicle's `currency`, never a raw cents integer |

---

## 3. API contract

No new endpoints. Pure presentational consumer of the configuration store (Spec 6) and the frontend pricing function (Spec 3). No server round trip.

### Breaking-change check

- [x] N/A — no new contract.

---

## 4. Data model changes

None — presentational only.

### Summary line-item derivation (canonical definition — reused by Specs 10 and 11)

```ts
// frontend/src/lib/showroom/buildSummary.ts
export interface BuildSummaryLine {
  category: OptionCategory;
  label: string;        // human-readable category name, e.g. "Brake Calipers"
  optionName: string;   // e.g. "Red", or "Custom Color" per AC-2
  priceDeltaCents: number;
  swatchColor?: string; // for color-bearing categories
}

export function deriveBuildSummary(
  vehicle: VehicleDetailDto,
  singleSelections: Record<SingleSelectCategory, string>,
  multiSelections: Record<MultiSelectCategory, string[]>,
  customPaintHex: string | null,
): {
  alwaysShown: BuildSummaryLine[];   // PAINT, WHEELS, INTERIOR_MATERIAL — per AC-1
  conditionalLines: BuildSummaryLine[]; // per AC-3
  accessories: BuildSummaryLine[];   // per AC-4/AC-5
  packages: BuildSummaryLine[];      // per AC-4/AC-5
  breakdown: PriceBreakdownDto;      // from Spec 3's local calculation
};
```

One function, called by this spec's panel, by Spec 10's save/share review screen, and by Spec 11's captured-image renderer, so all three surfaces are guaranteed to agree on what counts as "worth showing."

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | not applicable — the summary only renders once the showroom's vehicle data (and therefore a valid configuration) already exists |
| **Empty** | not applicable to the panel as a whole (a configuration always has a vehicle and defaults); "Accessories: None" / "Packages: None" per AC-4 is the empty state for those two sub-sections specifically |
| **Error** | not applicable independently — inherits the showroom's error state (Spec 5) |
| **Success** | line items and total render and update live per AC-6 |

Also specify:
- **Validation:** none — purely derived/display data.
- **Keyboard/screen-reader:** AC-7's `aria-live="polite"` region for the total; the panel itself is a labeled region (`aria-label="Your build summary"`) reachable in document order without requiring 3D scene interaction.
- **Responsive:** desktop shows the summary as a persistent panel (e.g. below or alongside the customization tabs); mobile shows it as a collapsible section that can be expanded from the bottom sheet, so it doesn't permanently consume vertical space on small screens.
- **Permission-gated content:** none — guest mode (SRS §36.5).

**Route(s):** integrated into `/configure/[slug]` (Spec 5) — not a new route.
**Directory:** `frontend/src/components/configurator/BuildSummary/`, `frontend/src/lib/showroom/buildSummary.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | `deriveBuildSummary`: always-shown lines present regardless of default; conditional lines appear only when non-default or priced; custom color handling; accessories/packages empty-state strings | `frontend/tests/showroom/buildSummary.test.ts` |
| **Component** | panel renders derived lines, `aria-live` region present, currency formatting | `frontend/tests/configurator/BuildSummary.test.tsx` |
| **E2E** | change several options across categories, including toggling an accessory and reverting a non-default caliper color back to default; assert the summary's visible lines and total match expectations at each step | `frontend/e2e/build-summary.spec.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1, AC-2 | `buildSummary.test.ts :: always-shown lines` |
| AC-3 | `buildSummary.test.ts :: conditional line inclusion` |
| AC-4, AC-5 | `buildSummary.test.ts :: accessories and packages` |
| AC-6 | `build-summary.spec.ts :: live updates` |
| AC-7 | `BuildSummary.test.tsx :: aria-live region` |
| AC-8 | `BuildSummary.test.tsx :: currency formatting` |

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** none beyond the usual visual-regression exclusion already noted in Specs 6–8.

---

## 7. Out of scope

- Persisting the summarized configuration (Spec 10) — this spec only derives and displays it.
- Rendering the summary into a captured image (Spec 11) — that spec reuses `deriveBuildSummary` but owns its own rendering surface (canvas/image composition).
- Editing selections from within the summary panel (e.g. clicking a summary line to jump to that category's panel) — a nice-to-have not requested by the SRS; can be added later without a spec change if desired, since it wouldn't alter this spec's data contract.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | SRS §17's own example always lists Exterior/Wheels/Interior/Accessories/Total regardless of whether any option is at a default — this spec instead hides default, zero-price selections outside of the three "always shown" anchors (AC-1/AC-3), to avoid a 16-line summary once every exterior and interior category is included. | Product owner | Resolved — accepted as the better reading of the SRS's *intent* (a concise, scannable summary) over its literal example, which predates the corrected 18-category catalog. Revisit if user testing shows people expect to see every category explicitly. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A — no schema.
- **Rollback:** remove the summary panel component; configuration and pricing continue working without a consolidated view.
- **Observability:** none beyond what Spec 5/12 already provide.

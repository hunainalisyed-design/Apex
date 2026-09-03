# Spec: Dynamic Pricing Engine

**File:** `docs/specs/03-dynamic-pricing-engine.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §12 (Dynamic Pricing); depends on `02-vehicle-catalog-data-model.md` (SINGLE_SELECT_CATEGORIES / MULTI_SELECT_CATEGORIES, 18-category enum)

---

## 1. Problem statement

**Today:** The catalog data model (Spec 2) stores a `priceDeltaCents` on every option, but nothing computes a total from a set of selections. Every customization spec (exterior, interior, accessories) and the build summary and save/share specs all need "the current total price" — if each computed it independently, prices could drift from what the 3D scene actually shows, which SRS §12 explicitly forbids: "pricing cannot become inconsistent with the selected options."

**Who is affected:** Every screen that shows a price (customization panels, build summary, save/share, eventually the AI assistant's recommendation cards).

**Why it matters now:** This must exist before Specs 6–8 (exterior/interior/accessories) are built, since those specs' acceptance criteria assume "the price updates immediately whenever the configuration changes" already works.

**Success looks like:** Given any valid combination of one vehicle and its selected options, there is exactly one formula, expressed once on the backend as the authoritative source and mirrored by an identical, fixture-tested formula on the frontend for instant UI feedback, that always produces the same total.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a vehicle and one option selected for every category in `SINGLE_SELECT_CATEGORIES` (16 categories per Spec 2, covering both exterior §7 and interior §10 items — never fewer) **When** price is calculated **Then** total = `basePriceCents + Σ priceDeltaCents` of every selected option, returned with a per-option line-item breakdown |
| AC-2 | **Given** the same inputs plus one or more `ACCESSORY`/`PACKAGE` selections **When** price is calculated **Then** their `priceDeltaCents` are included in the sum and appear as separate line items |
| AC-3 | **Given** an option id that does not belong to the requested vehicle **When** price is calculated **Then** the API returns `422` with code `OPTION_VEHICLE_MISMATCH` and computes nothing |
| AC-4 | **Given** a request missing a selection for any category in `SINGLE_SELECT_CATEGORIES` **When** price is calculated **Then** the API returns `400` with code `VALIDATION_ERROR` naming the missing category — the server never silently substitutes a default, even for categories like spoiler or body package where the substituted default would itself be a "None" option |
| AC-5 | **Given** a duplicate option id within the same `ACCESSORY` or `PACKAGE` array **When** price is calculated **Then** the API returns `422` with code `DUPLICATE_OPTION_SELECTION` |
| AC-6 | **Given** the frontend's local pricing calculation and the backend's `/api/pricing/calculate` response for the identical selection **When** compared in the shared fixture test suite **Then** they are always equal to the cent |
| AC-7 | **Given** a user changes any single selection in the UI **When** the change is applied **Then** the displayed total updates within one render frame, using the frontend's local calculation, with no network round trip required for the number to appear |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/pricing/calculate` | none | `200` `ApiResponse<PriceBreakdownDto>` | stateless — does not persist anything; authoritative recalculation used before every save (Spec 10) |

### Request and response DTOs

```ts
// backend/src/types/pricing.ts
import { SINGLE_SELECT_CATEGORIES, MULTI_SELECT_CATEGORIES, OptionCategory } from "./catalog";

type SingleSelectCategory = (typeof SINGLE_SELECT_CATEGORIES)[number]; // 16 categories, see Spec 2
type MultiSelectCategory = (typeof MULTI_SELECT_CATEGORIES)[number];  // ACCESSORY, PACKAGE

export interface PriceCalculationRequest {
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>; // exactly one CustomizationOption id per category
  multiSelections: Record<MultiSelectCategory, string[]>; // zero or more ids per category
}

export interface PriceLineItemDto {
  optionId: string;
  category: OptionCategory;
  name: string;
  priceDeltaCents: number;
}

export interface PriceBreakdownDto {
  vehicleSlug: string;
  basePriceCents: number;
  lineItems: PriceLineItemDto[];
  totalPriceCents: number;
  currency: string;
}
```

`singleSelections` is a `Record` rather than 16 named scalar fields — Spec 2's catalog grew from 5 to 16 single-select categories once it was corrected to match SRS §7/§10 item-by-item, and naming each as its own field would make this DTO unwieldy and require editing this spec every time the catalog gains a category. `SINGLE_SELECT_CATEGORIES`/`MULTI_SELECT_CATEGORIES` (defined once in Spec 2) are the single source of truth both frontend and backend iterate over to validate completeness — a caller cannot silently omit a required category and have TypeScript miss it, since `Record<SingleSelectCategory, string>` requires every key; the backend still validates at runtime since it cannot trust the wire payload.

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | request shape invalid, or a required single-select category is missing/empty |
| `404` | `VEHICLE_NOT_FOUND` | `vehicleSlug` does not match an active vehicle |
| `422` | `OPTION_VEHICLE_MISMATCH` | a submitted option id exists but belongs to a different vehicle |
| `422` | `DUPLICATE_OPTION_SELECTION` | the same option id appears twice within `ACCESSORY` or `PACKAGE` |

### Breaking-change check

- [x] First version of this contract.

---

## 4. Data model changes

None — this spec is pure computation over Spec 2's existing tables. It reads `Vehicle` and `CustomizationOption`; it writes nothing.

### Migration

N/A.

### Retention and privacy

N/A — stateless calculation, no data stored.

---

## 5. UI states

This spec's only UI surface is the price display itself, consumed inside other specs' panels (exterior/interior/accessories/build summary). Those specs own their own loading/empty/error/success states; this spec defines the shared display contract:

| State | Behaviour |
|---|---|
| **Calculating (local)** | none needed — the local calculation is synchronous and instant per AC-7 |
| **Calculating (server, at save time only)** | the consuming screen (Spec 10) shows its own loading affordance while `POST /api/pricing/calculate` runs as a pre-save authoritative check |
| **Mismatch detected** | if the server recalculation at save time ever differs from the locally displayed total (should never happen per AC-6, but defensively handled), show the server's number and a toast: "Price was updated to reflect current option pricing" — never silently save a stale total |
| **Error** | server calculation error at save time surfaces the `code`-derived message per the shared error-handling pattern (Spec 12) |

**Route(s):** none of its own — a shared module (`frontend/src/lib/pricing.ts`) imported by consuming screens.

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | backend calculation function: sum correctness, missing-category rejection, mismatched-vehicle rejection, duplicate rejection | `backend/tests/pricing.test.ts` |
| **Unit** | frontend calculation function: identical cases mirrored | `frontend/tests/lib/pricing.test.ts` |
| **Contract (shared fixtures)** | a single JSON fixture file of (selections → expected total) cases is run against *both* the frontend and backend calculation functions, so they cannot silently diverge | `fixtures/pricing-cases.json`, consumed by both test files above |
| **Integration** | `POST /api/pricing/calculate` round trip including all error codes | `backend/tests/integration/pricing.int.test.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1, AC-2 | `pricing.test.ts :: sums line items correctly` |
| AC-3 | `pricing.int.test.ts :: 422 OPTION_VEHICLE_MISMATCH` |
| AC-4 | `pricing.int.test.ts :: 400 VALIDATION_ERROR on missing category` |
| AC-5 | `pricing.int.test.ts :: 422 DUPLICATE_OPTION_SELECTION` |
| AC-6 | `fixtures/pricing-cases.json` run against both `pricing.test.ts` and `lib/pricing.test.ts` |
| AC-7 | frontend component test asserting no `await`/network call occurs between a selection change and the displayed total updating |

**Coverage:** ≥80% on new code — pricing is financial logic and should be near 100% in practice.

**Not covered, deliberately:** currency conversion — the entire system is single-currency (EUR) for Phase 1; multi-currency is Phase 3 i18n (§34.6). The AC-7 "component test asserting no `await`/network call occurs between a selection change and the displayed total updating" is also deferred — this spec has no UI screen of its own (§5), and no consuming screen exists until Spec 06, so there is nothing to mount that test against yet. AC-7 is instead verified structurally here (`calculatePrice` is synchronous, exercised without `await` in both `pricing.test.ts` files); Spec 06 should add the deferred component-level assertion when it wires the first real selection UI to this module.

---

## 7. Out of scope

- Persisting a calculated price (that's Spec 10, Save/Share — it calls this engine, then stores the result).
- Any AI-driven pricing suggestions (Phase 2, AI assistant specs) — CarAI recommends *options*, this engine prices whatever is selected regardless of who selected it.
- Discounts, promo codes, taxes — not mentioned anywhere in the SRS; treat as genuinely out of scope unless requested later.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Duplicating the calculation formula in both frontend and backend (rather than a shared package) risks drift if one is edited without the other. | Product owner | Resolved — accepted, mitigated by the shared-fixture contract test (AC-6) rather than a code-sharing abstraction, since the formula is a single sum and not worth a workspace/package for two call sites. Revisit if the formula grows materially more complex. |
| 2 | Should the server ever apply defaults for a missing category instead of rejecting? | Product owner | Resolved — no (AC-4). The frontend is responsible for always sending a complete selection (it has vehicle defaults available from Spec 2's `isDefault` flags); a missing category from the frontend indicates a client bug that should be surfaced, not silently patched. |
| 3 | The request DTO changed from named scalar fields per category to a `Record<SingleSelectCategory, string>` after Spec 2's catalog review grew the category count from 5 to 16. | Product owner | Resolved — accepted; the record shape is what makes the DTO scale with the catalog without repeated spec edits, at the minor cost of losing per-field autocomplete compared to named fields. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A, no schema.
- **Rollback:** remove the endpoint and shared module; nothing else has shipped yet that depends on it being present in production.
- **Observability:** log every `422`/`400` on `/api/pricing/calculate` with the offending payload (minus nothing sensitive — there is no PII in this payload) to catch frontend/backend drift early.

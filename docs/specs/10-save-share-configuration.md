# Spec: Save / Load / Share Configuration (Guest Mode)

**File:** `docs/specs/10-save-share-configuration.md`
**Status:** Approved
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §18 (Save Configuration), §36.5 (Guest Mode); depends on `02-vehicle-catalog-data-model.md` (`Configuration`/`ConfigurationSelection`), `03-dynamic-pricing-engine.md`, `06-exterior-customization.md` (configuration store), `09-build-summary.md` (`deriveBuildSummary`)

---

## 1. Problem statement

**Today:** A user can assemble a full configuration in the browser (Specs 6–9), but it exists only in memory — refreshing the page loses it, and there is no way to send a build to anyone else. SRS §18 requires save, load, reset, a generated shareable ID, and ID copying, all without requiring an account (SRS §36.5: guest mode covers this explicitly).

**Who is affected:** Every user who wants to keep or share a build — without this, the product's core loop (configure → save/share) is incomplete regardless of how good the 3D and pricing are.

**Why it matters now:** It's the last piece needed to close SRS §2's user journey end-to-end for Phase 1 (guest mode, no AI yet).

**Success looks like:** A user clicks Save, gets an ID like `APEX-7F82-K91X`, shares the link, and someone opening that link — on any device, with no account — sees the exact same vehicle, options, and price the original user built.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a configuration in progress **When** the user clicks "Save" **Then** the frontend sends the full current selection state to `POST /api/configurations`, the server authoritatively recalculates the price (Spec 3) before persisting, and the response includes a generated `publicId` (format `XXXX-YYYY-ZZZZ`, e.g. `APEX-7F82-K91X`) shown to the user |
| AC-2 | **Given** a valid `publicId` **When** `GET /api/configurations/:publicId` is called **Then** it returns the exact vehicle and every selection as originally saved, sufficient to recreate the identical build with no data loss |
| AC-3 | **Given** an unknown or malformed `publicId` **When** requested **Then** the API returns `404` with code `CONFIGURATION_NOT_FOUND` |
| AC-4 | **Given** a URL of the form `/configure/{slug}?build={publicId}` **When** the showroom loads **Then** the configurator hydrates every selection from that saved configuration instead of the vehicle's defaults |
| AC-5 | **Given** a `publicId` that belongs to a different vehicle than the `{slug}` in the URL **When** the page loads **Then** the app redirects to the correct `/configure/{actualSlug}?build={publicId}` rather than showing a mismatched or broken state — the `publicId` is the source of truth for which vehicle to show |
| AC-6 | **Given** a saved build **When** the user clicks "Copy Configuration ID" **Then** the raw `publicId` is copied to the clipboard and a confirmation toast appears |
| AC-7 | **Given** a saved build **When** the user clicks "Share" **Then** the full shareable URL (`/configure/{slug}?build={publicId}`) is copied to the clipboard |
| AC-8 | **Given** a configuration in progress (saved or not) **When** the user clicks "Reset" **Then** every selection reverts to the vehicle's defaults in the local store — this never deletes any already-saved `Configuration` row on the server |
| AC-9 | **Given** the save request completes **When** the response is received **Then** the summary/price shown to the user reflects the server's authoritative recalculation, not the pre-save local estimate, even though the two should always match per Spec 3 AC-6 |
| AC-10 | **Given** the save request fails (network error or server error) **When** this happens **Then** the user sees an error per Spec 12's pattern and their in-progress selections remain exactly as they were — nothing is lost or reset on a failed save |
| AC-11 | **Given** a guest (unauthenticated) save **When** the `Configuration` row is created **Then** it is stamped with an `expiresAt` 90 days out; **given** that build is later loaded again via its `publicId` **when** it is loaded **then** `expiresAt` is refreshed to another 90 days out, so actively-shared builds don't expire out from under people still viewing them |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/configurations` | none (guest) | `201` `ApiResponse<SavedConfigurationDto>` | recalculates and persists |
| `GET` | `/api/configurations/:publicId` | none | `200` `ApiResponse<SavedConfigurationDto>` | also refreshes `expiresAt` per AC-11 |

### Request and response DTOs

```ts
// backend/src/types/configuration.ts

export interface SaveConfigurationRequest {
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
  customPaintHex: string | null;
}

export interface SavedConfigurationDto {
  publicId: string;              // e.g. "APEX-7F82-K91X"
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
  customPaintHex: string | null;
  breakdown: PriceBreakdownDto;  // from Spec 3, computed server-side at save time
  createdAt: string;             // ISO 8601
}
```

`publicId` generation: a 4-letter prefix derived from the vehicle's name (e.g. "APEX" for both Apex GT and Apex RS, since SRS's own example ID doesn't disambiguate trim), followed by two 4-character segments drawn from a 32-character alphabet that excludes visually ambiguous characters (`0`/`O`, `1`/`I`/`L`). Generation retries on the rare unique-constraint collision (`publicId` is unique per Spec 2's schema).

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `404` | `CONFIGURATION_NOT_FOUND` | `publicId` doesn't exist |
| `400` | `VALIDATION_ERROR` | reused from Spec 3 — malformed selection shape |
| `404` | `VEHICLE_NOT_FOUND` | reused from Spec 2/3 — `vehicleSlug` invalid |
| `422` | `OPTION_VEHICLE_MISMATCH` | reused from Spec 3 — an option id belongs to a different vehicle |
| `422` | `DUPLICATE_OPTION_SELECTION` | reused from Spec 3 |

`POST /api/configurations` internally calls Spec 3's calculation function rather than duplicating its validation — a save is rejected under exactly the same conditions a price calculation would be.

### Breaking-change check

- [x] First version of this contract.

---

## 4. Data model changes

### Entities

| Entity | Change | Fields |
|---|---|---|
| `Configuration` (from Spec 2) | modified | add `expiresAt: DateTime?` (nullable — null means "never expires," reserved for Phase 2 account-owned builds once `userId` is set) |

`Configuration.publicId` and the `ConfigurationSelection` join rows already exist per Spec 2's schema; this spec is the first to actually populate them. Saving writes: one `Configuration` row (`vehicleSlug`, `totalPriceCents` from the server recalculation, `customPaintHex`, `expiresAt`) plus one `ConfigurationSelection` row per selected option (16 single-select + however many accessories/packages are active).

### Migration

- **Name:** `AddExpiresAtToConfiguration`
- **Reversible:** yes — drop the nullable column.
- **Backfill required:** no.
- **Downtime:** none.
- **Reviewed SQL:** to be pasted once generated.

### Retention and privacy

This resolves Spec 2's Risk #3 (guest `Configuration` rows had no lifecycle policy): guest builds (`userId IS NULL`) expire 90 days after last access via `expiresAt`, refreshed on every load (AC-11). A scheduled cleanup job that deletes expired rows is Phase 3 work (§34.2, once CI/CD and background job infrastructure exist) — this spec only ensures the column and the refresh-on-load behavior exist so that cleanup job has something correct to act on later. No personal data is stored in a guest `Configuration` row (no name, email, or IP), so the retention policy exists for storage hygiene, not privacy compliance — Phase 2's account-owned builds (`userId` set) will need their own retention conversation as part of that spec.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | "Save" button shows a spinner and is disabled for the duration of the request; loading a shared build via `?build=` shows the showroom's existing loading state (Spec 5) while the configuration is fetched alongside the vehicle |
| **Empty** | not applicable |
| **Error** | save failure shows an inline error near the Save button ("Something went wrong while saving your configuration" per SRS §28) with a retry affordance; load failure (AC-3) shows a dedicated "This build could not be found" state with a link to start a new configuration |
| **Success** | save success shows the generated ID prominently with Copy ID and Share actions (AC-6/AC-7); a toast confirms each copy action |

Also specify:
- **Validation:** none client-side beyond what's already guaranteed by the configuration store always holding a complete selection.
- **Keyboard/screen-reader:** Save/Copy ID/Share/Reset are all real buttons, focusable and operable via Enter/Space; the generated ID is presented as selectable text, not only as an image.
- **Responsive:** the save/share controls live in or beside the build summary panel (Spec 9) on both desktop and mobile.
- **Permission-gated content:** none of this requires auth in Phase 1 (SRS §36.5); Phase 2's auth spec will add an option to "claim" a guest build by setting its `userId`, but that is out of scope here.

**Route(s):** `/configure/[slug]` gains a `?build={publicId}` query parameter (Spec 5's existing route, not a new one).
**Directory:** `frontend/src/components/configurator/SaveSharePanel/`, `backend/src/routes/configurations.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | `publicId` generation format and collision retry | `backend/tests/configurations.test.ts` |
| **Integration** | `POST /api/configurations` round trip (success + every error code), `GET /:publicId` round trip, `expiresAt` refresh on load | `backend/tests/integration/configurations.int.test.ts` |
| **Component** | save/share panel states (loading, error, success with copy actions) | `frontend/tests/configurator/SaveSharePanel.test.tsx` |
| **E2E** | build a configuration → Save → copy ID → open `?build=` URL in a fresh session → assert identical vehicle/selections/price render; also test the vehicle-slug-mismatch redirect (AC-5) | `frontend/e2e/save-share.spec.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1, AC-9 | `configurations.int.test.ts :: POST creates and recalculates` |
| AC-2 | `save-share.spec.ts :: load recreates identical build` |
| AC-3 | `configurations.int.test.ts :: 404 CONFIGURATION_NOT_FOUND` |
| AC-4, AC-5 | `save-share.spec.ts :: query param hydration and mismatch redirect` |
| AC-6, AC-7 | `SaveSharePanel.test.tsx :: copy actions` |
| AC-8 | `save-share.spec.ts :: reset does not delete saved row` |
| AC-10 | `SaveSharePanel.test.tsx :: save failure preserves selections` |
| AC-11 | `configurations.int.test.ts :: expiresAt refresh on GET` |

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** the actual scheduled cleanup job for expired configurations — Phase 3, as noted in §4.

---

## 7. Out of scope

- Any authentication or "claim this build" flow — Phase 2 (SRS §36.4's My Garage lists a user's builds, which requires `userId` to be set; this spec leaves it `null` for every row).
- Screenshot/image capture of a saved build (Spec 11) — that spec produces an image; this spec produces the underlying data it's captured from.
- Any rate limiting on `POST /api/configurations` — flagged as a risk below, not solved here.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | `POST /api/configurations` requires no auth and no rate limiting, so it could be spammed to fill the database with junk rows. | Product owner | Open — recommend a lightweight IP-based rate limit (e.g. N saves per minute) be added at implementation time even though full abuse-monitoring infrastructure is Phase 3 (§34.2); flagged here so it isn't silently skipped. |
| 2 | The `publicId` prefix is derived from vehicle name ("APEX" for both Apex GT and Apex RS) rather than being globally unique-looking per model — matches the SRS's own example exactly, but means the prefix alone doesn't disambiguate trim. | Product owner | Resolved — accepted, matches SRS §18's example ID verbatim; the full `publicId` (prefix + two random segments) is what's actually unique, and the prefix's job is brand flavor, not disambiguation. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** ships after all prior Phase 1 migrations; adds one nullable column.
- **Rollback:** revert the migration and remove the save/share endpoints and panel; the configurator remains fully usable in-session without persistence.
- **Observability:** log save failures and `publicId` collision-retry counts; promote to structured monitoring in Phase 3 (§34.2).

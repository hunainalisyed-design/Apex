# Spec: i18n Readiness & Public API Documentation

**File:** `docs/specs/26-i18n-api-docs.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §34.6 (Polish); depends on `03-dynamic-pricing-engine.md`, `02-vehicle-catalog-data-model.md`

---

## 1. Problem statement

**Today:** All currency/number formatting (Specs 3, 9) uses a hardcoded `Intl.NumberFormat` call with the vehicle's `currency` field but no explicit `locale`, and there is no machine-readable description of the backend's public API. SRS §34.6 wants locale-aware formatting structured for future translation, and public API documentation as both an operational aid and a portfolio artifact.

**Who is affected:** Future work adding a second language or currency display; anyone (including the portfolio's own reviewers) wanting to understand the API surface without reading source code.

**Why it matters now:** It's cheap "polish" per the SRS's own framing, and low-risk to add late since it's additive to already-approved specs rather than changing their behavior.

**Success looks like:** Every price and number in the UI formats correctly if the locale changes, all user-facing strings are structured for translation even though only English ships, and `GET /api/docs` shows a real, accurate OpenAPI document.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** any displayed price or number (Specs 3, 9, 17, 18, 20) **When** rendered **Then** it goes through one shared formatting utility that takes an explicit `locale` (defaulting to `en-EU` or similar) rather than each call site formatting independently |
| AC-2 | **Given** every user-facing string in the frontend **When** authored **Then** it is structured through an i18n library's translation-key mechanism (e.g. `next-intl`) with only an English locale file populated — no UI behavior changes, only the mechanism by which strings are sourced |
| AC-3 | **Given** the backend's public endpoints (catalog, pricing, configurations, AI, auth, leads, reservations — everything with a stable, documented contract across Specs 2–24) **When** `GET /api/docs` is requested **Then** it serves an OpenAPI 3.x document accurately describing them, generated from the same TypeScript types already defined in each spec's DTOs (e.g. via `zod` schemas + `zod-to-openapi`) rather than hand-maintained and prone to drift |
| AC-4 | **Given** the OpenAPI document **When** viewed **Then** a human-readable rendering (e.g. Swagger UI or Redoc) is available at `/api/docs/ui`, not just the raw JSON/YAML |

### How each criterion is implemented

- **AC-1**: `frontend/src/lib/format/` holds three helpers: `formatPriceCents(cents, currency, locale?)`, `formatSavedDate(iso, locale?)`, and the new `formatNumber(value, { locale?, fractionDigits? })`. The existing folder was kept rather than a single `format.ts`, so the 19 existing import sites didn't change. All three default to `DEFAULT_LOCALE` from `frontend/src/i18n/config.ts`, the same constant next-intl uses, so strings and numbers always agree on the locale. The default is **`en-US`** rather than a European locale: it keeps today's output identical, and switching is a one-line change. Horsepower, top speed and 0–100 were previously printed raw on `/models`, the compare table, the 3D fallback and the landing stats band; they now go through `formatNumber`, so 1015 hp reads "1,015". The JSON-LD price's `toFixed(2)` is machine-readable schema.org data, not display text, and deliberately stays as is.
- **AC-2**: `next-intl` in "without i18n routing" mode, so URLs are unchanged and there's no middleware. `src/i18n/request.ts` supplies the locale and messages, the plugin is enabled in `next.config.ts`, `NextIntlClientProvider` wraps the root layout, and strings live in `messages/en-US.json`. `src/i18n/next-intl.d.ts` registers that file as the key catalog, so a typo'd or missing key is a **compile error**. Code outside React (the Zustand stores' `getErrorMessage`) uses the shared `createTranslator` in `src/i18n/translator.ts`, which reads the same file. Migrated per Risk #1's incremental resolution: every backend error message, nav/account links, footer, skip link, loading/app-error/404 screens, 3D fallback, cookie banner, all four auth pages, and every spec unit (hp, km/h, s). Everything else migrates as it's next touched (see `docs/CLAUDE.md`). Visible output is unchanged; the existing component tests, which assert on the English text, all pass.
- **AC-3**: documentation is **generated from the existing TypeScript DTO types, not zod**. The backend validates by hand, so adopting zod would have meant rewriting ~34 routes' validation, or keeping a second copy of every type that could drift. Instead:
  - `npm run openapi:generate` (backend) runs `ts-json-schema-generator` over `src/types/*.ts` and writes the committed `src/openapi/schemas.generated.json`.
  - `src/openapi/routes.ts` lists each endpoint by *type name* only (method, path, auth, request/response types, error codes). `src/openapi/document.ts` combines the list and the schemas into an OpenAPI 3.1 document, built once at startup.
  - Drift is caught by tests: every mounted Express route must be documented or listed in `UNDOCUMENTED_ROUTES` (admin and the Stripe webhook, as internal APIs); no documented route may be stale; every referenced schema must exist; the committed schemas must equal a fresh generation; and real `GET /vehicles` and `GET /health` responses must have exactly the documented fields.
  - Three endpoints had inline response/request shapes; they got named types (`CheckoutSessionDto`, `DeleteAccountRequest`, and `MessageResponseDto` reused for the change-password response). This is type-only, with no behavior change.
- **AC-4**: `swagger-ui-express` serves Swagger UI at `/api/docs/ui/` from the backend's own `node_modules`, with no external CDN.

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/docs` | none | `200` (OpenAPI 3.1 JSON) | documents the 24 public operations; admin + Stripe webhook are excluded as internal |
| `GET` | `/api/docs/ui/` | none | `200` (HTML) | Swagger UI |

`GET /api/vehicles` etc. are unchanged. No new error codes.

### Breaking-change check

- [x] N/A — additive documentation endpoints; AC-1/AC-2 are refactors with no behavior change.

---

## 4. Data model changes

None.

---

## 5. UI states

Not applicable to AC-1/AC-2 (invisible refactors). `/api/docs/ui` is a standard Swagger/Redoc page, out of scope for custom styling.

**Route(s):** `/api/docs`, `/api/docs/ui`
**Directory:** `frontend/src/lib/format/`, `frontend/src/i18n/`, `frontend/messages/`, `backend/src/openapi/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | shared formatting utility with multiple locales produces correct output | `frontend/tests/lib/format.test.ts` |
| **Integration** | generated OpenAPI document validates against the OpenAPI 3.x schema itself, and spot-checks that a few known endpoints (e.g. `POST /api/pricing/calculate`) appear with correct request/response shapes; plus the drift guards listed under AC-3 and the Swagger UI page | `backend/tests/integration/openapi.int.test.ts` |
| **Component** | every existing component test now renders inside the real next-intl provider with the real English catalog (made RTL's default wrapper in `frontend/vitest.setup.ts`) — passing unchanged proves AC-2 changed no visible text | `frontend/tests/**` |
| **Build** | `next build` succeeds and the served pages render the translated text and formatted numbers | manual |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Actually translating any string into a second language — only the mechanism ships, per AC-2.
- Multi-currency support — pricing remains EUR-only; `locale` here affects number/date formatting only, not currency conversion (that would be a pricing-engine change, out of scope, consistent with Spec 3's own original "not covered" note).

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Retrofitting i18n-library string extraction across every already-approved frontend spec (4–18) is a broad, mechanical refactor rather than a contained new feature. | Implementer | Resolved — treat as incremental: new specs/components use the i18n mechanism from the start; existing ones are migrated opportunistically rather than in one disruptive pass, since no user-facing behavior depends on it until a second language actually ships. The shared shell, errors, auth and units were migrated here (see AC-2); still hardcoded: the configurator panels, garage, compare view chrome, CarAI, lead/reservation dialogs, admin, landing sections, and `lib/auth/validation.ts`'s password messages. |
| 2 | Adding the next-intl plugin to `next.config.ts` isn't picked up by an already-running `next dev`: it fails every page with "Couldn't find next-intl config file" until restarted. | Implementer | Documented — restart `npm run dev` once after pulling this change. Production builds are unaffected. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A.
- **Rollback:** revert to direct `Intl.NumberFormat` calls and remove the docs endpoints; no data or behavior depends on this spec.
- **Observability:** none needed.

# Spec: i18n Readiness & Public API Documentation

**File:** `docs/specs/26-i18n-api-docs.md`
**Status:** Draft
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

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/docs` | none | `200` (OpenAPI JSON/YAML) | |
| `GET` | `/api/docs/ui` | none | `200` (HTML) | rendered documentation |

### Breaking-change check

- [x] N/A — additive documentation endpoints; AC-1/AC-2 are refactors with no behavior change.

---

## 4. Data model changes

None.

---

## 5. UI states

Not applicable to AC-1/AC-2 (invisible refactors). `/api/docs/ui` is a standard Swagger/Redoc page, out of scope for custom styling.

**Route(s):** `/api/docs`, `/api/docs/ui`
**Directory:** `frontend/src/lib/format.ts`, `frontend/src/i18n/`, `backend/src/openapi/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | shared formatting utility with multiple locales produces correct output | `frontend/tests/lib/format.test.ts` |
| **Integration** | generated OpenAPI document validates against the OpenAPI 3.x schema itself, and spot-checks that a few known endpoints (e.g. `POST /api/pricing/calculate`) appear with correct request/response shapes | `backend/tests/integration/openapi.int.test.ts` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Actually translating any string into a second language — only the mechanism ships, per AC-2.
- Multi-currency support — pricing remains EUR-only; `locale` here affects number/date formatting only, not currency conversion (that would be a pricing-engine change, out of scope, consistent with Spec 3's own original "not covered" note).

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Retrofitting i18n-library string extraction across every already-approved frontend spec (4–18) is a broad, mechanical refactor rather than a contained new feature. | Implementer | Resolved — treat as incremental: new specs/components use the i18n mechanism from the start; existing ones are migrated opportunistically rather than in one disruptive pass, since no user-facing behavior depends on it until a second language actually ships. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A.
- **Rollback:** revert to direct `Intl.NumberFormat` calls and remove the docs endpoints; no data or behavior depends on this spec.
- **Observability:** none needed.

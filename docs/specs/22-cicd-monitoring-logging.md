# Spec: CI/CD Pipeline, Error Monitoring & Structured Logging

**File:** `docs/specs/22-cicd-monitoring-logging.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §34.2 (Engineering Hygiene); depends on `01-project-foundation.md`

---

## 1. Problem statement

**Today:** Every spec's test plan assumes `lint`/`typecheck`/`test`/`build` commands exist (Spec 1), but nothing runs them automatically, nothing catches a regression before merge, and no runtime error is visible unless someone is watching a terminal. SRS §34.2 asks for CI/CD gates, preview deployments, error monitoring (especially for "hard-to-reproduce WebGL/3D bugs"), and structured logging "especially around AI calls and pricing calculations."

**Who is affected:** Anyone contributing code (quality gate), and future-us trying to diagnose a production issue without user-submitted repro steps.

**Why it matters now:** By this point in the backlog, there's enough surface area (3D, AI, payments, auth) that flying blind in production is a real risk, not a theoretical one.

**Success looks like:** A pull request can't merge with failing lint/types/tests; every push to a branch gets a preview deployment; a frontend WebGL crash or a backend pricing/AI error shows up in Sentry with enough context to reproduce it, without ever leaking a secret.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a pull request **When** opened or updated **Then** a GitHub Actions workflow runs lint, typecheck, unit+integration tests, and build for both `frontend/` and `backend/`, blocking merge on any failure |
| AC-2 | **Given** a pull request **When** its checks pass **Then** a preview deployment (Vercel for `frontend/`, the chosen host for `backend/`) is created and linked in the PR |
| AC-3 | **Given** an unhandled exception in the frontend (including inside `AppErrorBoundary`, Spec 12) or backend **When** it occurs in a deployed environment **Then** it is reported to Sentry with a stack trace, relevant breadcrumbs, and — for 3D-related errors — the WebGL renderer/GPU info string, without including request bodies that might contain personal data (leads, auth) |
| AC-4 | **Given** every AI call (Spec 14) and pricing calculation (Spec 3) on the backend **When** executed **Then** it emits a structured log line (JSON, via a logging library) including latency, outcome (success/validation-rejected/error), and relevant non-sensitive identifiers (`vehicleSlug`, not user PII) |
| AC-5 | **Given** any logged data **When** written **Then** it never includes passwords, session tokens, API keys, or full payment details — a lint/code-review checklist item, backed by a redaction helper used at every log call site that touches request bodies |

---

## 3. API contract

No new application endpoints — this spec is tooling/infrastructure.

---

## 4. Data model changes

None.

---

## 5. UI states

Not applicable — this spec has no product-facing UI.

**Route(s):** none.
**Directory:** `.github/workflows/`, `backend/src/lib/logger.ts`, `frontend/sentry.client.config.ts`, `backend/sentry.server.config.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Meta** | the CI workflow itself is validated by observing it run on this PR and a deliberately-broken follow-up PR (fails lint/type/test) | manual verification during implementation |
| **Unit** | logger redaction helper strips known-sensitive keys from arbitrary objects | `backend/tests/logger.test.ts` |

**Coverage:** not applicable in the usual sense — this spec's "coverage" is whether the pipeline itself correctly gates merges, verified operationally.

---

## 7. Out of scope

- Full observability (dashboards, alerting rules, on-call) — Sentry's own default alerting is sufficient for a portfolio-scale project; building custom dashboards is not.
- Log aggregation infrastructure beyond whatever the hosting provider's platform gives by default (e.g. Vercel/Render logs) plus Sentry.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Sentry (and any monitoring provider) has its own data-processing terms — worth a quick check that error payloads (which could incidentally include a user's email in a stack trace, e.g. from Spec 16's auth flows) are scrubbed, tying into Spec 24's GDPR work. | Product owner | Resolved — Sentry's built-in PII scrubbing/data-scrubbing features should be enabled by default at implementation time; cross-reference with Spec 24 rather than treating it as fully solved here. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A.
- **Rollback:** disable the GitHub Actions workflow or Sentry DSN; doesn't affect the running application's own behavior.
- **Observability:** this spec *is* the observability layer for everything built before it.

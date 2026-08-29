# Spec: Cookie Consent & GDPR Compliance

**File:** `docs/specs/24-cookie-consent-gdpr.md`
**Status:** Draft
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §34.4 (Compliance & Trust); depends on `16-authentication.md`, `23-seo-og-analytics.md`, `19-lead-capture-quote-request.md`

---

## 1. Problem statement

**Today:** The product sets an auth session cookie (Spec 16, strictly necessary — no consent required under GDPR) but has no consent mechanism for anything beyond that, and once Spec 23 adds analytics, that gap becomes a real compliance issue. The product also has no privacy policy, and no way for a user to export or delete their personal data despite storing it (accounts, leads, reservations).

**Who is affected:** Any EU visitor (the product prices in EUR and is styled as a European premium brand), and anyone who wants their data removed.

**Why it matters now:** It's a prerequisite for Spec 23's analytics actually firing (that spec is gated on this one's consent state) and closes out the compliance gap opened by every spec that started storing personal data (16, 19, 20).

**Success looks like:** A first-time EU-presenting visitor sees a clear, dismissible cookie banner before any non-essential cookie or script loads, can read a real privacy policy, and — if they have an account — can request their data or delete their account from My Garage.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a first visit **When** the page loads **Then** a cookie consent banner appears before any non-essential script (analytics, per Spec 23) loads, offering "Accept," "Reject," and a link to see categories/details |
| AC-2 | **Given** a consent choice is made **When** recorded **Then** it persists (e.g. in `localStorage`, since this is a per-browser preference, not account state) and the banner doesn't reappear on subsequent visits until the choice is cleared or a policy version changes |
| AC-3 | **Given** consent is rejected or not yet given **When** the app runs **Then** the strictly-necessary auth session cookie (Spec 16) still functions normally — it requires no consent — but Spec 23's analytics never loads |
| AC-4 | **Given** the footer/nav **When** clicked **Then** a Privacy Policy page is reachable, describing what's collected (account data, leads, reservations, analytics if consented), why, and for how long, in plain language |
| AC-5 | **Given** a signed-in user's profile page (Spec 17, My Garage) **When** they request "Download my data" **Then** they receive an export (e.g. JSON, emailed or downloaded) containing their `User`, `Configuration`, `Lead`, and `Reservation` records |
| AC-6 | **Given** a signed-in user requests "Delete my account" **When** confirmed **Then** their `User` row and personally-identifying data are deleted; their past `Configuration`/`Lead`/`Reservation` rows are anonymized (`userId` set to `null`, not cascade-deleted) rather than destroyed outright, preserving aggregate/business data integrity without retaining personal identity |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/me/export` | session | `200` (file download) | AC-5 |
| `DELETE` | `/api/me` | session | `204` | AC-6, anonymizes rather than cascades |

### Breaking-change check

- [x] N/A — additive endpoints.

---

## 4. Data model changes

None structurally — `Configuration.userId`, `Lead.userId`, `Reservation.userId` are already nullable (Specs 2, 19, 20), which is exactly what account deletion's anonymization (AC-6) relies on.

### Retention and privacy

This spec *is* the retention/privacy policy layer the rest of the product has been deferring to. Recommended defaults, to be stated in the privacy policy (AC-4): account data retained until deletion requested; guest `Configuration` rows already expire per Spec 10 (90 days); `Lead` rows retained 2 years (Spec 19's own deferred note); `Reservation` rows retained per standard financial record-keeping norms (align with whatever Stripe's own retention is, typically several years) since they represent (test-mode) transaction records.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Banner** | dismissible, non-blocking (doesn't cover primary content), styled consistent with SRS §21 |
| **Export requested** | loading indicator, then a download or "check your email" confirmation |
| **Delete requested** | a clear, explicit confirmation step (typing the account email, or similar) before the irreversible action proceeds |

**Route(s):** `/privacy-policy`; additions to `/garage` (Spec 17).
**Directory:** `frontend/src/components/consent/`, `backend/src/routes/me.ts` (extended)

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | consent state persistence and gating logic | `frontend/tests/consent.test.ts` |
| **Integration** | export produces correct data shape; delete anonymizes rather than cascades, verified against related rows | `backend/tests/integration/gdpr.int.test.ts` |
| **E2E** | reject consent → confirm no analytics script tag loads (Spec 23) → accept consent → confirm it does; request export; delete account → confirm login no longer works but a prior lead/reservation record survives with `userId: null` | `frontend/e2e/gdpr.spec.ts` |

**Coverage:** ≥80% on new code; the delete/anonymize path at 100% given the irreversibility risk of getting it wrong.

---

## 7. Out of scope

- Cookie consent management platforms (e.g. OneTrust) — a simple in-house banner is sufficient at this scale.
- Data Processing Agreements with third parties (Stripe, Sentry, the analytics provider, Resend) — a real legal/compliance task outside a coding spec's scope, noted here so it isn't forgotten if this were ever operated as a real business.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | This spec's compliance posture is reasonable for a portfolio project but is not a substitute for actual legal review if the product were ever operated commercially with real users and real payments. | Product owner | Resolved — explicitly out of scope; documented so the limitation is visible rather than implied. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A structurally; should ship before or alongside Spec 23 so analytics never fires without consent even briefly.
- **Rollback:** remove the banner/export/delete endpoints; Spec 23's analytics should then also be disabled, since its consent gate would no longer exist.
- **Observability:** log account-deletion events (who, when) for audit purposes, without retaining the deleted user's PII in that log itself.

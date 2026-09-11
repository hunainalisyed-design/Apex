# Spec: Lead Capture / Quote Request

**File:** `docs/specs/19-lead-capture-quote-request.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §34.1 (Business & Conversion — lead capture); depends on `10-save-share-configuration.md`, `09-build-summary.md`, `16-authentication.md` (optional association)

---

## 1. Problem statement

**Today:** A user can build, price, save, and share a configuration, but there's no way for that interest to turn into a real-world business action. SRS §34.1 wants a "Request Quote" / "Book a Test Drive" flow tied to a saved build, so the product feels like a real commerce funnel, not only a showcase.

**Who is affected:** Any user who's finished configuring and wants to act on it; whoever (a dealer, or the portfolio owner acting as one) receives and follows up on leads.

**Why it matters now:** It's the simplest of the §34.1 business features and a prerequisite in spirit for Spec 21's Admin panel, which needs something to list.

**Success looks like:** A user clicks "Request a Quote" on their build summary, fills a short form, and both they and the dealer inbox get a confirmation — with the exact configuration attached, not just a vague inquiry.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a build summary (Spec 9) or a loaded saved build (Spec 10) **When** the user clicks "Request Quote" or "Book a Test Drive" **Then** a form appears asking for name, email, phone (optional), preferred contact method, and an optional message |
| AC-2 | **Given** the form is submitted with valid required fields **When** processed **Then** a `Lead` row is created referencing the current `Configuration` (by `publicId`, saving it first per Spec 11's save-if-dirty pattern if it isn't already saved), and the user sees a confirmation ("We'll be in touch") |
| AC-3 | **Given** a lead is created **When** processed **Then** a notification email is sent to a configured dealer inbox address containing the requester's details and a link to the exact configuration, and a separate confirmation email is sent to the requester |
| AC-4 | **Given** a signed-in user submits the form **When** the lead is created **Then** `Lead.userId` is set to them; **given** a guest submits it **when** created **then** `Lead.userId` is `null` — this flow requires no account (SRS §36.5) |
| AC-5 | **Given** invalid input (missing name/email, malformed email) **When** submitted **Then** inline validation errors appear and no request is sent |
| AC-6 | **Given** the form **When** used by a keyboard-only or screen-reader user **Then** every field is labeled and the form is fully operable via keyboard (SRS §29) |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/leads` | none (optional session) | `201` `ApiResponse<{ id: string }>` | |

### Request and response DTOs

```ts
// backend/src/types/leads.ts
export interface CreateLeadRequest {
  configurationPublicId: string;
  name: string;
  email: string;
  phone: string | null;
  preferredContact: "EMAIL" | "PHONE";
  message: string | null;
  requestType: "QUOTE" | "TEST_DRIVE";
}
```

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `404` | `CONFIGURATION_NOT_FOUND` | reused from Spec 10 |
| `400` | `VALIDATION_ERROR` | missing/malformed required fields |

### Breaking-change check

- [x] First version of this contract.

---

## 4. Data model changes

```prisma
model Lead {
  id                     String    @id @default(cuid())
  configurationId        String
  configuration          Configuration @relation(fields: [configurationId], references: [id])
  userId                 String?
  user                   User?     @relation(fields: [userId], references: [id])
  name                   String
  email                  String
  phone                  String?
  preferredContact       String    // "EMAIL" | "PHONE"
  message                String?
  requestType            String    // "QUOTE" | "TEST_DRIVE"
  status                 String    @default("NEW") // "NEW" | "CONTACTED" | "CLOSED" — managed by Spec 21's admin panel
  createdAt              DateTime  @default(now())

  @@index([status])
}
```

### Migration

- **Name:** `AddLead`
- **Reversible:** yes.
- **Backfill required:** no.
- **Downtime:** none.

### Retention and privacy

`Lead` stores real personal data (name, email, phone) submitted voluntarily. Falls under the same GDPR handling as `User` (Spec 24's data export/deletion should include leads tied to a `userId`, and guest leads should have a retention window — recommend 2 years, reviewed alongside Spec 24).

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | submit button disabled + spinner during the request |
| **Empty** | N/A |
| **Error** | Spec 12's generic error pattern with retry |
| **Success** | confirmation message replaces the form |

**Route(s):** modal/panel on `/configure/[slug]`, not a new route.
**Directory:** `frontend/src/components/leads/`, `backend/src/routes/leads.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Integration** | lead creation, email dispatch (mocked), guest vs. authenticated `userId` handling | `backend/tests/integration/leads.int.test.ts` |
| **Component** | form validation, loading/error/success states | `frontend/tests/leads/LeadForm.test.tsx` |
| **E2E** | submit a quote request from a build summary, assert confirmation and (in test env) the mocked email payloads | `frontend/e2e/lead-capture.spec.ts` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Any CRM integration beyond email notification.
- Lead status management UI — Spec 21 (Admin panel) owns viewing/updating `Lead.status`.

---

## 7a. Implementation notes

- **This spec's own `Lead` model, as literally written, introduced a real crash risk into already-shipped Spec 17 code — found and fixed in this PR.** `Lead.configurationId` is a required FK to `Configuration` with no `onDelete` specified, which Prisma compiles to a real Postgres `ON DELETE RESTRICT` constraint. Spec 17's `DELETE /api/configurations/:publicId` had no `try/catch` around its `deleteMany` call — once any `Lead` references a `Configuration`, deleting that build from My Garage threw Prisma error P2003 uncaught. This backend runs Express 4 (no auto-catch of a rejected async handler) with no error-handling middleware, and Node terminates the process on an unhandled rejection by default, so this wasn't just a bad response to one request — it risked crashing the whole backend process. Fixed by wrapping `deleteConfigurationForUser` in a `try/catch` that turns a P2003 into a normal `{ ok: false, reason: "HAS_LEADS" }` result (mirroring this file's own `ClaimResult` discriminated-result convention), surfaced as `409 CONFIGURATION_HAS_LEADS`. Verified with a dedicated integration test and a live manual check confirming the backend process survives the exact scenario that would have crashed it before this fix.
- **§4's plain-`String` `preferredContact`/`requestType`/`status` fields became real Prisma enums** (`PreferredContact`, `LeadRequestType`, `LeadStatus`) instead — matching this schema's own established convention (`OptionCategory`, `ApplyMode`) rather than introducing the first plain-string status field. Confirmed against `docs/specs/21-admin-cms-panel.md`'s actual scope (only ever toggles `status` between three fixed values via a normal `PUT`) that nothing needs arbitrary future strings without a migration. Costs nothing on the wire — Prisma enums still serialize as the same plain strings `CreateLeadRequest`'s type already expects.
- **`getResendClient()`/`RESEND_FROM_ADDRESS` were extracted out of `services/auth/email.ts` into a shared `lib/email.ts`**, now used by both the password-reset email (Spec 16) and the two new lead-notification emails — the same "second consumer needs the identical lazy-singleton" reasoning as Spec 18's extraction of `isWebGLAvailable`.
- **AC-2's save-if-dirty reuses `configurationStore`'s existing `save()`/`isDirtySinceLastSave()`** (the same mechanism Spec 11's `useCaptureBuild.ts` established), but deliberately does not mirror Capture's silent stand-down on a save failure. Capture's silent behavior is justified by `SaveSharePanel` being rendered right alongside it in the same panel; the lead dialog overlays that panel, so a save failure is shown inline in the dialog itself instead.
- **`prisma/seed.ts`'s shared `seedDatabase()` fixture (used by most backend integration tests) needed updating** to delete `Lead` rows before `Configuration` rows — without this, any integration test file that runs after one creating a `Lead` would fail to re-seed, since the same new FK constraint blocks the seed's own cleanup.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | The "dealer inbox" is a single configured email address — realistic for a portfolio project, not a real multi-dealer business. | Product owner | Resolved — accepted; a real deployment would need dealer routing logic, out of scope for this project's purpose. |
| 2 | The spec's own `Lead` model gave `Configuration.leads` no `onDelete` behavior, which — combined with this backend's Express 4 + no error-handling-middleware setup — meant a lead-attached build could never be deleted from My Garage without crashing the backend process. | Implementer | Resolved — `deleteConfigurationForUser` now catches the FK-constraint violation (P2003) and returns a normal blocked result instead of throwing; the route responds `409 CONFIGURATION_HAS_LEADS`. See Implementation Notes above. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** after all Phase 1/2 migrations.
- **Rollback:** remove the endpoint and form; nothing else depends on `Lead`.
- **Observability:** log lead-creation and email-send failures.

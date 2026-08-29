# Spec: Lead Capture / Quote Request

**File:** `docs/specs/19-lead-capture-quote-request.md`
**Status:** Draft
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

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | The "dealer inbox" is a single configured email address — realistic for a portfolio project, not a real multi-dealer business. | Product owner | Resolved — accepted; a real deployment would need dealer routing logic, out of scope for this project's purpose. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** after all Phase 1/2 migrations.
- **Rollback:** remove the endpoint and form; nothing else depends on `Lead`.
- **Observability:** log lead-creation and email-send failures.

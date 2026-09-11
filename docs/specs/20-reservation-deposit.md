# Spec: Reservation Deposit (Stripe Test Mode)

**File:** `docs/specs/20-reservation-deposit.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §34.1 (Reservation/checkout stub); depends on `10-save-share-configuration.md`, `16-authentication.md`, `19-lead-capture-quote-request.md`

---

## 1. Problem statement

**Today:** Nothing in the product resembles real commerce — SRS §34.1 wants a "Reserve with Deposit" flow so the product demonstrates payment-flow competence, explicitly as a portfolio signal ("so the product feels like real commerce, not just a showcase"), using Stripe in test mode.

**Who is affected:** Anyone evaluating this as a portfolio piece who wants to see a real (if fake-money) checkout flow; in a real deployment, users actually reserving a build.

**Why it matters now:** It's the natural next step after lead capture, and the last of §34.1's three items before Spec 21 (Admin) needs something to manage.

**Success looks like:** A user clicks "Reserve with Deposit," is clearly told this is a test-mode demo charging no real money, completes Stripe's test checkout, and lands back on the product with a confirmed reservation tied to their exact configuration.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a build summary **When** the user clicks "Reserve with Deposit" **Then** they see a clear, unmissable disclosure that this is a **test-mode demo** and no real payment will be processed, before proceeding |
| AC-2 | **Given** the user proceeds **When** the backend creates a Stripe Checkout Session (test mode, fixed deposit amount, e.g. €500) **Then** the user is redirected to Stripe's hosted checkout page — card details are never handled by this application's own code (minimizing PCI scope entirely) |
| AC-3 | **Given** Stripe's `checkout.session.completed` webhook fires **When** received and its signature verified **Then** a `Reservation` row is created/updated with `status: PAID`, linked to the `Configuration` and, if signed in, the `User` |
| AC-4 | **Given** the user is redirected back after checkout **When** the return page loads **Then** it shows the reservation confirmation (or a pending/failed state if the webhook hasn't landed yet or the session was abandoned) |
| AC-5 | **Given** the webhook signature does not verify **When** a request hits the webhook endpoint **Then** it is rejected with `400` and never processed — prevents forged payment confirmations |
| AC-6 | **Given** only Stripe **test-mode** keys are ever configured for this project **When** any charge is attempted **Then** no real money can move under any circumstance |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/reservations/checkout-session` | none (optional session) | `200` `{ checkoutUrl: string }` | creates the Stripe Checkout Session |
| `POST` | `/api/reservations/webhook` | Stripe signature | `200` | Stripe webhook receiver, not user-facing |
| `GET` | `/api/reservations/:id` | none | `200` `ApiResponse<ReservationDto>` | for the return page |

### Request and response DTOs

```ts
// backend/src/types/reservations.ts
export interface CreateCheckoutSessionRequest {
  configurationPublicId: string;
}

export interface ReservationDto {
  id: string;
  configurationPublicId: string;
  amountCents: number;
  currency: string;
  status: "PENDING" | "PAID" | "FAILED" | "REFUNDED";
  createdAt: string;
}
```

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `404` | `CONFIGURATION_NOT_FOUND` | reused |
| `502` | `PAYMENT_PROVIDER_ERROR` | Stripe API call failed |

### Breaking-change check

- [x] First version of this contract.

---

## 4. Data model changes

```prisma
model Reservation {
  id                     String   @id @default(cuid())
  configurationId        String
  configuration          Configuration @relation(fields: [configurationId], references: [id])
  userId                 String?
  user                   User?    @relation(fields: [userId], references: [id])
  stripeCheckoutSessionId String  @unique
  amountCents            Int
  currency               String   @default("EUR")
  status                 String   @default("PENDING") // PENDING | PAID | FAILED | REFUNDED
  createdAt              DateTime @default(now())
  updatedAt              DateTime @updatedAt
}
```

### Migration

- **Name:** `AddReservation`
- **Reversible:** yes.
- **Backfill required:** no.

### Retention and privacy

No card data is ever stored by this application (Stripe Checkout handles it entirely). `Reservation` rows tied to a `userId` fall under the same GDPR handling as `Lead` (Spec 19); Stripe itself retains payment records per its own compliance obligations, independent of this app.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | "Redirecting to secure checkout..." while the session is created |
| **Error** | `PAYMENT_PROVIDER_ERROR` → generic error, no reservation created |
| **Success** | confirmation page after Stripe redirect-back; **Pending** state shown if the webhook hasn't landed yet, auto-refreshing briefly before falling back to "check your email for confirmation" |

**Route(s):** `/reservations/[id]/confirmation`
**Directory:** `frontend/src/components/reservations/`, `backend/src/routes/reservations.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Integration** | checkout session creation, webhook signature verification (valid/invalid), status transitions | `backend/tests/integration/reservations.int.test.ts` |
| **E2E** | full flow against Stripe's test-mode sandbox: reserve → complete test checkout → return → confirmed | `frontend/e2e/reservation.spec.ts` |

**Coverage:** ≥80% on new code; webhook signature verification at 100% given its security role.

---

## 7. Out of scope

- Real payment processing of any kind — test mode only, permanently, for this project (see Risk #1).
- Refund UI — a `REFUNDED` status exists in the schema for completeness but no refund action is built.

---

## 7a. Implementation notes

- **This spec's own `Reservation` model repeated Spec 19's exact `Lead` gap** — a required `configurationId` FK to `Configuration` with no `onDelete` specified, defaulting to Prisma's `Restrict`. Rather than re-discovering and re-fixing the same Express-4/unhandled-rejection crash risk Spec 19 already found for `Lead`, the existing fix was generalized: `deleteConfigurationForUser`'s `"HAS_LEADS"` reason became `"HAS_DEPENDENTS"`, and the HTTP code `CONFIGURATION_HAS_LEADS` became `CONFIGURATION_IN_USE` — one P2003-catching code path now correctly covers both tables. A new integration test proves the `Reservation` path specifically (not just the already-covered `Lead` path).
- **`stripeCheckoutSessionId` is nullable (`String? @unique`), not the spec's own non-nullable sketch.** The Stripe session's `success_url` needs to point at `/reservations/{ourId}/confirmation`, but our row's `id` isn't known until the row exists — resolved by creating the `Reservation` row first (status `PENDING`, session id `null`), then creating the Stripe session, then writing the session id back. `metadata: {reservationId}` is also set on the session so the webhook handler can self-heal (matched by `session.metadata.reservationId`) if that final write-back never lands — a real gap a Plan-agent review caught before it could silently orphan a paid reservation.
- **The webhook handler is idempotent by construction**, not by accident: `handleCheckoutSessionCompleted` uses `updateMany` (not `update`), so a retried Stripe webhook delivery (Stripe's own at-least-once guarantee) re-applies the same update harmlessly instead of erroring. Verified with a dedicated "same event delivered twice" integration test.
- **Stripe's webhook signature verification needs the raw, unparsed request body** — `app.ts`'s global `express.json()` would otherwise consume it first. The webhook route is registered directly on `app` with its own `express.raw()` parser, before the global JSON middleware; every other reservations route stays on the normal JSON-bodied router, mounted after it as usual. Tested for real (not mocked) using `stripe.webhooks.generateTestHeaderString` — a genuine, offline, no-network stripe-node helper — so both a validly-signed and a forged webhook request exercise the actual crypto verification path, not a stand-in.
- **`preferredContact`/`requestType`/`status`-style plain-string fields became a real `ReservationStatus` enum**, matching Spec 19's `LeadStatus` precedent and this schema's dominant `OptionCategory`/`ApplyMode` convention.
- **No confirmation email is sent on a `PAID` reservation, and the return page's copy deliberately doesn't promise one** — the spec's own §5 UI-states row mentions "check your email for confirmation" as a pending-state fallback, but `Reservation` (unlike `Lead`) captures no email address anywhere, and no AC requires building one. The pending-state copy was written to be honest about still-processing instead.
- **A missing `STRIPE_SECRET_KEY` returns `502 PAYMENT_PROVIDER_ERROR`, not a silent no-op** — unlike `lib/email.ts`'s graceful degrade-to-console-log (a failed notification is non-fatal), there's no equivalent "create a reservation but skip Stripe" story: the endpoint's entire purpose is the Stripe call.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Using Stripe even in test mode means real Stripe account credentials (test keys) must exist and be kept out of version control. | Implementer | Resolved — test secret key lives in backend env vars only, never committed; this is the same pattern already established for `ANTHROPIC_API_KEY` (Spec 14). |
| 2 | If this project is ever deployed as genuinely "for portfolio display" publicly, the test-mode disclosure (AC-1) must remain permanently visible — accidentally switching to live keys would be a serious real-world liability. | Product owner | Resolved — treat "test mode only" as a permanent, non-negotiable project constraint, not a temporary development state; already documented loudly in `docs/CLAUDE.md` ahead of this spec's implementation. |
| 3 | The spec's own `Reservation` schema snippet left `configurationId`'s `onDelete` behavior unspecified and `stripeCheckoutSessionId` non-nullable, both of which turned out to be real gaps (see Implementation Notes above). | Implementer | Resolved — `onDelete` explicitly documented as `Restrict` (matching `Lead`'s reasoning), and `stripeCheckoutSessionId` made nullable with a `metadata`-based self-healing fallback in the webhook handler. |

---

## 9. Rollout

- **Feature flag:** `RESERVATIONS_ENABLED` — allows disabling instantly if Stripe test-mode behavior ever changes unexpectedly.
- **Migration order:** after Lead (Spec 19).
- **Rollback:** disable the flag; remove routes/webhook.
- **Observability:** log every webhook event received and its processing outcome — payment flows are the highest-stakes place in this app for silent failures.

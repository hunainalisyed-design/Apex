# Spec: Authentication (Login, Sign-Up, Password Reset)

**File:** `docs/specs/16-authentication.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §36.1 (Login Page), §36.2 (Sign-Up Page), §36.3 (Password Reset Flow), §36.5 (Guest Mode), §36.6 (Navigation Update); depends on `02-vehicle-catalog-data-model.md`, `13-navigation-scroll-shell.md` (`NavRightSlot`), `12-loading-error-a11y-shell.md`

---

## 1. Problem statement

**Today:** Every user is a guest — there is no way to create an account, log in, or recover a forgotten password. SRS §36 introduces accounts specifically because several already-built or planned features implicitly need to know who the user is: My Garage (Spec 17), and later the public gallery and reservations (Phase 3).

**Who is affected:** Any user who wants their builds to persist beyond a single shareable link, tied to an identity they control.

**Why it matters now:** It's a prerequisite for Spec 17 (My Garage) and every Phase 3 feature that's account-gated (§34.1's reservations, §35.2's gallery). Nothing in Phase 1 changes — guest mode remains the default experience (SRS §36.5) — this spec only adds the *option* to have an account.

**Success looks like:** A user can sign up with an email and password, log in and out, and recover access via a time-limited, single-use reset link if they forget their password — all without ever seeing a stack trace, a leaked detail about whether an email is registered, or a page that breaks the product's dark/glassmorphism visual language.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** the sign-up page **When** a user submits a name, valid email, a password meeting the minimum policy, and an accepted terms checkbox **Then** the account is created, a session is established immediately (auto-login), and the user is redirected to the homepage signed in |
| AC-2 | **Given** an email already registered **When** sign-up is attempted **Then** the API returns `409` with code `EMAIL_ALREADY_REGISTERED`, shown inline near the email field |
| AC-3 | **Given** the login page **When** a user submits a registered email and correct password **Then** a session is established and they're redirected to the homepage signed in |
| AC-4 | **Given** an incorrect email or password **When** login is attempted **Then** the API returns `401` with code `INVALID_CREDENTIALS` and a generic message ("Invalid email or password") that never reveals which of the two was wrong |
| AC-5 | **Given** repeated failed login attempts for the same email or from the same IP **When** a reasonable threshold is exceeded within a time window **Then** further attempts return `429` with code `TOO_MANY_ATTEMPTS` until the window passes — a baseline brute-force guard, not full abuse monitoring |
| AC-6 | **Given** "Forgot password?" is submitted with any email **When** processed **Then** the API always returns the same generic success response regardless of whether that email is registered, and — only if it *is* registered — an email is sent with a single-use, time-limited (1 hour) reset link; no response ever confirms or denies account existence (SRS §36.3) |
| AC-7 | **Given** a valid, unexpired, unused reset token **When** the reset-password form is submitted with a new password meeting the minimum policy **Then** the password is updated, the token is marked used (rejecting any reuse), and every existing session for that user is invalidated, forcing re-login everywhere |
| AC-8 | **Given** an expired, already-used, or invalid reset token **When** submitted **Then** the API returns `400` with code `INVALID_OR_EXPIRED_TOKEN` and the reset-password page shows a clear message with a link back to "Forgot password?" |
| AC-9 | **Given** a logged-in user **When** they click "Log Out" **Then** their session is invalidated server-side (not just cleared client-side) and they return to guest mode immediately |
| AC-10 | **Given** any page loads **When** the app initializes **Then** it calls `GET /api/auth/me` once to determine sign-in state, which drives the nav's account area (Spec 13's `NavRightSlot`): "Log In / Sign Up" links when signed out, or the user's name/avatar linking to My Garage (Spec 17) when signed in (SRS §36.6) |
| AC-11 | **Given** every auth page (login, sign-up, forgot password, reset password) **When** rendered **Then** all are styled consistently with the product's dark, glassmorphism, minimal-field visual language (SRS §36.1/36.2) — never a generic unstyled form |
| AC-12 | **Given** a keyboard-only or screen-reader user **When** using any auth form **Then** every field has a proper label, validation errors are announced, and submission is fully keyboard-operable (SRS §29) |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/auth/signup` | none | `201` `ApiResponse<UserDto>` + sets session cookie | |
| `POST` | `/api/auth/login` | none | `200` `ApiResponse<UserDto>` + sets session cookie | |
| `POST` | `/api/auth/logout` | session | `204` + clears session cookie | |
| `GET` | `/api/auth/me` | session (optional) | `200` `ApiResponse<UserDto \| null>` | never errors for "not logged in" — returns `null` |
| `POST` | `/api/auth/forgot-password` | none | `200` `ApiResponse<{ message: string }>` | always the same response, AC-6 |
| `POST` | `/api/auth/reset-password` | none | `200` `ApiResponse<{ message: string }>` | |

Session mechanism: an httpOnly, `Secure`, `SameSite=Lax` cookie holding an opaque, cryptographically random session token. The backend stores only a hash of that token in a `Session` table (below) — never the raw token — so a database read alone can't be used to impersonate a session, and sessions can be individually revoked (logout, password reset) without needing JWT-blocklist machinery.

### Request and response DTOs

```ts
// backend/src/types/auth.ts

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
  acceptedTerms: true; // must be explicitly true; the API rejects anything else
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface UserDto {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}
```

Password policy (enforced both client-side for immediate feedback and server-side as the authority): minimum 8 characters, at least one letter and one number. This is a baseline, not an exhaustive security policy — see Risk #3.

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `409` | `EMAIL_ALREADY_REGISTERED` | sign-up with an existing email |
| `401` | `INVALID_CREDENTIALS` | login with wrong email or password (never distinguishes which) |
| `429` | `TOO_MANY_ATTEMPTS` | brute-force threshold exceeded (AC-5) |
| `400` | `INVALID_OR_EXPIRED_TOKEN` | reset-password with a bad token (AC-8) |
| `400` | `VALIDATION_ERROR` | malformed request or password failing the minimum policy |

### Breaking-change check

- [x] First version of this contract.

---

## 4. Data model changes

### Entities

```prisma
model User {
  id               String    @id @default(cuid())
  name             String
  email            String    @unique
  passwordHash     String
  termsAcceptedAt  DateTime
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  sessions             Session[]
  passwordResetTokens  PasswordResetToken[]
  configurations       Configuration[] // relation added to Spec 2's Configuration.userId
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash    String   @unique
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  @@index([userId])
}

model PasswordResetToken {
  id         String    @id @default(cuid())
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash  String    @unique
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime  @default(now())

  @@index([userId])
}
```

`Configuration.userId` (nullable since Spec 2) becomes a real foreign key to `User` now that the table exists; existing guest rows (`userId IS NULL`) are unaffected — claiming a guest build as one's own is Spec 17's concern, not this spec's.

Passwords are hashed with bcrypt (cost factor 12) — never stored or logged in plaintext, and never included in any API response (`UserDto` deliberately excludes `passwordHash`).

### Migration

- **Name:** `AddAuthentication`
- **Reversible:** yes — drop the three new tables and the `Configuration.userId` foreign key constraint (the column itself already exists from Spec 2).
- **Backfill required:** no — new tables, no existing data to migrate.
- **Downtime:** none.
- **Reviewed SQL:** to be pasted once generated.

### Retention and privacy

This is the first spec to store real personal data (name, email, password hash). Password reset tokens are single-use and expire in 1 hour; expired/used tokens should be periodically purged (Phase 3 cleanup job, alongside Spec 10's guest-configuration expiry job). Sessions expire after a reasonable duration (e.g. 30 days) and are purged similarly. Full GDPR-compliant data handling (export, deletion on request) is Phase 3 (§34.4) — this spec establishes the tables that policy will apply to, but doesn't implement the compliance tooling itself.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | form submit buttons show a spinner and disable for the duration of the request |
| **Empty** | not applicable — these are forms, not data views |
| **Error** | inline, field-adjacent messages for validation errors; a form-level banner for `INVALID_CREDENTIALS`/`EMAIL_ALREADY_REGISTERED`/`TOO_MANY_ATTEMPTS`/`INVALID_OR_EXPIRED_TOKEN`, always via Spec 12's `getErrorMessage` mapping |
| **Success** | sign-up/login redirect signed-in to the homepage; forgot-password shows a persistent confirmation message (not a redirect, so the generic-response wording in AC-6 is clearly readable); reset-password redirects to login with a "Password updated, please log in" message |

Also specify:
- **Validation:** email format, required fields, password minimum policy, and (sign-up only) a live password-strength indicator (SRS §36.2) and password-confirmation match — all client-side for immediate feedback, all re-validated server-side as the authority.
- **Keyboard/screen-reader:** AC-12.
- **Responsive:** single-column centered form on all viewports, consistent with SRS §36.1/36.2's "minimal fields, no clutter" direction.
- **Permission-gated content:** these pages themselves are for signed-out users; a signed-in user visiting `/login` or `/signup` is redirected to the homepage (or My Garage) instead.

**Route(s):** `/login`, `/signup`, `/forgot-password`, `/reset-password`
**Directory:** `frontend/src/app/(auth)/`, `backend/src/routes/auth.ts`, `backend/src/services/auth/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | password hashing/verification, session token generation/hashing, reset-token single-use enforcement, password policy validation | `backend/tests/auth.test.ts` |
| **Integration** | every endpoint's success and error paths, including the no-enumeration guarantee (AC-6: identical response whether or not the email exists) and session invalidation on password reset (AC-7) | `backend/tests/integration/auth.int.test.ts` |
| **Component** | all four auth forms: validation, loading, error, success states; keyboard operability | `frontend/tests/auth/*.test.tsx` |
| **E2E** | full sign-up → auto-login → logout → login → forgot password → (intercept the reset email in test env) → reset password → old session invalidated → login with new password | `frontend/e2e/authentication.spec.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1, AC-2 | `auth.int.test.ts :: signup` |
| AC-3, AC-4 | `auth.int.test.ts :: login` |
| AC-5 | `auth.int.test.ts :: rate limiting` |
| AC-6 | `auth.int.test.ts :: no enumeration` |
| AC-7, AC-8 | `auth.int.test.ts :: password reset` |
| AC-9 | `authentication.spec.ts :: logout` |
| AC-10 | `authentication.spec.ts :: nav reflects auth state` |
| AC-11, AC-12 | `frontend/tests/auth/*.test.tsx` |

**Coverage:** ≥80% on new code; the auth/session logic should be close to 100% given its security role.

**Not covered, deliberately:** social login (Google/Apple) — see Risk #1; email deliverability testing beyond a test-environment mock — a real send is a manual/staging verification step, not a unit/integration test concern.

---

## 7. Out of scope

- Social login (Google/Apple) — SRS §36.1/§36.2 mark this "optional"; see Risk #1.
- My Garage itself and any "claim this guest build" flow — Spec 17.
- Any feature actually being *gated* behind login beyond what already required it conceptually (nothing in Phase 1 or this spec gates on auth — SRS §36.5 keeps guest mode as the default everywhere until Phase 3's gallery/reservation/collab features).
- Email verification on sign-up — not explicitly required by the SRS; accounts are usable immediately after sign-up. See Risk #2.
- Full GDPR tooling (data export, right-to-erasure UI) — Phase 3 (§34.4).

---

## 7a. Implementation notes

- **`Configuration.userId`'s new FK uses `onDelete: SetNull`, not Prisma's default `Restrict`.** The spec's own §4 data model never specified this. Prisma's default would mean a future account deletion (Phase 3 GDPR erasure, §34.4) fails outright while the account owns any configuration. `SetNull` lets deletion always succeed — the configuration keeps resolving via its `publicId`, reverting to a guest-owned-looking row. A real spec gap, resolved in this same PR rather than deferred.
- **`ApiError.details` (typed since Spec 10 but never populated until now) gets its first real producer.** `sendApiError` gained an optional 5th `details?: Record<string, string[]>` parameter. This resolves an apparent tension between AC-2 ("shown inline near the email field") and §5's UI-states table ("a form-level banner for EMAIL_ALREADY_REGISTERED"): the banner is the *default* for any error without field-specific `details`; `EMAIL_ALREADY_REGISTERED` and password-policy violations are the two cases that attach `details`, so both passages hold simultaneously rather than contradicting. `authStore` keeps exactly one `details` field (not a parallel mapped-message/raw-code pair), and every form shows `details[fieldName]` inline when present, `getErrorMessage(errorCode)` as a banner otherwise.
- **No test-only reset-token-minting endpoint.** A `NODE_ENV`-gated backend route that mints a valid password-reset token for any email without proving inbox control would be a real, permanent security surface live on every non-production deploy — rejected even as a throwaway. Instead, `backend/tests/integration/auth.int.test.ts` mocks `sendPasswordResetEmail` (mirroring Spec 14's `ai.int.test.ts` mock of the Claude client boundary) and captures the raw token from the mock's call args to exercise the full reset flow — signup → forgot-password → reset-password → old sessions revoked → new password required to log in → token rejected on reuse — against a real database, in one test. `frontend/e2e/authentication.spec.ts` covers sign-up/logout/login and the forgot-password no-enumeration guarantee against the real backend; full reset-password *page* coverage lives at the component-test layer instead (`frontend/tests/auth/reset-password.test.tsx`, with a URL-supplied fixture token), using this spec's own already-granted allowance that email deliverability is a manual/staging concern, not an automated-test one.
- **`RESEND_API_KEY` is unset in this environment**, matching how Spec 14's `ANTHROPIC_API_KEY` was left unconfigured. `backend/src/services/auth/email.ts` builds a real `resend` client when the key is present and otherwise logs the reset link to the console — `sendPasswordResetEmail` is deliberately self-catching (never throws) so `POST /forgot-password`'s response is byte-identical regardless of whether the send succeeds, fails, or no provider is configured at all (AC-6).
- **Session tokens are hashed with SHA-256, not bcrypt — deliberately, and only for sessions.** Passwords use bcryptjs (cost 12) because bcrypt's slowness defends a low-entropy, human-chosen secret. A session token is a 256-bit `crypto.randomBytes` value that's already unguessable; bcrypt-hashing it would slow down every authenticated request's session lookup for no security benefit. Only the hash is ever stored (`Session.tokenHash`, `PasswordResetToken.tokenHash`) — a database read alone can never be used to impersonate a session or mint a reset.
- **The session cookie's `secure` flag is conditional (`NODE_ENV === "production"`), not hardcoded `true`.** This project's dev server and Playwright's own test runs are plain `http://localhost` — a literal always-`Secure` cookie is silently dropped by the browser there, which would have broken the whole auth flow in exactly the environments it's tested in.
- **No server-side cookie read anywhere in this app.** `authStore`'s `hydrated` flag (distinct from `user`) exists so the nav's account area and the `(auth)` route group's already-signed-in redirect guard can never disagree about "haven't checked yet" vs. "checked, signed out" — both read `hydrated` alongside `user`. This is the same SSR-safe-default-then-correct-after-hydration trade-off `useIsDesktopViewport`/`useReducedMotion` already made elsewhere in this codebase, extended here rather than introducing `next/headers`' `cookies()` for the first time. The accepted cost is a brief signed-out-then-signed-in flash on load, mitigated by `AuthNavControl` rendering nothing at all until `hydrated` is true (never a wrong-state flash, just a missing-state one).
- **`revokeAllSessionsForUser` accepts an optional Prisma-or-transaction client** (`client: PrismaClient | Prisma.TransactionClient = prisma`) so it composes into `consumeResetToken`'s single `prisma.$transaction(async (tx) => ...)` call, satisfying AC-7's atomicity requirement (password update + token-consumed + all-sessions-revoked happen together, or not at all) without a second, transaction-specific implementation.
- **`(auth)` is this codebase's first Next.js route group.** `frontend/src/app/(auth)/layout.tsx` supplies the shared centered glass-panel chrome (AC-11) for all four pages and the client-side already-signed-in redirect guard — a plain `useEffect` reacting to `authStore`'s `hydrated`/`user`, since there's no server-side signal to redirect on. A successful signup/login doesn't need its own explicit redirect: setting `user` in the store is enough for this same effect to fire and navigate home.
- **`frontend/src/components/auth/FormField.tsx` is this codebase's first labeled-input-plus-inline-error primitive** (`label htmlFor` + `input id` + an error `<p id>` wired via `aria-describedby`, AC-12) — no prior form in the app had per-field validation state to associate (e.g. `ChatWindow`'s message box is a single free-text field).

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | SRS §36.1/§36.2 list Google/Apple social login as optional. Implementing either requires registering OAuth apps with those providers, handling provider-specific consent flows, and deciding how a social identity links to (or creates) a `User` row. | Product owner | Resolved for Phase 2 — deferred entirely; email+password ships first as the simpler, fully self-contained option. Add social login as its own follow-up spec if wanted, since it doesn't require changing this spec's `User` schema in a breaking way (a nullable `passwordHash` and a separate `SocialIdentity` table would be additive). |
| 2 | No email verification step exists — an account is usable immediately with an unverified email address. | Product owner | Resolved for Phase 2 — accepted; the SRS doesn't require it, and it would add a transactional-email dependency at sign-up time on top of the one already required for password reset. Revisit if spam sign-ups or reset-target confusion become a real problem. |
| 3 | Password policy (8 chars, one letter, one number) is a baseline, not informed by any specific compliance requirement in the SRS. | Product owner | Resolved — accepted as a reasonable default; not tied to any stated compliance standard, so it can be tightened later without a breaking API change (the policy lives in validation logic, not the wire contract). |
| 4 | Transactional email sending (password reset, AC-6/AC-7) requires a real provider (e.g. Resend, SendGrid, Postmark) with its own API key and sender-domain verification. | Implementer | Resolved — Resend chosen (simplicity given the Next.js-adjacent stack). No `RESEND_API_KEY` is configured in this environment, matching Spec 14's `ANTHROPIC_API_KEY`; the integration falls back to logging the reset link to the console, and every automated test mocks the email-send boundary regardless. |

---

## 9. Rollout

- **Feature flag:** none — auth is either present or not; a half-shipped auth system is worse than none.
- **Migration order:** ships after all Phase 1 migrations; adds three new tables and a foreign-key constraint on the existing `Configuration.userId` column.
- **Rollback:** revert the migration and remove the auth routes/pages/nav integration; the product reverts to guest-only, matching Phase 1's actual shipped state.
- **Observability:** log failed-login and rate-limit-triggered events (without logging attempted passwords) — this is the first spec handling credentials, so basic auth-abuse visibility matters from day one rather than being deferred entirely to Phase 3.

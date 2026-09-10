# Spec: Account Dashboard ("My Garage")

**File:** `docs/specs/17-account-dashboard-my-garage.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §36.4 (Account Dashboard); depends on `16-authentication.md`, `10-save-share-configuration.md` (`Configuration`, `publicId`), `09-build-summary.md` (condensed summary)

---

## 1. Problem statement

**Today:** Spec 16 lets a user create an account, but signing in doesn't do anything yet — every saved build (Spec 10) is still an anonymous guest row regardless of who's logged in. SRS §36.4 wants a dashboard listing a user's saved builds, with load/edit/delete, plus placeholders for quote requests and gallery entries once those Phase 3 features exist.

**Who is affected:** Any signed-in user who wants their builds to persist as *their own*, findable in one place, instead of only reachable via whatever links they happened to save.

**Why it matters now:** It's what makes having an account actually worth it — without this spec, Spec 16's login/sign-up would have no visible benefit over staying a guest.

**Success looks like:** A signed-in user saves a build, sees it appear in "My Garage," can reload it later to keep editing, and can delete builds they no longer want — all while any links they'd already shared before signing in keep working exactly as before.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** an unauthenticated visitor **When** they navigate to `/garage` **Then** they're redirected to `/login` with a return-to parameter that sends them back to `/garage` after signing in |
| AC-2 | **Given** a signed-in user **When** `/garage` loads **Then** it lists every `Configuration` row owned by them (`userId` matches), each showing the vehicle's name and thumbnail, a condensed build summary (reusing Spec 9's `deriveBuildSummary`), the total price, the saved date, and Load/Delete actions — most recently saved first |
| AC-3 | **Given** a garage entry **When** "Load" is clicked **Then** it navigates to `/configure/{slug}?build={publicId}`, reusing Spec 10's existing hydration mechanism (Spec 10, AC-4) — no new loading path |
| AC-4 | **Given** a loaded garage build that the user then modifies **When** they click "Save" (Spec 10's existing action) **Then** a **new** `Configuration` row with a new `publicId` is created — the original entry is never mutated in place, so any link to it that was already shared keeps pointing at the original, unmodified build |
| AC-5 | **Given** a garage entry **When** "Delete" is clicked **Then** a confirmation prompt appears before the row is permanently removed (SRS's destructive-action convention, mirrored from the template's own "confirm destructive actions" requirement) |
| AC-6 | **Given** a signed-in user saves a new configuration (Spec 10's `POST /api/configurations`, extended by this spec) **When** the save completes **Then** `userId` is set to the current session's user directly and `expiresAt` is left `null` (never expires) — it is never created as an anonymous, expiring guest row |
| AC-7 | **Given** an existing guest-created build (`userId IS NULL`) and its shareable link **When** a signed-in user opens that link and clicks "Save to My Garage" **Then** `POST /api/configurations/:publicId/claim` sets its `userId` to them and clears `expiresAt` to `null` |
| AC-8 | **Given** a build already claimed by a different user **When** another user attempts to claim it **Then** the API returns `409` with code `ALREADY_CLAIMED` — a build can never change owners |
| AC-9 | **Given** the profile section of `/garage` **When** a user updates their name, or changes their password (providing their current password) **Then** the change is saved; a successful password change also invalidates every other active session (Spec 16's pattern) while keeping the current one signed in |
| AC-10 | **Given** quote requests/reservations (§34.1) and public gallery entries (§35.2) don't exist yet **When** `/garage` renders in Phase 2 **Then** those sections are omitted entirely rather than shown as empty placeholders for features with no committed timeline — they're added by their own Phase 3 specs when built |
| AC-11 | **Given** a user with zero saved builds **When** `/garage` renders **Then** it shows a friendly empty state ("You haven't saved any builds yet") with a CTA into the configurator, not a blank list |
| AC-12 | **Given** a keyboard-only or screen-reader user **When** using `/garage` **Then** the build list, Load/Delete actions, and profile forms are all fully keyboard-operable with proper labels (SRS §29) |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/me/configurations` | session | `200` `ApiResponse<SavedConfigurationDto[]>` | current user's builds, newest first |
| `DELETE` | `/api/configurations/:publicId` | session | `204` | must be owned by the caller |
| `POST` | `/api/configurations/:publicId/claim` | session | `200` `ApiResponse<SavedConfigurationDto>` | only if currently unowned (AC-7/AC-8) |
| `PUT` | `/api/me/profile` | session | `200` `ApiResponse<UserDto>` | updates `name` |
| `PUT` | `/api/me/password` | session | `200` `ApiResponse<{ message: string }>` | requires `currentPassword` + `newPassword` |

### Extension to Spec 10's `POST /api/configurations`

Spec 10 remains the spec of record for this endpoint's contract, but this spec adds one behavior: if the request carries a valid session (Spec 16's cookie), the created `Configuration.userId` is set to that user and `expiresAt` is left `null`, instead of the guest path (`userId: null`, `expiresAt` 90 days out). No request/response shape changes — the distinction is driven entirely by whether a valid session is present, transparently to the caller.

### Request and response DTOs

```ts
// backend/src/types/garage.ts

export interface ClaimConfigurationResponse extends SavedConfigurationDto {} // from Spec 10, unchanged shape

export interface UpdateProfileRequest {
  name: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
```

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `409` | `ALREADY_CLAIMED` | claiming a build already owned by someone else (AC-8) |
| `404` | `CONFIGURATION_NOT_FOUND` | reused from Spec 10 — also returned for delete/claim attempts on another user's build, to avoid confirming its existence to a non-owner |
| `401` | `INVALID_CREDENTIALS` | reused from Spec 16 — wrong `currentPassword` on a password change |
| `400` | `VALIDATION_ERROR` | malformed request |

### Breaking-change check

- [x] No existing field removed, renamed, or narrowed in type — Spec 10's `POST /api/configurations` gains behavior, not a shape change.
- [x] No existing status code or `code` value changed.

---

## 4. Data model changes

None beyond what Specs 2, 10, and 16 already established — this spec only queries and updates existing columns (`Configuration.userId`, `Configuration.expiresAt`).

### Retention and privacy

Claimed builds (`userId` set) never expire, consistent with Spec 2's original design note that `expiresAt: null` is reserved for account-owned builds. Deleting a garage entry (AC-5) is a hard delete — no soft-delete/undo is specified, matching the confirmation-before-delete UX pattern instead of a recovery mechanism.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | skeleton rows while `GET /api/me/configurations` resolves |
| **Empty** | AC-11 |
| **Error** | a failed fetch shows Spec 12's generic error state with retry; a failed delete/claim shows an inline error via `getErrorMessage` without removing the row optimistically until the server confirms |
| **Success** | populated list; profile forms show a confirmation toast (Spec 12's `useToast`) on successful update |

Also specify:
- **Validation:** profile name is required and non-empty; new password follows Spec 16's minimum policy; password confirmation field must match.
- **Keyboard/screen-reader:** AC-12.
- **Responsive:** garage list is a card grid on desktop, a single column on mobile; profile forms are single-column on all viewports, consistent with Spec 16's auth forms.
- **Permission-gated content:** the entire route requires a session (AC-1) — this is the first Phase 2 route that's actually auth-gated, since Phase 1 kept everything guest-accessible per SRS §36.5.

**Route(s):** `/garage`
**Directory:** `frontend/src/app/garage/`, `backend/src/routes/me.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | claim ownership logic (unowned vs. already-claimed), password-change current-password verification | `backend/tests/garage.test.ts` |
| **Integration** | every endpoint's success/error paths, including the save-as-authenticated-user behavior extension to Spec 10's endpoint | `backend/tests/integration/garage.int.test.ts` |
| **Component** | garage list states (loading/empty/error/success), delete confirmation flow, profile forms | `frontend/tests/garage/*.test.tsx` |
| **E2E** | sign up → save a build while logged in → see it in `/garage` → load it → modify → save again → assert a second entry appears and the first is unchanged → delete the second → log out → save a build as a guest → log back in → claim that guest build's link → assert it now appears in `/garage` | `frontend/e2e/my-garage.spec.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1 | `my-garage.spec.ts :: auth redirect` |
| AC-2, AC-11 | `garage.int.test.ts` + `frontend/tests/garage/GarageList.test.tsx` |
| AC-3, AC-4 | `my-garage.spec.ts :: load, edit, save creates new entry` |
| AC-5 | `frontend/tests/garage/GarageList.test.tsx :: delete confirmation` |
| AC-6 | `garage.int.test.ts :: authenticated save sets userId` |
| AC-7, AC-8 | `garage.int.test.ts :: claim` |
| AC-9 | `garage.int.test.ts :: profile and password change` |
| AC-10 | `frontend/tests/garage/GarageList.test.tsx :: no placeholder sections` |
| AC-12 | `my-garage.spec.ts` keyboard pass |

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** the quote-request and gallery sections' actual implementation — Phase 3, per AC-10.

---

## 7. Out of scope

- Quote requests/reservations and public gallery entries themselves — Phase 3 (§34.1, §35.2); this spec only decides they're omitted for now (AC-10).
- Connected social accounts management — depends on Spec 16's deferred social login (that spec's Risk #1); nothing to manage until that ships.
- Any pagination of the garage list — not specified as a concern at current expected scale (a portfolio project's realistic build counts per user); revisit if it becomes one.

---

## 7a. Implementation notes

- **A real, independent bug in already-shipped Spec 10 code was fixed in this PR.** `getConfigurationByPublicId` unconditionally refreshed `expiresAt` to +90 days on every load. Since "Load" from My Garage (AC-3) hits this exact function, every load of an owned build would have silently un-nulled its "never expires" status (AC-6/§4) back to a 90-day countdown. Fixed by guarding the refresh to only run for a guest build (`userId === null`); an owned build's `expiresAt` is never touched again once set to `null`.
- **`SavedConfigurationDto` gained one additive field: `ownerId: string | null`.** The spec's own §3 breaking-change check ("no field removed/renamed/narrowed") permits this — nothing about the existing shape changed. It's populated by a new shared `mapConfigurationToDto()` helper (extracted from `getConfigurationByPublicId`'s previously-inline mapping, now reused by the list endpoint too) and is what lets the frontend know whether a loaded build is claimable at all: without it, there'd be no way to distinguish "a guest build I can claim" from "a build someone else already owns" from "my own build" on the loaded-build view.
- **AC-4 ("edit creates a new entry, never an in-place mutation") needed zero new code.** There was exactly one `prisma.configuration.update` call anywhere in the backend before this spec (the `expiresAt` refresh above, now guarded) and no PUT/PATCH route on `Configuration` — `save()` already always creates a fresh row via `createWithFreshPublicId`. Loading a build and clicking Save again was already guaranteed to produce a new `publicId`, confirmed by `garage.int.test.ts` and `my-garage.spec.ts` rather than assumed.
- **Claiming a build you already own is treated as idempotent success, not a 409.** AC-7/AC-8 don't cover a caller re-claiming their own already-claimed build. `decideClaimOutcome` (a pure, DB-independent function, unit-tested in `garage.test.ts`) resolves this as `"idempotent"` — a self-claim isn't an ownership change, so erroring would be surprising. Only a build owned by a *different* user 409s (`ALREADY_CLAIMED`).
- **Password change (AC-9) needed `requireAuth` to expose the raw session token, not just the resolved user.** `req.sessionToken` (a new field alongside `req.user`) lets `PUT /me/password` identify and exclude its own session from the bulk revocation — a new `revokeAllSessionsForUserExcept` mirrors Spec 16's `revokeAllSessionsForUser`, and is composed into the same `prisma.$transaction` pattern `passwordReset.ts` established, so the password-hash update and the other-session revocation happen atomically.
- **Wrong-current-password on `PUT /me/password` extends Spec 16's `ApiError.details` convention into a new context.** It returns `401 INVALID_CREDENTIALS` with `details: {currentPassword: [...]}` so the frontend shows it inline under the Current Password field rather than a generic banner — safe here specifically because the route is authenticated (the caller's identity is already known), unlike login's deliberately vague reuse of the same error code.
- **`(auth)/layout.tsx` now honors a `?returnTo=` query param (AC-1), validated by a new `isSafeReturnTo` open-redirect guard** — rejects anything not starting with a single `/`, and specifically also rejects a leading `/\` or `\`, since browsers normalize a leading backslash to a protocol-relative `//` before resolving a URL. Reading `returnTo` required `useSearchParams()`, which must be called in a descendant of a `<Suspense>` boundary — the layout now supplies one around `{children}` (fallback `null`, the same brief-flash trade-off already accepted on `authStore`), which let `reset-password/page.tsx` drop its own now-redundant local `<Suspense>` wrapper.
- **The garage list fetches each unique vehicle's full detail client-side, in parallel**, since `deriveBuildSummary` (Spec 9) needs the full option catalog per vehicle, not just name/thumbnail — `getVehicleDetail(slug)` was promoted from a page-local, non-exported helper in `configure/[slug]/page.tsx` to a shared `lib/api/vehicles.ts` export used by both. `GarageCard` treats "this vehicle's detail hasn't loaded yet" as an explicit skeleton state (a prop check), separate from "the summary genuinely failed to derive" (a try/catch), so the two don't get conflated into one silent fallback.
- **Delete is deliberately not optimistic.** A row stays in the list, with its own per-`publicId`-keyed pending/error state in `garageStore`, until the server confirms — matching §5's UI-states row. The delete confirmation dialog (`DeleteConfirmDialog`) is this app's first reusable confirm-before-destructive-action component, modeled directly on `CaptureBuild.tsx`'s existing success-modal pattern rather than inventing a new one.
- **State is split three ways, matching each store's existing purpose**: `garageStore` (new) owns only the list; profile-name and change-password live on `authStore` (an identity concern, alongside signup/login/reset, sharing its existing `isLoading`/`details`/`errorCode` fields — the two forms' field-specific `details` keys never collide, so inline errors always land under the right field regardless of which form last submitted); claiming the *currently-loaded single build* lives on `configurationStore`, since that's the store that already owns the configurator session's save state.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | SRS §36.4 says the dashboard shows saved builds "with load/edit/delete actions" — "edit" could be read as in-place mutation of a saved build rather than creating a new entry. | Product owner | Resolved — "edit" means load-then-save-as-new (AC-4), not in-place mutation, to preserve the integrity of any already-shared link to the original build (Spec 10's save/share model treats every `Configuration` row as an immutable snapshot once created). |
| 2 | The claim flow (AC-7) requires the frontend to show a "Save to My Garage" affordance on a shared-build view for signed-in users — this touches Spec 10's build-loading UI, which was written before accounts existed. | Implementer | Resolved — added directly to `SaveSharePanel.tsx`'s existing success state, conditioned on `authStore.user` being set and the loaded build's new `ownerId` field being `null`; never shows for a build the signed-in user already owns (including their own fresh saves, AC-6). |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A — no new schema beyond Specs 2/10/16.
- **Rollback:** remove `/garage` and the `me`/`claim` endpoints; Spec 10's save endpoint continues working, simply never setting `userId` again (reverting to guest-only saves).
- **Observability:** none beyond what Specs 12/16 already provide.

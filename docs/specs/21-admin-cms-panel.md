# Spec: Admin / CMS Panel

**File:** `docs/specs/21-admin-cms-panel.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §34.1 (Admin/CMS panel); depends on `02-vehicle-catalog-data-model.md`, `16-authentication.md`, `19-lead-capture-quote-request.md`, `20-reservation-deposit.md`

---

## 1. Problem statement

**Today:** The vehicle/option catalog (Spec 2) can only be changed by editing the seed script and redeploying — there's no way for a non-technical person to add a vehicle, tweak a price, or swap an asset URL. Leads (Spec 19) and reservations (Spec 20) also have no management view.

**Who is affected:** Whoever operates the catalog day-to-day in a real deployment; for this portfolio project, it demonstrates the ability to build internal tooling with proper access control.

**Why it matters now:** It's the last of §34.1's three business items, and depends on Leads and Reservations existing to have something to manage.

**Success looks like:** An admin logs in, edits a vehicle's price or adds a new customization option without touching code, and reviews incoming leads/reservations from one place — while a regular user has no visibility into or access to any of it.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a `User` with `role: ADMIN` **When** they visit `/admin` **Then** they see the admin panel; **given** any other user (including signed-out) **when** they visit `/admin` **then** they get a `404`-equivalent (not a "forbidden" page that confirms the route's existence) |
| AC-2 | **Given** the admin panel's Vehicles section **When** an admin creates, edits, or deactivates a vehicle **Then** the change is immediately reflected in `GET /api/vehicles` (Spec 2) — this spec implements the write endpoints Spec 2 deliberately deferred |
| AC-3 | **Given** the admin panel's Options section **When** an admin adds, edits, or removes a `CustomizationOption` (including price, `assetRef`, `isDefault`, `applyMode`) **Then** existing saved `Configuration`s referencing a *removed* option are not broken — removal is a soft-deactivation (`isActive: false`, filtered out of new selections) rather than a hard delete |
| AC-4 | **Given** the admin panel's Leads section **When** viewed **Then** it lists all `Lead` rows (Spec 19) with filtering by `status`, and lets an admin update `status` to `CONTACTED`/`CLOSED` |
| AC-5 | **Given** the admin panel's Reservations section **When** viewed **Then** it lists all `Reservation` rows (Spec 20) with their status, read-only (status changes come from Stripe webhooks, not manual edits) |
| AC-6 | **Given** any admin write action **When** performed **Then** it is recorded in a lightweight audit log (who, what, when) — the first place in this product where an internal actor's actions need traceability |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/admin/vehicles` | admin | `200` `ApiResponse<VehicleAdminDto[]>` | added during implementation — see note below |
| `POST` | `/api/admin/vehicles` | admin | `201` | |
| `PUT` | `/api/admin/vehicles/:id` | admin | `200` | `isActive:false` in the body is the deactivate action; no separate route |
| `GET` | `/api/admin/vehicles/:id/options` | admin | `200` `ApiResponse<OptionAdminDto[]>` | added during implementation — see note below |
| `POST` | `/api/admin/vehicles/:id/options` | admin | `201` | |
| `PUT` | `/api/admin/options/:id` | admin | `200` | |
| `DELETE` | `/api/admin/options/:id` | admin | `204` | soft-deactivates, per AC-3 |
| `GET` | `/api/admin/leads` | admin | `200` `ApiResponse<LeadDto[]>` | supports `?status=` and `?page=&pageSize=` |
| `PUT` | `/api/admin/leads/:id` | admin | `200` | status only, restricted to `CONTACTED`/`CLOSED` |
| `GET` | `/api/admin/reservations` | admin | `200` `ApiResponse<ReservationDto[]>` | supports `?page=&pageSize=` |

**Note (added during implementation):** the original endpoint table had no `GET` for listing Vehicles or a given vehicle's Options — an oversight, since AC-2/AC-3's create/edit/deactivate flow has no way to know what to edit without a listing endpoint first. Both were added following this table's existing conventions (admin-gated, paginated where it's a flat list). `VehicleAdminDto` extends the public `VehicleSummaryDto` with `id`, `heroModelUrl`, `showroomModelUrl`, and `isActive` (all needed for editing but not exposed publicly); `OptionAdminDto` extends `CustomizationOptionDto` with `isActive`, since the admin view — unlike the public catalog — must show deactivated rows too, to find and reactivate them.

**Note on the single-default invariant (added during implementation):** every single-select `OptionCategory` (Spec 6) is meant to have exactly one active default. AC-3's writes are guarded against *regressing* that — rejected if a write would leave two active defaults, or would remove a category's sole existing active default — but a category that simply has zero options yet (e.g. immediately after AC-2 creates a brand-new vehicle, before any options exist) is not treated as a violation; there is nothing to break yet. This distinction matters because a naive "every category must have exactly one default at all times" check would make it impossible to ever build up a new vehicle's catalog one option at a time.

An `admin` auth middleware checks the session (Spec 16) and `User.role === "ADMIN"`, returning `404` (not `403`) for anyone else, per AC-1's information-hiding choice.

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `404` | (generic route not found) | non-admin access, per AC-1 |
| `400` | `VALIDATION_ERROR` | malformed vehicle/option payload |

### Breaking-change check

- [x] No existing field removed/renamed/narrowed — this spec only adds write endpoints alongside Spec 2's existing read ones.

---

## 4. Data model changes

```prisma
// User (Spec 16) gains:
//   role String @default("USER") // "USER" | "ADMIN"

// CustomizationOption (Spec 2) gains:
//   isActive Boolean @default(true) — soft-deactivation per AC-3

model AuditLogEntry {
  id         String   @id @default(cuid())
  adminUserId String
  admin      User     @relation(fields: [adminUserId], references: [id])
  action     String   // e.g. "vehicle.update", "option.deactivate"
  targetType String
  targetId   String
  metadata   Json?
  createdAt  DateTime @default(now())
}
```

### Migration

- **Name:** `AddAdminRoleAndCms`
- **Reversible:** yes.
- **Backfill required:** existing users default to `role: "USER"`.

### Retention and privacy

Audit log entries are internal operational data, not subject to user-facing GDPR export/deletion.

---

## 5. UI states

Standard internal-tool patterns: table views with loading skeletons, inline edit forms, confirmation on deactivation/status changes, error toasts on failed writes (Spec 12's shared components). No special design polish required beyond functional clarity — this is internal tooling, not the customer-facing product surface SRS §21 targets.

**Route(s):** `/admin`, `/admin/vehicles`, `/admin/leads`, `/admin/reservations`
**Directory:** `frontend/src/app/admin/`, `backend/src/routes/admin.ts`, `backend/src/middleware/requireAdmin.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | `requireAdmin` middleware rejects non-admins with 404, not 403 | `backend/tests/admin.test.ts` |
| **Integration** | every admin endpoint's success/authorization paths; soft-deactivation preserves existing `Configuration` integrity | `backend/tests/integration/admin.int.test.ts` |
| **E2E** | admin creates a vehicle, edits an option's price, deactivates an option already used in a saved build, confirms that build still loads correctly | `frontend/e2e/admin.spec.ts` |

**Coverage:** ≥80% on new code; authorization checks at 100%.

---

## 7. Out of scope

- Asset file upload (GLB/image) — admins edit URL fields; a real upload pipeline (to S3/Cloudinary or similar) is a further enhancement, not built here.
- Granular permission levels beyond a single `ADMIN` role — no "editor vs. super-admin" distinction.
- Bulk import/export tooling.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | The first `ADMIN` user has to be created somehow (no self-service admin sign-up, for obvious security reasons). | Implementer | Resolved — promote via a one-off database script/seed at deploy time, not via any UI. |
| 2 | No asset upload means an admin still needs external tooling to host a new GLB/image and get its URL — this spec doesn't close that loop end-to-end. | Product owner | Resolved — accepted; ties to Spec 25's asset-versioning/CDN policy, which governs how those URLs should be structured once obtained. |

---

## 9. Rollout

- **Feature flag:** none — access is fully gated by role, which is a stronger control than a flag.
- **Migration order:** after Leads (19) and Reservations (20).
- **Rollback:** remove admin routes/pages; `role` column and soft-deactivation flag can remain harmlessly unused.
- **Observability:** the audit log (AC-6) *is* this spec's observability story for admin actions.

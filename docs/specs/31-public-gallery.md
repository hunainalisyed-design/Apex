# Spec: Public Build Gallery & Likes

**File:** `docs/specs/31-public-gallery.md`
**Status:** Draft
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §35.2 (Public build gallery); depends on `16-authentication.md`, `17-account-dashboard-my-garage.md`, `11-screenshot-capture.md`

---

## 1. Problem statement

**Today:** A build is only visible to whoever has its link (Spec 10) or its owner's garage (Spec 17). SRS §35.2 wants a public gallery — "Most Popular Builds This Week" — with likes, turning individual configuration into a social feed that drives return visits. SRS §36.5 already specifies that publishing to the gallery is one of the specific actions that *requires* an account, unlike everything in Phase 1/2's core experience.

**Who is affected:** Users who want to show off a build publicly; visitors browsing for inspiration.

**Why it matters now:** It's the first genuinely public, user-generated-content-adjacent surface in the product, so its scope is deliberately narrowed to minimize moderation risk (see §7).

**Success looks like:** A signed-in user publishes their finished build with one click, it appears in the public gallery with its captured image (Spec 11), other signed-in users can like it, and a "Most Popular This Week" sort surfaces what's resonating.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a signed-in user's saved build (Spec 17, My Garage) **When** they click "Publish to Gallery" **Then** `Configuration.isPublished` is set `true` with a `publishedAt` timestamp, and it becomes visible on `/gallery` — this requires an account (SRS §36.5); guests cannot publish |
| AC-2 | **Given** `/gallery` **When** it loads **Then** it lists published builds as cards showing the captured image (Spec 11, generated automatically at publish time if not already captured), vehicle name, and like count, with sort options "Most Recent" and "Most Popular This Week" (likes accrued in the last 7 days) |
| AC-3 | **Given** a signed-in user viewing a gallery entry **When** they click "Like" **Then** a `Like` row is created (unique per user+configuration); clicking again removes it (toggle, not accumulate) |
| AC-4 | **Given** a signed-out visitor **When** they click "Like" **Then** they're prompted to sign in first — browsing the gallery requires no account, liking does |
| AC-5 | **Given** a gallery entry **When** viewed **Then** it exposes no free-text field authored by the publishing user (no caption, no comment) — the entry is entirely derived from structured configuration data (vehicle + selections + price) and the auto-generated capture image, deliberately minimizing user-generated-content moderation surface |
| AC-6 | **Given** a user unpublishes their build (toggle off) **When** done **Then** it's removed from `/gallery` immediately; existing likes are preserved (not deleted) in case it's republished later |
| AC-7 | **Given** a build owner deletes the underlying `Configuration` (Spec 17's Delete action) **When** it was published **Then** it's also removed from the gallery and its likes are deleted (cascade) |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/configurations/:publicId/publish` | session (owner) | `200` | |
| `POST` | `/api/configurations/:publicId/unpublish` | session (owner) | `200` | |
| `GET` | `/api/gallery` | none | `200` `ApiResponse<GalleryEntryDto[]>` | supports `?sort=recent\|popular` |
| `POST` | `/api/gallery/:publicId/like` | session | `200` | toggles |

### DTOs

```ts
export interface GalleryEntryDto {
  publicId: string;
  vehicleName: string;
  captureImageUrl: string;
  likeCount: number;
  likedByMe: boolean; // false if signed out
  publishedAt: string;
}
```

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `403` | `NOT_BUILD_OWNER` | publish/unpublish attempted by a non-owner |
| `404` | `CONFIGURATION_NOT_FOUND` | reused |

### Breaking-change check

- [x] Additive only.

---

## 4. Data model changes

```prisma
// Configuration (Spec 2) gains:
//   isPublished  Boolean   @default(false)
//   publishedAt  DateTime?
//   captureImageUrl String? // set at publish time if not already captured (Spec 11)

model Like {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id])
  configurationId String
  configuration   Configuration @relation(fields: [configurationId], references: [id], onDelete: Cascade)
  createdAt       DateTime @default(now())

  @@unique([userId, configurationId])
}
```

### Migration

- **Name:** `AddGalleryAndLikes`
- **Reversible:** yes.
- **Backfill required:** no — existing rows default `isPublished: false`.

### Retention and privacy

Gallery entries expose only the publishing user's build data, never their name/email — no personal identity is shown publicly (consistent with AC-5's minimal-surface design).

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | skeleton cards |
| **Empty** | "No builds published yet — be the first!" with a CTA into the configurator |
| **Error** | Spec 12's generic pattern |
| **Success** | card grid, like toggle with optimistic UI (reverted on failure) |

**Route(s):** `/gallery`
**Directory:** `frontend/src/app/gallery/`, `backend/src/routes/gallery.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Integration** | publish/unpublish ownership checks, like toggle idempotency, popular-sort time-windowing | `backend/tests/integration/gallery.int.test.ts` |
| **Component** | gallery states, sign-in prompt on guest like attempt | `frontend/tests/gallery/*.test.tsx` |
| **E2E** | publish a build → appears in gallery → like from a second account → unpublish → disappears, likes preserved | `frontend/e2e/public-gallery.spec.ts` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Comments or any free-text user content (AC-5) — deliberate, to keep this a low-moderation-risk feature.
- Reporting/flagging inappropriate content — with no free text and no user-uploaded images (the capture image is auto-generated from structured data, not uploaded), the moderation surface is intentionally close to zero; revisit only if that assumption changes.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Even without free text, a vehicle name/thumbnail is fixed catalog content — there's essentially no way for a published entry to contain anything other than legitimate configuration data, which is why this spec skips building moderation tooling. | Product owner | Resolved — accepted; revisit only if a future spec adds any free-text or user-uploaded-image field to a `Configuration`. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** after Spec 16 (auth) and Spec 11 (capture).
- **Rollback:** remove `/gallery` and like endpoints; `isPublished`/`Like` data can remain unused harmlessly.
- **Observability:** track publish/like rates as an engagement signal once Spec 23's analytics exists.

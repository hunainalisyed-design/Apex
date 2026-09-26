# Spec: Public Build Gallery & Likes

**File:** `docs/specs/31-public-gallery.md`
**Status:** Implemented
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
| AC-1 | **Given** a signed-in user's build in the configurator **When** they click "Publish to Gallery" **Then** the build is saved if it has unsaved changes (and claimed if it's a guest build they're viewing), its Spec 11 capture (1600×900 PNG) is taken automatically and uploaded, `Configuration.isPublished` is set `true` with a `publishedAt` timestamp, and it becomes visible on `/gallery` — this requires an account (SRS §36.5); guests cannot publish. Publishing happens in the configurator because the image is captured from the 3D scene; My Garage (Spec 17) shows a "Published" badge with Unpublish, and a Publish link into the configurator |
| AC-2 | **Given** `/gallery` **When** it loads **Then** it lists published builds as cards showing the captured image, vehicle name, price, and like count, with sort options "Most Recent" and "Most Popular This Week" (likes accrued in the last 7 days), 24 per page with "Load More". Builds of deactivated vehicles are not listed |
| AC-3 | **Given** a signed-in user viewing a gallery entry **When** they click "Like" **Then** a `Like` row is created (unique per user+configuration); clicking again removes it (toggle, not accumulate) |
| AC-4 | **Given** a signed-out visitor **When** they click "Like" **Then** they're prompted to sign in first — browsing the gallery requires no account, liking does |
| AC-5 | **Given** a gallery entry **When** viewed **Then** it exposes no free-text field authored by the publishing user (no caption, no comment) — the entry is entirely derived from structured configuration data (vehicle + selections + price) and the auto-generated capture image, deliberately minimizing user-generated-content moderation surface |
| AC-6 | **Given** a user unpublishes their build (toggle off) **When** done **Then** it's removed from `/gallery` immediately; existing likes are preserved (not deleted) in case it's republished later |
| AC-7 | **Given** a build owner deletes the underlying `Configuration` (Spec 17's Delete action) **When** it was published **Then** it's also removed from the gallery and its likes are deleted (cascade) |
| AC-8 | **Given** a user deletes their account (Spec 24) **When** they had published builds **Then** those builds are unpublished in the same transaction (the builds themselves are kept ownerless, as Spec 24 already does), and their likes are deleted; the Spec 24 data export includes the user's likes |
| AC-9 | **Given** an admin at `/admin/gallery` **When** they click "Unpublish" on any entry **Then** it's removed from the gallery immediately and the action is recorded in the admin audit log (moderation safety valve — see Risk #1) |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/configurations/:publicId/publish` | session (owner) | `200` `ApiResponse<PublishStatusDto>` | body: the capture, `Content-Type: image/png`; must be a PNG of exactly 1600×900, ≤ 3 MB; 5/min per IP |
| `POST` | `/api/configurations/:publicId/unpublish` | session (owner) | `200` `ApiResponse<PublishStatusDto>` | |
| `GET` | `/api/gallery` | none (session optional, for `likedByMe`) | `200` `ApiResponse<GalleryPageDto>` | `?sort=recent\|popular&page=N` |
| `POST` | `/api/gallery/:publicId/like` | session | `200` `ApiResponse<LikeToggleDto>` | toggles; 60/min per IP |
| `GET` | `/api/gallery/:publicId/image/:hash.png` | none | `200` `image/png` | `hash` = first 16 hex chars of the image's SHA-256; `Cache-Control: public, max-age=31536000, immutable`; published builds only |
| `POST` | `/api/admin/gallery/:publicId/unpublish` | admin | `200` | AC-9; audited as `gallery.unpublish`; admin routes are undocumented in OpenAPI, like the rest of `/api/admin` |

### DTOs

```ts
export interface GalleryEntryDto {
  publicId: string;
  vehicleSlug: string;
  vehicleName: string;
  captureImageUrl: string; // API path of the image, content-addressed
  totalPriceCents: number;
  currency: string;
  likeCount: number;
  weeklyLikeCount: number; // likes in the last 7 days — the "popular" sort key
  likedByMe: boolean; // false if signed out
  publishedAt: string;
}

export interface GalleryPageDto {
  entries: GalleryEntryDto[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface LikeToggleDto { liked: boolean; likeCount: number }
export interface PublishStatusDto { publicId: string; isPublished: boolean; publishedAt: string | null }

// SavedConfigurationDto (Spec 10) gains: isPublished: boolean; publishedAt: string | null
```

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | reused — missing/invalid image (`details.image`), bad `sort`/`page` |
| `401` | `UNAUTHENTICATED` | reused — publish/unpublish/like while signed out |
| `404` | `CONFIGURATION_NOT_FOUND` | reused — no such build, **or a build the caller doesn't own** (the codebase's rule since Spec 17: a non-owner can't tell it exists, so there's no separate 403), or liking an unpublished build |
| `429` | `RATE_LIMITED` | reused |

### Breaking-change check

- [x] Additive only.

---

## 4. Data model changes

```prisma
// Configuration (Spec 2) gains:
//   isPublished  Boolean   @default(false)
//   publishedAt  DateTime?

model Like {
  id              String   @id @default(cuid())
  userId          String
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  configurationId String
  configuration   Configuration @relation(fields: [configurationId], references: [id], onDelete: Cascade)
  createdAt       DateTime @default(now())

  @@unique([userId, configurationId])
  @@index([configurationId, createdAt])
}

// The captured image, stored in the database (no object storage exists yet) and replaced on
// republish. One per build.
model GalleryImage {
  id              String   @id @default(cuid())
  configurationId String   @unique
  configuration   Configuration @relation(fields: [configurationId], references: [id], onDelete: Cascade)
  data            Bytes
  contentType     String
  sha256          String
  createdAt       DateTime @default(now())
}
```

### Migration

- **Name:** `add_gallery_and_likes`
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

**Route(s):** `/gallery` (in the nav and sitemap), `/admin/gallery`
**Directory:** `frontend/src/app/gallery/`, `frontend/src/components/gallery/`, `frontend/src/components/configurator/PublishToGallery/`, `backend/src/routes/gallery.ts`, `backend/src/services/gallery.ts`

A signed-out visitor who clicks Like gets a sign-in dialog (Log In / Sign Up, returning to `/gallery`). While publishing captures the scene, the other capture buttons, camera presets and environment switcher are locked, as with Spec 30.

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Integration** | publish/unpublish ownership checks, image validation, like toggle idempotency, popular-sort time-windowing, pagination, delete cascade, account deletion, admin unpublish + audit | `backend/tests/integration/gallery.int.test.ts` |
| **Component** | gallery states, optimistic like and revert, sign-in prompt on guest like attempt, publish control, garage badge/unpublish, admin moderation | `frontend/tests/gallery/*.test.tsx`, `frontend/tests/configurator/PublishToGallery.test.tsx`, `frontend/tests/garage/GarageList.test.tsx`, `frontend/tests/admin/GalleryModeration.test.tsx` |
| **E2E** | publish a build → appears in gallery → guest prompted to sign in → like from a second account → unpublish → disappears → republish, likes preserved; admin takedown; nav link | `frontend/e2e/public-gallery.spec.ts` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Comments or any free-text user content (AC-5) — deliberate, to keep this a low-moderation-risk feature.
- User reporting/flagging of entries — with no free text, the moderation surface stays small; the admin Unpublish (AC-9) covers takedowns. Revisit if abuse appears.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | The capture is rendered from the 3D scene in the owner's browser (the server has no renderer), so the image is technically uploaded: the server can enforce the format and exact size, but can't prove the pixels are a real capture. | Product owner | Resolved — accepted with safeguards: strict PNG/size validation, a publish rate limit, no free text anywhere (AC-5), and an admin Unpublish with audit logging (AC-9). |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** after Spec 16 (auth) and Spec 11 (capture).
- **Rollback:** remove `/gallery` and like endpoints; `isPublished`/`Like` data can remain unused harmlessly.
- **Observability:** track publish/like rates as an engagement signal once Spec 23's analytics exists.

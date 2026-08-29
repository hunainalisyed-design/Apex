# Spec: Dynamic Environments

**File:** `docs/specs/28-dynamic-environments.md`
**Status:** Draft
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §35.1 (Dynamic environments); depends on `05-3d-showroom-core.md`, `10-save-share-configuration.md`, `11-screenshot-capture.md`

---

## 1. Problem statement

**Today:** The showroom always renders the same dark studio environment (Spec 5). SRS §35.1 wants users to place their finished build into different scenes (night city, coastal road, track, showroom) with matching lighting/reflections, showcasing paint properties (metallic/pearl) that only read correctly under varied lighting.

**Who is affected:** Users admiring a finished build, and anyone sharing a screenshot (Spec 11) or gallery entry (Spec 31) — a night-city backdrop reads as more shareable than a neutral studio.

**Why it matters now:** It's a relatively contained, purely visual/environmental feature with no pricing or catalog-selection implications, making it a good next item after the heavier AR spec.

**Success looks like:** A user picks "Coastal Road" from an environment switcher, and the vehicle's reflections and lighting genuinely change to match, not just the background image behind it.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** an environment switcher in the showroom **When** opened **Then** it lists available environments (Night City, Coastal Road, Track, Studio — the current default) with thumbnails |
| AC-2 | **Given** an environment is selected **When** applied **Then** both the background/skybox *and* the HDRI-based image-based lighting (IBL) update together, so the vehicle's paint (especially metallic/pearl finishes, Spec 6) visibly reflects the new environment — not just a background swap behind an unchanged-looking car |
| AC-3 | **Given** an environment change **When** applied **Then** it transitions smoothly (crossfade), respecting `prefers-reduced-motion` (Spec 12) by cutting instantly instead |
| AC-4 | **Given** a build is saved (Spec 10) **When** saved **Then** the selected environment is stored alongside it (`Configuration.environmentId`) and restored when the build is loaded — environment is part of "how you want to remember/share this build," even though it carries no price |
| AC-5 | **Given** a screenshot is captured (Spec 11) **When** composited **Then** it uses whatever environment is currently active, not always the default studio |

---

## 3. API contract

No new endpoints — environments are read via an addition to `GET /api/vehicles` or a small `GET /api/environments` list (global, not per-vehicle, since environments are scene presets independent of which car is in them).

```ts
export interface EnvironmentDto {
  id: string;
  name: string;
  hdriUrl: string;
  thumbnailUrl: string;
}
```

### Breaking-change check

- [x] Additive only — `Configuration.environmentId` is a new nullable field; existing rows default to the studio environment when `null`.

---

## 4. Data model changes

```prisma
model Environment {
  id           String @id @default(cuid())
  name         String
  hdriUrl      String
  thumbnailUrl String
  sortOrder    Int    @default(0)
}

// Configuration (Spec 2) gains:
//   environmentId String?
//   environment   Environment? @relation(fields: [environmentId], references: [id])
```

### Migration

- **Name:** `AddEnvironments`
- **Reversible:** yes.
- **Backfill required:** no — `null` means "default studio," no existing row needs an explicit value.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | HDRI download shows a brief crossfade-in once ready; scene doesn't block on it (default studio shows immediately) |
| **Error** | HDRI load failure falls back silently to the default studio environment, logged but not surfaced as a user-facing error (purely cosmetic feature) |
| **Success** | AC-2/AC-3 |

**Route(s):** integrated into `/configure/[slug]`.
**Directory:** `frontend/src/components/showroom/EnvironmentSwitcher/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | environment-to-scene application (skybox + IBL applied together, never independently) | `frontend/tests/showroom/environment.test.ts` |
| **Component** | switcher UI, reduced-motion transition behavior | `frontend/tests/showroom/EnvironmentSwitcher.test.tsx` |
| **E2E** | select each environment, assert scene state changes; save with a non-default environment, reload, assert it's restored | `frontend/e2e/dynamic-environments.spec.ts` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- User-uploaded custom environments.
- Environment-specific pricing or gating (all environments are free and available to everyone, guest or not).

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | HDRI files are typically large; loading one per environment switch could hurt performance on mobile (SRS §26). | Implementer | Open — recommend compressed/low-res HDRI variants for mobile, decided at implementation time, not a product decision. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** after Spec 10 (needs `Configuration` to exist).
- **Rollback:** remove the switcher and `environmentId` column; showroom reverts to the single default studio.
- **Observability:** none beyond existing showroom logging.

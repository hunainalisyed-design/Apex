# Spec: Dynamic Environments

**File:** `docs/specs/28-dynamic-environments.md`
**Status:** Implemented
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

### How each criterion is implemented

- **The four scenes** are CC0 HDRIs from [Poly Haven](https://polyhaven.com), self-hosted in `frontend/public/assets/environments/` with versioned names (Spec 25; `.hdr` was added to the versioned extensions and the `immutable` cache rule):
  - **Studio:** `studio_small_09`
  - **Night City:** `cobblestone_street_night`
  - **Coastal Road:** `victoria_sunset`, an asphalt road by the ocean
  - **Track:** `zwartkops_straight_afternoon`, a real circuit straight

  `shanghai_bund` was tried first for Night City and rejected: its promenade stretched badly under ground projection. Scenes were chosen and tuned from real renders of the cars in each one.
- **AC-1:** `EnvironmentSwitcher` is a labelled group of thumbnail toggle buttons (`aria-pressed`, keyboard-reachable), styled like `CameraPresetBar` and placed with the camera and lighting controls. It's hidden if fewer than two environments are available. The thumbnails are Poly Haven's previews, cropped from the top to hide their reference-sphere strip.
- **AC-2:** `environmentSceneSettings` (`frontend/src/lib/showroom/environment.ts`) takes backdrop *and* lighting from one environment and one HDRI. `SceneEnvironment` applies it with drei's `<Environment>`:
  - **Outdoor scenes** use `ground`, which sets the scene's image-based lighting and renders the ground-projected backdrop from the same texture, so the car stands on the road. The studio floor is hidden.
  - **Studio** keeps its gradient backdrop and reflective floor, and gains a dimmed (0.6) studio HDRI for lighting and reflections only. Before this spec the showroom had no environment map at all.

  The environment sits at the active rig's floor level, so both the real-model and placeholder rigs stand on the ground. The Mustang's metalness workaround in `RealGlbShowroomRig` was re-checked with lighting and left as-is: it still reads correctly.
- **AC-3:** a real crossfade. On selection, `useShowroomEnvironment` freezes the current frame (`captureFrame`, which already keeps the drawing buffer for Spec 11) as an image over the canvas and swaps the environment underneath. Once the new HDRI reports ready, it fades the image out over 600 ms; a 10 s safety timeout means the overlay can never get stuck. With `prefers-reduced-motion`, there's no overlay and it cuts instantly.
- **AC-4:** `Configuration.environmentId` (nullable, where null means Studio) is saved and returned by `POST` / `GET /api/configurations`, and passes through claim, My Garage and the GDPR export via the shared DTO mapper. The client store saves it, restores it from shared links, and counts a change as unsaved. **Reset deliberately leaves it alone:** it resets the car, and the scene is a viewing preference.
- **AC-5:** by construction. Capture reads the WebGL canvas (`gl.domElement.toDataURL`), and the environment is rendered into that canvas; the crossfade's frame snapshot uses the same path. The DOM overlay is never part of a capture.
- **Risk #1 (mobile):** outdoor HDRIs ship at 2k (~6.5 MB) for desktop and 1k (~1.6 MB) for screens of 768 px or narrower (`hdriMobileUrl`). Studio ships 1k only, since it's used for lighting alone. Nothing loads until that environment is chosen, and the car never waits on an HDRI.

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `GET` | `/api/environments` | none | `200` `{ data: EnvironmentDto[] }` | global (not per-vehicle), in switcher order |

Existing: `POST /api/configurations` accepts an optional `environmentId` (omitted or null means Studio). An unknown id gets `400 VALIDATION_ERROR` with `details.environmentId`. `SavedConfigurationDto` gains `environmentId: string | null`. Both appear in the generated OpenAPI docs (Spec 26).

```ts
export interface EnvironmentDto {
  id: string;                  // stable, e.g. "night-city"
  name: string;
  hdriUrl: string;             // desktop (2k)
  hdriMobileUrl: string;       // small screens (1k); may equal hdriUrl
  thumbnailUrl: string;
  isStudio: boolean;           // studio backdrop + floor, HDRI for lighting only
  groundHeight: number | null; // ground projection (outdoor only), scene units
  groundRadius: number | null;
}
```

### Breaking-change check

- [x] Additive only — `Configuration.environmentId` is a new nullable field and the request field is optional; existing rows and clients behave as Studio.

---

## 4. Data model changes

```prisma
model Environment {
  id             String          @id @default(cuid()) // seeded with stable ids: studio, night-city, coastal-road, track
  name           String
  hdriUrl        String
  hdriMobileUrl  String
  thumbnailUrl   String
  isStudio       Boolean         @default(false)
  groundHeight   Float?
  groundRadius   Float?
  sortOrder      Int             @default(0)
  configurations Configuration[]
}

// Configuration gains:
//   environmentId String?
//   environment   Environment? @relation(fields: [environmentId], references: [id], onDelete: SetNull)
```

`onDelete: SetNull` means removing an environment never breaks a shared build link; the build just shows Studio. This is covered by an integration test.

### Migration

- **Name:** `20260926084525_add_environments`
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
| **Unit** | environment-to-scene application (skybox + IBL applied together, never independently), fallback resolution, mobile HDRI choice | `frontend/tests/showroom/environment.test.ts` |
| **Component** | switcher UI; the hook's crossfade, reduced-motion cut, safety timeout and Studio fallback on HDRI failure; the store's unsaved-change and Reset behaviour | `frontend/tests/showroom/EnvironmentSwitcher.test.tsx` |
| **Integration** | list order, versioned files exist on disk, save and load round trip, null and omitted mean Studio, unknown id rejected, SetNull on delete | `backend/tests/integration/environments.int.test.ts` |
| **Manual** | real renders of real-model and placeholder cars in every environment (used to pick and tune the HDRIs), plus the switcher UI | headless Chromium, not committed |
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
| 1 | HDRI files are typically large; loading one per environment switch could hurt performance on mobile (SRS §26). | Implementer | Resolved: 1k variants (~1.6 MB) on small screens and 2k (~6.5 MB) on desktop, loaded only on selection and never blocking the car. A later option is gain-map JPEG HDRIs (three's `UltraHDRLoader`), roughly 5–10× smaller. |
| 2 | Ground projection only suits some HDRIs; near-camera objects in the photo distort. | Implementer | Resolved by choosing HDRIs from real renders (see "How each criterion is implemented"). Any future environment needs the same visual check, and its `groundHeight` / `groundRadius` tuned. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** after Spec 10 (needs `Configuration` to exist).
- **Rollback:** remove the switcher and `environmentId` column; showroom reverts to the single default studio.
- **Observability:** HDRI load failures are logged (`console.warn`) and sent to Sentry, tagged `feature: environments` with the environment id. Users are never shown an error.

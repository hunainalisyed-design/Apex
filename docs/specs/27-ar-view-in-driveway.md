# Spec: AR "View in Your Driveway"

**File:** `docs/specs/27-ar-view-in-driveway.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §35.1 (AR); depends on `05-3d-showroom-core.md`, `06-exterior-customization.md`, `07-interior-customization.md`, `08-accessories-packages.md`

---

## 1. Problem statement

**Today:** A user can only see their build inside the browser's 3D scene. SRS §35.1 calls AR "the single biggest 'wow' feature in premium automotive configurators" — placing the actual configured car, life-size, in the user's real environment via their phone camera.

**Who is affected:** Mobile users on AR-capable devices (a meaningful but not universal subset — see Risk #1).

**Why it matters now:** It's the highest-impact item in the §35.1 group, but also the most technically demanding in this backlog after live collaboration (Spec 33) — worth spec'ing early in the trending group so its asset-pipeline implications are known before the others.

**Success looks like:** A user on a supported device taps "View in Your Driveway," points their phone at the floor, and sees their exact configured vehicle — the paint, wheels, and accessories they chose — standing there at real-world scale.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a device/browser combination that supports AR Quick Look (iOS Safari) or Scene Viewer (Android Chrome, via WebXR or `<model-viewer>`'s `ar` attribute) **When** the showroom loads **Then** an "View in Your Driveway" button is visible; **given** an unsupported device **when** the showroom loads **then** the button is not shown at all — progressive enhancement, no broken/dead button |
| AC-2 | **Given** the button is tapped **When** the AR asset is prepared **Then** it reflects the user's *exact current configuration* (paint, wheels, calipers, accessories — everything customizable via Specs 6–8), exported live from the Three.js scene via `GLTFExporter`, not a generic default model |
| AC-3 | **Given** the exported model **When** the platform is iOS **Then** a USDZ version is used for Quick Look (iOS does not support glTF/GLB directly); **given** Android **when** used **then** the GLB itself is used directly via Scene Viewer |
| AC-4 | **Given** the AR session **When** active **Then** the vehicle appears at real-world scale (using the vehicle's real dimensions, not an arbitrary default) and can be repositioned by the user per the platform's native AR UI (this spec doesn't build custom AR placement UI — it hands off to the OS-native viewer) |
| AC-5 | **Given** live export + USDZ conversion takes longer than an instant tap **When** the user taps the button **Then** a loading state shows until the AR viewer launches, with a clear error state if export or conversion fails |

### How each criterion is implemented

- **Scope decision: real-model vehicles only.** The button appears only for the four vehicles backed by a real GLB (`frontend/src/lib/showroom/realGlbVehicles.ts`). Putting the procedural placeholder rig (Apex GT/RS) life-size in someone's driveway would undercut the premium experience rather than add to it.
- **AC-1:** `frontend/src/lib/ar/capability.ts` decides whether the device has a native AR viewer:
  - **iOS:** Quick Look is detected with `document.createElement("a").relList.supports("ar")`. This check is guarded, because `supports()` may throw rather than return false.
  - **Android:** any Android browser that can open Scene Viewer's `intent://` link, meaning Chrome-based ones. Firefox and the Oculus browser are excluded.

  `ArButton` reads the result with `useSyncExternalStore`, whose server snapshot is null, so the button never shows during server rendering or hydration. It renders nothing unless the flag is on, the device is supported, and the vehicle has a real model.
- **AC-2:** `ShowroomControls.getVehicleObject()` exposes the car currently in the scene (the rig inside its wrapper group). `prepareArScene` clones it, sharing materials, so the current paint, including a live custom colour, is what gets exported. On real GLBs paint is the only option with a visual effect (see `RealGlbShowroomRig.tsx`), so AR matches the showroom exactly. It doesn't invent wheel or accessory changes the 3D view doesn't show.
- **AC-3:** both files are built **in the browser**. There's no server-side conversion:
  - **Android** gets a GLB from three's `GLTFExporter`. Opaque textures are written as JPEG instead of PNG, which roughly halves the file.
  - **iOS** gets a USDZ from three's `USDZExporter`, which ships with the installed three.js 0.171.
  - Android's Scene Viewer is a separate app that has to download the model itself, so the GLB is uploaded to a short-lived backend host (§3). iOS Quick Look opens the in-browser file directly.
  - `<model-viewer>` was considered and rejected: version 4.x requires three.js ^0.183, while this project is on 0.171.
- **AC-4:** each registry entry has a `lengthMeters`, an approximate published overall length. The export is rescaled from the showroom's framing units to that length, centred and sitting on the ground. Both viewers are told not to allow resizing: `resizable=false` for Scene Viewer and `#allowsContentScaling=0` for Quick Look. Placement uses each OS's own AR UI.
- **AC-5:** the button shows "Preparing AR…" (disabled, `aria-busy`) while it works. On failure it shows "AR preview unavailable right now", and the configurator stays fully usable. Failures go to Sentry, tagged by platform.

### iOS file size (the Step 0 test, run before the rest was built)

The real models were exported with the actual exporters in headless Chromium. USDZExporter writes geometry as text, so the ~300k-triangle models produced **31–50 MB USDZ files taking ~30 s** even on a desktop. That's unusable on a phone. Android's GLBs were fine at 1.8–11 MB.

The fix is `frontend/src/lib/ar/simplify.ts`, used for the iOS export only. It runs `meshoptimizer`'s simplifier (the `meshoptimizer/simplifier` subpath, ~55 KB, lazy-loaded only on that path) to the per-car `usdzTriangleRatio` (0.3–0.35), with borders locked and unused vertices dropped. Multi-material and tiny meshes are left alone. The result is **~18–26 MB in under a second**, with small seam artifacts on the Porsche at close range; this trade-off was approved by the product owner. The 1965 Mustang (63k triangles, 6.4 MB) isn't simplified. Android always keeps full detail.

---

## 3. API contract

The planned `POST /api/ar/export` (server-side render and conversion) was **not built**: conversion happens in the browser (see AC-3). It was replaced by a small host that exists only because Scene Viewer downloads the model itself.

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/ar/models` | none | `201` `{ data: ArModelUploadDto }` | raw GLB body (`Content-Type: model/gltf-binary`), ≤ 30 MB, rate-limited 5/min/IP |
| `GET` | `/api/ar/models/:id.glb` | none | `200` binary GLB | `Cache-Control: private, max-age=600`; 404 after 10 minutes |

```ts
export interface ArModelUploadDto {
  url: string;       // absolute, 128-bit random id — unguessable
  expiresAt: string; // ISO 8601
}
```

Models live in memory only (`backend/src/services/ar/modelStore.ts`). They expire after 10 minutes, with a 200 MB total cap that evicts the oldest first. Uploads must have a valid glTF 2.0 header whose declared length matches the bytes received. Nothing touches the database. `AR_PUBLIC_BASE_URL` overrides the origin used in `url`, which is needed behind a proxy or CDN; Scene Viewer needs a public HTTPS URL. Both endpoints appear in the generated OpenAPI docs (Spec 26).

### Error codes

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | body isn't a valid GLB, or wrong content type |
| 404 | `AR_MODEL_NOT_FOUND` | unknown or expired id |
| 413 | `AR_MODEL_TOO_LARGE` | upload over 30 MB |
| 429 | `RATE_LIMITED` | more than 5 uploads per minute per IP |
| 503 | `AR_DISABLED` | `AR_ENABLED=false` |

### Breaking-change check

- [x] First version of this contract.

---

## 4. Data model changes

None. Real-world lengths live in the frontend real-GLB registry, next to each model's other per-asset tuning, rather than in a new database column.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Unsupported device / placeholder vehicle / flag off** | button absent entirely (AC-1) |
| **Scene not ready** | button visible but disabled |
| **Loading** | "Preparing AR…" (disabled, `aria-busy`) while export/upload runs |
| **Error** | "AR preview unavailable right now. You can keep configuring as usual." (`role="alert"`), button usable again |
| **Success** | native AR viewer launches (iOS Quick Look / Android Scene Viewer) |

**Route(s):** button integrated into `/configure/[slug]`'s side panel.
**Directory:** `frontend/src/components/ar/`, `frontend/src/lib/ar/`, `backend/src/services/ar/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | GLB export carries the current paint colour and all meshes; the car is rescaled to its real length, grounded and centred, without touching the live scene; device detection across user agents; the Scene Viewer intent link | `frontend/tests/ar/export.test.ts` |
| **Unit** | USDZ is a valid zip holding `model.usda` with the paint colour and `metersPerUnit = 1`; simplification shrinks it (run in the Node environment — see the file header) | `frontend/tests/ar/usdzExport.test.ts` |
| **Component** | visibility rules, iOS and Android hand-offs, preparing state, error state | `frontend/tests/ar/ArButton.test.tsx` |
| **Unit** | GLB header validation, expiry, id uniqueness, memory cap and eviction, public base URL | `backend/tests/ar/modelStore.test.ts` |
| **Integration** | upload → byte-identical download, invalid body, wrong content type, 413, flag off, 404, rate limit; plus OpenAPI coverage of the new routes | `backend/tests/integration/ar.int.test.ts` |
| **E2E** | button shown for iPhone and Android on a real-model car, hidden for a placeholder car and on desktop | `frontend/e2e/ar-button-visibility.spec.ts` |
| **Manual** | the full in-app flow with the real models in headless Chromium: Lamborghini → 11.2 MB GLB uploaded and served back as valid glTF 2.0; Porsche → 21.4 MB USDZ handed to a correctly formed Quick Look link | one-off script, not committed |

**Not verifiable without hardware:** the actual camera AR session on a physical iPhone or Android phone, reached over a public HTTPS deployment. Everything up to the hand-off to the OS viewer is covered above.

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Any custom in-app AR placement UI — this spec hands off to the OS's native AR viewer entirely.
- Desktop AR (not a meaningful use case for "view in your driveway").
- AR for placeholder-rig vehicles (see "Scope decision" above).

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | AR device/browser support is genuinely fragmented (iOS Safari and Android Chrome only, no desktop, older devices excluded) — SRS itself frames this as the biggest "wow" feature, but it will be invisible to a meaningful share of visitors. | Product owner | Resolved — accepted; AC-1's progressive-enhancement approach means it's a bonus for supported devices, never a broken experience for others. |
| 2 | Browser-side USDZ export isn't standard — this spec requires a server-side conversion step (e.g. Apple's USD tooling, or a third-party conversion service), which is real infrastructure this spec introduces just for one feature. | Implementer | Resolved: no server conversion needed, because three.js 0.171 ships `USDZExporter`. The remaining cost was file size, fixed by iOS-only simplification (see "iOS file size"). The only backend piece is the short-lived GLB host Android needs. |
| 3 | Live-exporting the current Three.js scene's *exact* materials (including a live-dragged Custom Color, Spec 6 AC-3) via `GLTFExporter` needs verification that all material types used in the showroom serialize correctly. | Implementer | Resolved: the real GLBs' `MeshStandardMaterial`s (including the cloned, tinted paint materials) export correctly. Tests assert the exported paint colour for both formats. WebP textures are re-encoded (JPEG/PNG) because glTF and USDZ viewers don't all support WebP. |
| 4 | Simplifying geometry for iOS leaves small seam slivers on the Porsche at close range. | Product owner | Accepted (option 1 of the Step 0 review). Tune per car with `usdzTriangleRatio`, or drop it for a car once a lighter source model exists. |
| 5 | Scene Viewer needs the backend reachable over **public HTTPS**, which localhost isn't. | Implementer | Documented: set `AR_PUBLIC_BASE_URL` in deployed environments behind a proxy or CDN. Android AR can only be tried on a real deployment. |

---

## 9. Rollout

- **Feature flag:** `AR_ENABLED` (backend: both endpoints return 503) and `NEXT_PUBLIC_AR_ENABLED` (frontend: button hidden). Keep them in sync; both are in the `.env.example` files.
- **Migration order:** N/A.
- **Rollback:** remove the button and the `/api/ar/models` endpoints; no other spec depends on this one, and nothing is persisted.
- **Observability:** the backend logs each upload's outcome (`success`, `rejected`, `too_large`) with its size; the frontend reports export and launch failures to Sentry, tagged with `feature: ar` and the platform.

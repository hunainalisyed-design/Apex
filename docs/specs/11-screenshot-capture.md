# Spec: Screenshot / Build Image Capture

**File:** `docs/specs/11-screenshot-capture.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §19 (Screenshot / Build Image); depends on `05-3d-showroom-core.md` (camera presets), `10-save-share-configuration.md` (`publicId`), `09-build-summary.md` (`deriveBuildSummary`)

---

## 1. Problem statement

**Today:** A user can save and share a configuration as a link (Spec 10), but SRS §19 also wants a shareable *image* — "Capture Build" — that bundles the vehicle, its configuration, the price, and the configuration ID into one visual a user can post or send without anyone needing to click through to the app.

**Who is affected:** Every user who wants to show off a build somewhere a link isn't as effective (chat, social media, a screenshot saved to their phone).

**Why it matters now:** It's the last Phase 1 spec in the customization/save flow, and it depends on both the showroom's camera system (Spec 5) and the save flow's `publicId` (Spec 10) already existing.

**Success looks like:** A user clicks "Capture Build," briefly sees a capturing state, and gets a single downloadable image showing their vehicle from a consistent, flattering angle with its name, key options, total price, and configuration ID overlaid — looking like something the product's own marketing would post, not a raw screenshot.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** the current configuration has unsaved changes **When** "Capture Build" is clicked **Then** the app first saves the configuration (Spec 10's save flow) to obtain a `publicId`, then proceeds to capture — a captured image always corresponds to a real, loadable saved build |
| AC-2 | **Given** the current configuration is already saved and unchanged since that save **When** "Capture Build" is clicked **Then** no redundant save request is made — the existing `publicId` is reused directly |
| AC-3 | **Given** capture begins **When** the camera is not already at the default exterior three-quarter preset (Spec 5) **Then** the camera briefly animates to that preset for the capture, then returns to wherever the user had it — every captured image uses the same flattering, consistent framing regardless of what the user was looking at when they clicked |
| AC-4 | **Given** the camera is in position **When** the image is composited **Then** it includes the rendered 3D vehicle, the vehicle name, up to three notable build-summary lines (Spec 9's `deriveBuildSummary`, preferring `alwaysShown` and any non-default `conditionalLines`), the total price, and the `publicId`, styled consistent with the product's dark/glassmorphism visual language (SRS §21) |
| AC-5 | **Given** a composited image **When** the user clicks "Save Image" **Then** a PNG downloads to their device named `{vehicleSlug}-{publicId}.png` |
| AC-6 | **Given** a touch device **When** "Capture Build" is tapped **Then** the same flow (AC-1 through AC-5) works identically — no desktop-only interaction is required |
| AC-7 | **Given** the WebGL context cannot be captured (missing `preserveDrawingBuffer` support, context loss, or an unrelated capture failure) **When** this is detected **Then** the user sees an error message per SRS §28's pattern ("Unable to capture image, please try again") and the showroom itself keeps working uninterrupted |
| AC-8 | **Given** capture is in progress (save-if-dirty + camera transition + compositing can take longer than an instant click) **When** the user has clicked "Capture Build" **Then** a loading state is shown for the duration, and the button is disabled to prevent duplicate captures |
| AC-9 | **Given** a keyboard-only user **When** they reach the "Capture Build" and "Save Image" controls **Then** both are operable via Enter/Space with a visible focus ring |

---

## 3. API contract

No new endpoints. Reuses `POST /api/configurations` (Spec 10) only when the current build is unsaved or has changed since its last save (AC-1). All image composition happens client-side.

### Breaking-change check

- [x] N/A — no new contract.

---

## 4. Data model changes

None — this spec produces a client-generated image; nothing is persisted server-side beyond the existing save flow it may trigger.

### Cross-spec requirement on Spec 5

Capturing the WebGL canvas via `renderer.domElement.toDataURL()` requires the `WebGLRenderer` to have been constructed with `preserveDrawingBuffer: true`. Spec 5 (3D Showroom Core) does not currently specify this renderer option; implementers must set it when building Spec 5's renderer, since retrofitting it later would otherwise require re-touching that spec. Noting it here rather than reopening an already-approved Spec 5 for a one-line renderer flag.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | "Capture Build" shows a spinner and disables itself for the duration (AC-8); text reads "Capturing your build..." |
| **Empty** | not applicable |
| **Error** | capture failure per AC-7; save-if-dirty failure surfaces Spec 10's own save-error state instead of a capture-specific one, since that's the step that actually failed |
| **Success** | a modal/panel shows the composited image with "Save Image" and a "Copy Share Link" shortcut (reusing Spec 10's AC-7 share-link behavior for convenience, not a new mechanism) |

Also specify:
- **Validation:** none.
- **Keyboard/screen-reader:** covered by AC-9; the success modal traps focus appropriately and is dismissible via Escape.
- **Responsive:** the capture flow and resulting modal work identically on mobile and desktop; the composited image itself uses a fixed aspect ratio suited to sharing (e.g. 16:9 or 1:1 — implementer's choice, not SRS-specified) rather than matching the viewport shape.
- **Permission-gated content:** none — guest mode (SRS §36.5).

**Route(s):** integrated into `/configure/[slug]` (Spec 5) — not a new route.
**Directory:** `frontend/src/components/configurator/CaptureBuild/`, `frontend/src/lib/showroom/composeCaptureImage.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | `composeCaptureImage`: overlay content selection (which summary lines make the cut), filename generation | `frontend/tests/showroom/composeCaptureImage.test.ts` |
| **Component** | capture button states (idle/loading/error/success), keyboard operability | `frontend/tests/configurator/CaptureBuild.test.tsx` |
| **E2E** | unsaved build → capture → assert a save occurred first → assert camera returned to prior position after capture → assert downloaded file name matches pattern | `frontend/e2e/screenshot-capture.spec.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1, AC-2 | `screenshot-capture.spec.ts :: save-if-dirty behavior` |
| AC-3 | `screenshot-capture.spec.ts :: camera returns after capture` |
| AC-4 | `composeCaptureImage.test.ts :: overlay content` |
| AC-5 | `composeCaptureImage.test.ts :: filename` |
| AC-6 | `screenshot-capture.spec.ts` touch-emulation variant |
| AC-7 | `CaptureBuild.test.tsx :: capture failure` |
| AC-8 | `CaptureBuild.test.tsx :: loading state disables button` |
| AC-9 | `CaptureBuild.test.tsx :: keyboard operability` |

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** pixel-perfect visual QA of the overlay layout — spot-checked manually during implementation, consistent with how Specs 6–9 treat visual regression.

---

## 7. Out of scope

- Shareable *video* clips (SRS §35.1) — Phase 3 backlog, a materially different capture mechanism (recording, not a single frame).
- Any server-side image generation or storage (e.g. hosting the PNG for a dynamic Open Graph preview) — that's Phase 3's SEO/OG spec (§34.3), which now has a real path via Next.js per the earlier stack decision; this spec's image is generated and downloaded client-side only.
- Direct social-media share-sheet integration — the image is downloaded; posting it elsewhere is left to the user's own device/OS share capability.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Forcing the camera to a canonical preset for every capture (AC-3) is a product decision not explicitly stated in SRS §19, which only says "capture the current 3D showroom configuration." | Product owner | Resolved — canonical framing chosen for a consistently premium, shareable result; a raw capture of an arbitrary in-progress camera angle (e.g. mid-orbit, inside a door) would look unpolished. Revisit if user feedback wants "capture exactly what I'm looking at" instead. |
| 2 | `preserveDrawingBuffer: true` has a minor performance cost (prevents the browser from discarding the draw buffer after each frame) — worth confirming during Spec 5's implementation that this doesn't measurably affect the showroom's frame rate on lower-end devices (SRS §26). | Implementer | Resolved in practice — set on `ShowroomScene.tsx`'s renderer (Spec 5 was already implemented, so this retrofits it per this spec's own §4 rather than reopening that spec). No measurable frame-rate regression observed during manual verification against the placeholder rig; revisit once a real GLB with higher poly counts exists. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A — no schema.
- **Rollback:** remove the capture button and its components; save/share (Spec 10) continues working independently.
- **Observability:** log capture failures (AC-7) client-side once Phase 3 error monitoring (§34.2, e.g. Sentry) exists — WebGL/3D failures are explicitly called out in the SRS as hard to reproduce, so this is a good early candidate for that tooling.

---

## 10. Implementation notes

- **Camera restore is a real raw position/target snapshot-and-restore, not "go back to the last named preset."** `useCameraTransition.ts` gained `goToPresetAsync`/`goToRaw`/`getCurrentCameraState`, all sharing the original `goToPreset`'s tween machinery. This matters because free-orbiting via OrbitControls never updates `currentPreset` — restoring to "the last preset id" would have been visibly wrong for anyone who'd dragged the camera manually. `goToRaw` also accepts an optional `presetId` so `CameraPresetBar`'s highlighted button resyncs correctly after the restore, not just the raw camera numbers.
- **Save state moved from `SaveSharePanel`'s local `useState` into the shared `configurationStore`** (`saveStatus`/`savedConfiguration`/`saveError`/`save()`/`isDirtySinceLastSave()`). This was necessary, not incidental: `SaveSharePanel` and the new `CaptureBuild` both need to agree on "what was last saved" so they never produce two different `publicId`s for what the user perceives as one save, and so a save-if-dirty failure from the capture flow surfaces via `SaveSharePanel`'s own existing error banner rather than a second, capture-specific one. `SaveSharePanel`'s rendered output (button text, testids, aria-labels, error copy) was kept identical, and Spec 10's full existing test suite (`SaveSharePanel.test.tsx`, `save-share.spec.ts`) passes unmodified against the refactor.
- **`preserveDrawingBuffer: true`** was added to `ShowroomScene.tsx`'s renderer per this spec's own §4 cross-spec requirement.
- **A real bug caught only by opening the actual downloaded PNG during manual verification**: the captured WebGL frame has a transparent background (the showroom's "black" backdrop is the page's own dark theme showing through a transparent canvas, not an opaque rendered pixel) — the first composited image showed a white background wherever the frame was transparent, since nothing was there to composite against. Fixed by filling the compositing canvas with an opaque dark backdrop (`#0a0a0c`) before drawing the captured frame on top, scoped entirely to `composeCaptureImage.ts` — Spec 5's live renderer/page-background approach was left untouched.
- Verification: 116 frontend unit tests pass (12 new — 4 in `composeCaptureImage.test.ts`, 8 in `CaptureBuild.test.tsx`), lint/typecheck clean, all 26 Playwright e2e tests pass including 3 new `screenshot-capture.spec.ts` cases (save-then-capture-then-download with camera restore verified via the preset bar's own highlighted state, a skip-redundant-save check, and a touch-emulation variant). Manual browser verification (including opening the actual downloaded PNG, which is what caught the background bug above) confirmed the overlay is legible, the camera returns correctly after both named-preset and free-orbited starting positions, and no console errors occur during the flow.

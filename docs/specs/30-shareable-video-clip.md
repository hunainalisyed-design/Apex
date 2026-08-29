# Spec: Shareable Video Clip

**File:** `docs/specs/30-shareable-video-clip.md`
**Status:** Draft
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §35.1 (Shareable video, not just image); depends on `11-screenshot-capture.md`, `05-3d-showroom-core.md`

---

## 1. Problem statement

**Today:** Spec 11 produces a static shareable image. SRS §35.1 wants a short (3–5 second) vertical orbit video clip, built for Instagram/TikTok-style sharing rather than a static screenshot.

**Who is affected:** Users wanting a more dynamic, platform-native share format than a still image.

**Why it matters now:** It's the natural video counterpart to Spec 11, and the last of the "high-impact" §35.1 items after AR and environments.

**Success looks like:** A user clicks "Capture Video," the camera performs a scripted 360° orbit around their build over 3–5 seconds, and a downloadable vertical (9:16) video file results — on devices where this is technically feasible; degrading gracefully elsewhere.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a browser supporting `MediaRecorder` with canvas-stream capture **When** "Capture Video" is clicked **Then** the camera performs a scripted 3–5 second 360° orbit (reusing Spec 5's camera system) while the canvas is recorded via `canvas.captureStream()` + `MediaRecorder`, producing a WebM (or MP4 where supported) file in vertical 9:16 framing |
| AC-2 | **Given** a browser/device lacking reliable canvas-stream recording support (a real, meaningful subset — see Risk #1) **When** "Capture Video" is clicked **Then** the feature falls back to Spec 11's image capture instead, with a brief explanation, rather than failing silently or producing a broken file |
| AC-3 | **Given** recording is in progress **When** shown to the user **Then** a visible progress indicator (matching the clip's fixed duration) plays, and the vehicle's build-summary overlay (Spec 9/11's `deriveBuildSummary`/`composeCaptureImage` content) appears as a brief intro/outro title card within the clip, not just on a static image |
| AC-4 | **Given** a completed recording **When** the user clicks "Save Video" **Then** it downloads to their device, named consistently with Spec 11's image (`{vehicleSlug}-{publicId}.webm`) |
| AC-5 | **Given** `prefers-reduced-motion` **When** set **Then** the video-capture feature is still offered (it's an opt-in, user-initiated capture of motion the user explicitly requested, not an ambient animation) but its own UI chrome (buttons, progress bar) still avoids gratuitous animation |

---

## 3. API contract

None — entirely client-side capture and encoding, consistent with Spec 11's approach.

---

## 4. Data model changes

None.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Unsupported** | falls back to image capture (AC-2) |
| **Recording** | progress bar for the fixed duration, capture button disabled |
| **Error** | recording failure (e.g. codec issue mid-capture) falls back to image capture rather than leaving the user with nothing |
| **Success** | preview + Save Video action |

**Route(s):** integrated into `/configure/[slug]`, alongside Spec 11's capture flow.
**Directory:** `frontend/src/lib/showroom/composeCaptureVideo.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | orbit-path scripting (deterministic camera positions across the clip duration), filename generation | `frontend/tests/showroom/composeCaptureVideo.test.ts` |
| **Component** | unsupported-browser fallback path, recording progress UI | `frontend/tests/configurator/CaptureVideo.test.tsx` |
| **E2E** | full capture flow on a supported mocked environment; fallback path on a mocked unsupported one | `frontend/e2e/shareable-video.spec.ts` |

**Coverage:** ≥80% on new code, excluding actual video-encoding correctness (validated manually — automated pixel/frame verification of encoded video has poor ROI here).

---

## 7. Out of scope

- Server-side video rendering (e.g. headless-browser + ffmpeg pipeline) as a more reliable but heavier alternative — see Risk #2; not built here, but noted as the fallback architecture if client-side capture proves too unreliable in practice.
- Any editing (trimming, music, filters) — a single fixed scripted clip only.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Canvas-stream video capture support and encoding quality vary meaningfully across browsers/devices (particularly older mobile Safari), more so than the single-frame capture in Spec 11. | Product owner | Resolved — accepted; AC-2's graceful fallback to image capture is the mitigation, not a fix. |
| 2 | If client-side capture proves too unreliable after implementation, a server-side rendering pipeline (headless browser driving the same Three.js scene + ffmpeg encoding) would be materially more complex and costly (compute-per-request) but far more consistent. | Product owner | Open — deliberately deferred; only pursue if real usage shows the client-side approach fails often enough to matter. |

---

## 9. Rollout

- **Feature flag:** `VIDEO_CAPTURE_ENABLED` — easy to disable if client-side recording proves unreliable in production without waiting for a code change.
- **Migration order:** N/A.
- **Rollback:** falls back to Spec 11's image-only capture, which remains fully functional independent of this spec.
- **Observability:** log capture attempts, successes, and fallback-triggered rates per browser/device to inform the Risk #2 decision empirically.

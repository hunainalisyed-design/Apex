# Spec: Shareable Video Clip

**File:** `docs/specs/30-shareable-video-clip.md`
**Status:** Implemented
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

### How each criterion is implemented

- **The clip:** 720×1280 (9:16), 4 seconds, 30 fps. It's one 360° orbit at constant speed, starting from the default 3/4 view at a slightly low hero angle. The last frame meets the first, so it loops seamlessly. The orbit is a pure function (`orbitCameraPose`, in `frontend/src/lib/showroom/composeCaptureVideo.ts`). The video is silent: Spec 29's sounds aren't recorded.
- **Portrait render, not a crop.** The showroom canvas is 16:9, and cutting a 9:16 slice from it would crop off most of the car and be low-resolution. So `ShowroomControls.recordOrbit()` briefly renders the scene at 720×1280 with a portrait camera and a wider orbit that keeps the whole car in frame. It uses `setSize(…, false)`, so the page layout never moves; a "Rendering your video…" overlay covers the scene meanwhile. Size, pixel ratio, camera, controls and render loop are restored afterwards, even on failure. The active environment (Spec 28) is part of the render, so it's in the video.
- **How it's recorded — a change made during implementation:** the approved plan used real-time `canvas.captureStream()` with `MediaRecorder`. Testing showed that approach **only gets as many frames as the device renders while recording**: in headless Chromium's software WebGL (~2 fps), a "4-second" clip came out as 1–2 frames with broken duration metadata. On a slow device, real users would get choppy, short clips. With the product owner's approval, the preferred path is now **frame-by-frame**:
  - the render loop is paused (`frameloop="never"`), and each of the 120 frames is rendered on demand at its exact point in the orbit;
  - each frame is encoded as H.264 with its exact timestamp via **WebCodecs** (`VideoEncoder`), then muxed into an MP4 with metadata at the front, using the MIT-licensed `mp4-muxer` library (lazy-loaded). `mp4-muxer` is marked deprecated in favour of its successor Mediabunny, but that is ~10 MB and MPL-licensed; the small, stable library suits this single use.

  The result is always a complete, full-frame-rate, correctly-timed clip. A slow device just takes longer, with the progress shown as a percentage. `pickVideoStrategy` picks the path:
  1. WebCodecs H.264 (High → Main → Baseline, level 4.0);
  2. otherwise real-time `MediaRecorder` (MP4, then WebM), which is smooth on a normal GPU;
  3. otherwise unsupported, and the image fallback runs.
- **AC-1 format:** MP4 wherever possible, since that's what Instagram and TikTok accept; WebM only via the MediaRecorder fallback in browsers without MP4 recording. The file extension matches the real format.
- **AC-2:** unsupported browsers, and any failure while rendering or encoding, run Spec 11's image capture instead. Its result dialog, now the shared `CaptureImageDialog`, explains: "Video capture isn't supported in this browser" or "The video couldn't be recorded — here's an image of your build instead." Both paths are reported to Sentry, tagged with the reason.
- **AC-3:** title cards are drawn onto the frames. The **intro** (first 0.8 s) shows the vehicle name; the **outro** (last 1.2 s) shows the same three highlight lines, total price and build ID as Spec 11's image, laid out for portrait. While rendering, an overlay on the scene shows a progress bar and "Rendering your video… N%". It's a percentage rather than seconds left, because frame-by-frame rendering can take longer than the clip on a slow device.
- **AC-4:** "Save Video" downloads `{vehicleSlug}-{publicId}.mp4` (or `.webm`). As with Spec 11, capturing first saves the build if it has unsaved changes, so there's always a build ID. The dialog also offers Copy Share Link.
- **AC-5:** the capture is always offered. The progress bar has no transition; it jumps with each update. The result preview doesn't autoplay under `prefers-reduced-motion` (it has controls).
- **Flag:** `NEXT_PUBLIC_VIDEO_CAPTURE_ENABLED` (frontend; the backend isn't involved). With it set to `false` the button is hidden and Spec 11's image capture is untouched.
- **One capture at a time:** from the moment either capture is clicked (a synchronous guard, not when rendering starts), the other capture button, the camera presets and the environment switcher are locked. Nothing can move the camera or change the scene mid-clip, and a double-click never starts two recordings.
- **Cancellation:** leaving the showroom mid-render aborts the capture. That counts as an abandonment, not a failure: there's no image fallback and nothing is reported. The renderer's state is restored best-effort.

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
| **Recording** | overlay on the scene with a progress bar and "Rendering your video… N%"; both capture buttons disabled |
| **Error** | a rendering or encoding failure falls back to image capture, with an explanation, rather than leaving the user with nothing |
| **Success** | dialog with a looping video preview (no autoplay under reduced motion), Save Video, Copy Share Link, Close |

**Route(s):** integrated into `/configure/[slug]`, alongside Spec 11's capture flow.
**Directory:** `frontend/src/lib/showroom/composeCaptureVideo.ts`; UI in `frontend/src/components/configurator/CaptureVideo/`; hook `frontend/src/components/showroom/useCaptureVideo.ts`; renderer control `ShowroomControls.recordOrbit`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | orbit path (deterministic, seamless loop, constant speed, radius and height), clip shape (9:16, 3–5 s, 120 frames), strategy choice (WebCodecs H.264 profiles → MediaRecorder MP4/WebM → unsupported), filenames, title-card timing | `frontend/tests/showroom/composeCaptureVideo.test.ts` |
| **Component** | success flow with progress reporting and Save Video filename; the title-card text on frames; fallback when unsupported and when recording fails; reduced-motion preview; overlay percentage and progress bar; feature flag | `frontend/tests/configurator/CaptureVideo.test.tsx` |
| **E2E** | real capture in Chromium: overlay shown then removed, a decodable 9:16 video **exactly 4 s long** (which the real-time approach failed), download named `apex-gt-{publicId}.mp4`; fallback with WebCodecs and MediaRecorder removed | `frontend/e2e/shareable-video.spec.ts` |

**Coverage:** ≥80% on new code, excluding actual video-encoding correctness (validated manually — automated pixel/frame verification of encoded video has poor ROI here).

---

## 7. Out of scope

- Server-side video rendering (e.g. headless-browser + ffmpeg pipeline) as a more reliable but heavier alternative — see Risk #2; not built here, but noted as the fallback architecture if client-side capture proves too unreliable in practice.
- Any editing (trimming, music, filters) — a single fixed scripted clip only.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Canvas-stream video capture support and encoding quality vary meaningfully across browsers/devices (particularly older mobile Safari), more so than the single-frame capture in Spec 11. | Product owner | Largely resolved by frame-by-frame WebCodecs encoding, which doesn't depend on render speed (Chrome/Edge, Safari 16.4+, Firefox 130+). Real-time MediaRecorder remains for other browsers, and AC-2's image fallback for the rest. |
| 3 | Frame-by-frame rendering is slow where WebGL is slow: minutes under headless software rendering, compared with seconds on a real GPU. | Implementer | Accepted. Progress is shown as a percentage; the E2E test allows for it. |
| 4 | A window resize or orientation change during a capture: r3f's own resize handling could reset the renderer from the 720×1280 portrait size mid-clip. | Implementer | Accepted for now: a capture takes seconds on real hardware, and the overlay makes the capture obvious. If it shows up in reports, pause r3f resize handling for the capture's duration. |
| 2 | If client-side capture proves too unreliable after implementation, a server-side rendering pipeline (headless browser driving the same Three.js scene + ffmpeg encoding) would be materially more complex and costly (compute-per-request) but far more consistent. | Product owner | Open — deliberately deferred; only pursue if real usage shows the client-side approach fails often enough to matter. |

---

## 9. Rollout

- **Feature flag:** `NEXT_PUBLIC_VIDEO_CAPTURE_ENABLED` (frontend only, since no backend is involved) — set to `false` to hide the button without a code change.
- **Migration order:** N/A.
- **Rollback:** falls back to Spec 11's image-only capture, which remains fully functional independent of this spec.
- **Observability:** fallbacks are reported to Sentry, tagged `feature: video-capture` with the reason (`unsupported` plus which capability was missing, or `failed` with the error), to inform the Risk #2 decision.

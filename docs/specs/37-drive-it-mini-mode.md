# Spec: "Drive It" Mini-Mode

**File:** `docs/specs/37-drive-it-mini-mode.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §35.4 ("Drive it" mini-mode); depends on `05-3d-showroom-core.md`, `28-dynamic-environments.md`

---

## 1. Problem statement

**Today:** The vehicle only ever sits in the showroom being inspected. SRS §35.4 wants a lightweight arcade-style camera fly-through/drive simulation on the finished-build screen — explicitly described as "purely for delight, not a real driving game," which is the scope-defining phrase for this entire spec.

**Who is affected:** Users who've finished a build and want one more delightful moment before sharing/saving it.

**Why it matters now:** It's the last item in the entire backlog, fittingly the most purely decorative — everything it needs (the vehicle model, an environment to drive through) already exists from earlier specs.

**Success looks like:** A user clicks "Drive It," and the camera follows the vehicle along a preset path through one of Spec 28's environments (the Coastal Road) at a pleasant pace, with simple steering-feel input — never mistaken for an actual driving game with physics, collision, or lap times.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a finished build **When** the user clicks "🏁 Drive It" (next to the sound toggle, enabled once the scene is ready) **Then** the scene fades to black, swaps in Spec 28's **Coastal Road** environment (borrowed for the drive only — the build's own environment is never changed or saved), fades back in, and a chase camera follows the car along a fixed figure-eight path (a lemniscate, ±8 × ±2.5 units, driven twice) with a gentle speed ramp at the start and end. The path is kept near the environment's centre, where its projected ground reads sharply |
| AC-2 | **Given** the mode is active **When** the user holds ←/→ or A/D (or the on-screen ◀ ▶ buttons) **Then** the car drifts sideways within **±1 unit** of the path, yaws up to **8°** and leans up to **4°**, and eases back to the line when let go — not free-roam, not physics, no collisions. Typing in a text field never steers. A "Steering" indicator (`role="slider"`, −100…100, read out as left/centre/right of the road line) shows where the car is in that band |
| AC-3 | **Given** the mode is active **When** rendered **Then** it is the live showroom car with its actual configuration (paint, wheels, everything from Specs 6–8) — the same car group is moved, nothing is re-rendered or faked. Each real model is turned to face its direction of travel using its per-model `forwardAxis` (placeholder +x; Porsche, Pagani, Lamborghini +z; Mustang −z), and its contact shadow moves with it |
| AC-4 | **Given** the drive path completes (**40 seconds**) **When** reached **Then** it fades out, puts the car, shadow, camera and orbit controls back exactly as they were, fades back into the normal showroom, and returns focus to the Drive It button. A progress bar ("Drive progress") shows how far along it is |
| AC-5 | **Given** the "Exit" button or **Escape** **When** used at any time (including while the scene is still getting ready) **Then** the drive ends immediately with the same fade-and-restore, and a late-arriving environment never starts it afterwards |
| AC-6 | **Given** `prefers-reduced-motion` **When** set **Then** "Drive It" is not offered at all (its entire value proposition is fast camera motion; there's no meaningful static version) |
| AC-7 | **Given** mobile/touch devices **When** in this mode **Then** hold-to-steer ◀ ▶ buttons (pointer events — touch, mouse or pen) and the steering indicator are always shown in the HUD, consistent with SRS §27's touch-support requirement |
| AC-8 | **Given** the mode is active **Then** the showroom is locked: camera presets, the environment switcher, captures, video, publish/share and AR are disabled and hotspot labels are hidden. Build panels stay usable so a live-session partner's change (Spec 33) still shows on the driving car |
| AC-9 | **Given** the Coastal Road environment fails to load, or takes longer than **10 seconds** **When** entering **Then** the drive starts anyway in the build's own (already loaded) scene — never over an unloaded one. If the build is already on the Coastal Road, there's nothing to swap and the drive starts straight after the fade |

---

## 3. API contract

None — entirely client-side, reusing existing catalog/configuration data.

---

## 4. Data model changes

None. `REAL_GLB_VEHICLES` (`frontend/src/lib/showroom/realGlbVehicles.ts`) gains a required `forwardAxis` per model.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Idle** | "🏁 Drive It" button (omitted under reduced motion) |
| **Entering** | 300 ms fade to black, "Getting ready…" status while the Coastal Road loads (≤10 s, AC-9) |
| **Driving** | fade in; chase camera, HUD with progress bar, Exit, ◀ ▶ and the steering indicator (focused on start) |
| **Leaving** (complete or exited) | 300 ms fade to black, everything restored, fade in, focus back on Drive It |

**Route(s):** integrated into `/configure/[slug]`, as a mode toggle, not a new route.
**Directory:** `frontend/src/components/showroom/DriveItMode/`

### As built

- `frontend/src/lib/showroom/driveIt.ts` — pure maths: the speed profile, the figure-eight path, the steering step (clamped, self-centring), lean/yaw caps, the chase-camera pose, and `forwardYaw()` for each model axis.
- `ShowroomControls.startDrive({ input, onUpdate, onComplete })` in `ShowroomScene.tsx` — moves the car group each frame (clock-timed, so a slow device still finishes in 40 s), places the chase camera exactly at its pose (no easing, which fell behind on slow devices), reports progress every 100 ms, and returns `{ stop() }`, which restores the car, shadow, camera and orbit controls.
- `DriveItMode/useDriveIt.ts` — the idle → entering → driving → leaving state machine, fades, environment wait/timeout/error, keyboard and touch input, focus return, cleanup on unmount. `DriveItMode/DriveItMode.tsx` — the button and the overlay/HUD.
- `useShowroomEnvironment().settingsFor(id)` lends the Coastal Road settings to the scene for the drive without touching the saved environment.
- **Fixed on the way (found by driving each car):** the Mustang and Pagani GLBs contain skinned meshes. `scene.clone(true)` left them bound to the original, cached skeleton, so the copy drew at the origin whatever its transform. `RealGlbShowroomRig`, `HeroVehicleModel` and the AR export (`prepareArScene`, Spec 27 — its real-world rescale didn't reach skinned parts) now clone with `SkeletonUtils.clone`, and the rigs call `updateMatrixWorld(true)` before measuring the model's bounds.

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | path progression and speed ramp, the steering band (never beyond ±1, self-centring, dt clamped), lean/yaw caps, chase pose, every `forwardAxis` facing the travel direction through the same rotation the scene applies, each real model's axis | `frontend/tests/showroom/driveItPath.test.ts` |
| **Unit** | a skinned model's plain clone is stuck to its bones; the `SkeletonUtils` clone moves; the AR copy of a skinned car follows its rescale | `frontend/tests/showroom/skinnedClone.test.ts` |
| **Component** | fade → environment → drive; environment error and timeout fall back to the current scene; keyboard, A/D, typing ignored, touch buttons; progress and steering read-outs; Exit, Escape, completion, exit while getting ready; focus return; reduced-motion omission (AC-6); showroom locks (AC-8) | `frontend/tests/showroom/DriveItMode.test.tsx` |
| **E2E** | enter → hold → steering reaches the edge of the band and never passes it → release returns it → Escape restores the showroom and focus; a full drive completing by itself; reduced motion hides the button | `frontend/e2e/drive-it-mode.spec.ts` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Any real driving mechanics: physics, collision, other traffic, lap timing, scoring — explicitly ruled out by the SRS's own "not a real driving game" framing.
- Free-roam camera/movement — the path is fixed; input only affects visual feel within it.
- A choice of routes or environments — one path through the Coastal Road.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | It would be easy to over-invest in this feature (real physics, multiple tracks) beyond its stated "purely for delight" purpose. | Product owner | Resolved — the acceptance criteria above deliberately cap scope at a single fixed path with bounded visual-only input response; any request to add real driving mechanics should be treated as a new, separate feature idea, not an extension of this spec. |
| 2 | Spec 28's environments are 360° photos projected onto the ground; far from the centre the ground smears. | Engineering | Resolved — the path stays within ±8 × ±2.5 units and the chase camera sits close (5.5 behind, 2 up), verified by screenshots of every car mid-drive. |

---

## 9. Rollout

- **Feature flag:** none — purely additive and self-contained.
- **Migration order:** after Spec 28 (uses its environments).
- **Rollback:** remove the mode toggle and its components; no other spec depends on this one — fittingly, as the last item in the entire backlog. (Keep the `SkeletonUtils` clone fix: it corrects the skinned models everywhere.)
- **Observability:** none needed.

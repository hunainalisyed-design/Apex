# Spec: 3D Showroom Core

**File:** `docs/specs/05-3d-showroom-core.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §4 (3D Virtual Showroom), §5 (3D Vehicle Animations); depends on `02-vehicle-catalog-data-model.md`, `01-project-foundation.md`

---

## 1. Problem statement

**Today:** No 3D scene exists. The catalog data model (Spec 2) knows which vehicles exist, but nothing loads a GLB, lets a user orbit it, or reacts to interaction.

**Who is affected:** Every user who wants to inspect or configure a vehicle — this is the load-bearing screen of the entire product.

**Why it matters now:** Specs 6, 7, and 8 (exterior/interior/accessories customization) all assume a working 3D scene with a hotspot/highlight system and camera control already exists; they only add categories of things that can be selected within it. Building the showroom shell before customization avoids those specs each reinventing camera and interaction plumbing.

**Success looks like:** A user picks a vehicle from `/models`, arrives at `/configure/[slug]`, freely orbits/zooms/pans it with smooth (not instant) camera motion, jumps between named camera presets, switches into an interior/cockpit view and back, and sees a labeled highlight when hovering a component — all before any paint/wheel/interior customization exists.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** `/models` **When** it loads **Then** it lists every active vehicle from `GET /api/vehicles` as a card (name, tagline, base price, thumbnail); clicking a card navigates to `/configure/{slug}` |
| AC-2 | **Given** `/configure/{slug}` for a valid slug **When** it loads **Then** the vehicle's `showroomModelUrl` GLB renders centered in a dark showroom environment with dramatic lighting, and begins a slow idle rotation |
| AC-3 | **Given** the showroom is active **When** the user drags **Then** the vehicle orbits continuously with the drag, and releasing lets it either hold position or resume idle rotation after a short pause — never an instant jump |
| AC-4 | **Given** the user scrolls/pinches **When** zoom input is received **Then** the camera dollies smoothly within clamped min/max distance bounds — it can never clip inside the vehicle or zoom out past the showroom floor |
| AC-5 | **Given** the camera preset bar (Front, Rear, Left, Right, Side, Top, Interior, Cockpit) **When** any preset button is clicked **Then** the camera animates (eases, does not snap) to that preset's fixed position/target over a fixed duration, and a "Reset" control returns to the default three-quarter exterior view |
| AC-6 | **Given** the user selects "Interior" or "Cockpit" **When** the transition plays **Then** the nearest door opens as part of the transition, the camera moves inside, and selecting any exterior preset afterward closes the door as part of the transition back |
| AC-7 | **Given** a defined hotspot (wheel, body panel, brake caliper) **When** the pointer hovers it **Then** that part is highlighted (outline/glow) and a label appears naming the *currently selected* option for that category (e.g. "SPORT ALLOY WHEELS"), sourced from live configuration state, never a hardcoded string |
| AC-8 | **Given** a touch device **When** the user drags, pinches, or taps a preset button **Then** all of AC-3/AC-4/AC-5 work identically via touch input (SRS §27) |
| AC-9 | **Given** a "Lighting Demo" control **When** toggled **Then** headlights switch on/off with an emissive material change, and a separate momentary action triggers a brief brake-light pulse — both are real material/light changes in the scene, not a UI-only indicator (SRS §32) |
| AC-10 | **Given** `prefers-reduced-motion` is set **When** any camera transition or idle rotation would play **Then** transitions cut directly to their end state and idle rotation is disabled, per Spec 12's global reduced-motion contract |

---

## 3. API contract

No new endpoints beyond Spec 2's `GET /api/vehicles` (for `/models`) and `GET /api/vehicles/:slug` (for `/configure/[slug]`'s initial load). This spec is a 3D rendering and interaction layer, not a data-contract layer.

### Breaking-change check

- [x] N/A — no new contract.

---

## 4. Data model changes

None. This spec introduces a client-side-only concept — the **hotspot registry** — mapping a 3D mesh name inside the GLB to an `OptionCategory`, so Spec 6/7/8 can register their own hotspots without touching this spec's code:

```ts
// frontend/src/lib/showroom/hotspots.ts
export interface Hotspot {
  meshName: string;          // must match a node name inside the GLB
  category: OptionCategory;  // links to the currently-selected option's name for the label
  cameraFocus?: CameraPresetId; // optional: clicking (not just hovering) can jump the camera here
}
```

The specific hotspots for wheels/paint/brake-calipers are registered by Spec 6, not this one — this spec only ships the registry mechanism and proves it with one placeholder hotspot for testing.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | full-screen showroom loading state per Spec 12: "INITIALIZING SHOWROOM..." with a determinate progress bar tracking GLB download percent, no layout shift once it resolves |
| **Empty** | not applicable — a slug always resolves to a vehicle or 404s |
| **Error** | invalid slug → dedicated 404 state ("This vehicle isn't in our lineup") with a link back to `/models`; GLB load failure or no-WebGL → Spec 12's 3D error fallback, keeping camera preset buttons hidden but the vehicle name/spec sheet still visible as text |
| **Success** | full interactive scene as described in the acceptance criteria |

Also specify:
- **Validation:** none — no form inputs.
- **Keyboard/screen-reader:** camera preset buttons are real, labeled, focusable buttons operable via Enter/Space; free-drag orbit has no keyboard equivalent, so preset buttons are the accessible path to inspecting the vehicle from any angle (documented explicitly since SRS §29 requires keyboard operability of "configuration controls" — the presets satisfy this for camera control specifically).
- **Responsive:** desktop shows the vehicle large with presets as a horizontal bar below/beside it; mobile shows the vehicle full-width on top with presets as a horizontally scrollable row (SRS §27).
- **Permission-gated content:** none — showroom viewing requires no auth (SRS §36.5).

**Route(s):** `/models`, `/configure/[slug]`
**Directory:** `frontend/src/app/models/`, `frontend/src/app/configure/[slug]/`, `frontend/src/components/showroom/`, `frontend/src/lib/showroom/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | camera preset position/target lookup, hotspot registry lookup, reduced-motion branching | `frontend/tests/showroom/*.test.ts` |
| **Component** | loading/error/404 states render correctly for `/configure/[slug]` | `frontend/tests/showroom/ConfigurePage.test.tsx` |
| **E2E** | `/models` → click a card → arrives at correct `/configure/{slug}` → click each camera preset → camera state changes → hover a hotspot → label appears | `frontend/e2e/showroom.spec.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1 | `showroom.spec.ts :: model selection` |
| AC-2, AC-10 | `ConfigurePage.test.tsx` |
| AC-3, AC-4 | manual/visual QA + unit test on clamping math (`camera.test.ts`) |
| AC-5, AC-6 | `showroom.spec.ts :: camera presets` |
| AC-7 | `showroom.spec.ts :: hotspot hover` |
| AC-8 | `showroom.spec.ts` touch-emulation variant |
| AC-9 | `lighting.test.ts` (material/emissive state assertions) |

**Coverage:** ≥80% on new non-3D-rendering code (camera math, hotspot registry, state management); raw Three.js scene wiring is validated primarily through E2E and manual QA since unit-testing WebGL rendering output has poor ROI.

**Not covered, deliberately:** frame-rate/performance benchmarking — tracked qualitatively during implementation against SRS §26, formalized only if a real performance regression is found. The Loading state's progress bar is also structurally present (determinate, not a spinner) but doesn't track real download bytes yet, same narrowing as Spec 4 — the placeholder rig has no network download to measure. Revisit once a real GLB is wired in.

---

## 7. Out of scope

- Any actual customization (paint/wheels/interior/accessories) — Specs 6, 7, 8 register hotspots and swap materials/meshes using this spec's infrastructure, but this spec ships with the vehicle in its default configuration only.
- The pricing display — Spec 3/9.
- Screenshot capture — Spec 11.
- AR "view in your driveway" — Phase 3 (§35.1), out of scope entirely for now.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Same placeholder-asset dependency as Specs 2 and 4 (Spec 2, Risk #1) — this spec cannot be implemented until a real GLB with named, separable wheel/door/body nodes is chosen. | Product owner | Resolved for Phase 1 implementation — extended Spec 4's procedural-placeholder approach into a properly structured rig (`frontend/src/components/showroom/PlaceholderShowroomRig.tsx`): named body/wheel(x4)/door(x2)/brake-caliper(x4)/headlight/brakelight meshes, so every AC (camera, orbit, hotspots, door animation, lighting) is genuinely functional rather than stubbed. Specs 6–8 target these same names for material swaps; the real GLB decision from Spec 2 Risk #1 is still open and still needed eventually, but no longer blocks this spec or the ones building on it. Evaluate at the start of Spec 6 whether the placeholder rig is sufficient for exterior customization or whether the real asset is needed first. |
| 2 | Door open/close animation requires the GLB to either ship with a baked animation clip or expose a hinge node this spec can animate procedurally; which approach depends on the chosen placeholder asset. | Implementer | Resolved for the placeholder rig — each door is a hinge-pivot group animated procedurally via GSAP (`useCameraTransition.ts`), reacting to Interior/Cockpit vs. exterior preset selection (AC-6). A real GLB with a baked clip would replace this with clip playback; a real GLB with only a hinge node would keep this same procedural-rotation approach. |
| 3 | "Pan around the vehicle where appropriate" (SRS §4) is vague — full 6-DOF pan risks letting users lose the vehicle off-screen. | Product owner | Resolved for Phase 1 — panning is disabled; orbit + zoom + presets are judged sufficient for inspecting the vehicle from any relevant angle. Revisit if user testing shows a real need. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A.
- **Rollback:** `/configure/[slug]` and `/models` routes removed; landing page CTAs would need to point elsewhere temporarily.
- **Observability:** log GLB load time and failure rate per vehicle once Phase 3 monitoring (§34.2) exists; not required for Phase 1 launch.

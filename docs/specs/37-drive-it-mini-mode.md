# Spec: "Drive It" Mini-Mode

**File:** `docs/specs/37-drive-it-mini-mode.md`
**Status:** Draft
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §35.4 ("Drive it" mini-mode); depends on `05-3d-showroom-core.md`, `28-dynamic-environments.md`

---

## 1. Problem statement

**Today:** The vehicle only ever sits in the showroom being inspected. SRS §35.4 wants a lightweight arcade-style camera fly-through/drive simulation on the finished-build screen — explicitly described as "purely for delight, not a real driving game," which is the scope-defining phrase for this entire spec.

**Who is affected:** Users who've finished a build and want one more delightful moment before sharing/saving it.

**Why it matters now:** It's the last item in the entire backlog, fittingly the most purely decorative — everything it needs (the vehicle model, an environment to drive through) already exists from earlier specs.

**Success looks like:** A user clicks "Drive It," and the camera follows the vehicle along a preset path through one of Spec 28's environments (e.g. the coastal road) at a pleasant pace, with simple steering-feel input — never mistaken for an actual driving game with physics, collision, or lap times.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a finished build **When** the user clicks "Drive It" **Then** the camera enters a chase-cam view following the vehicle along a fixed, predetermined path through one environment (recommend the Coastal Road environment from Spec 28, since it reads best in motion) |
| AC-2 | **Given** the mode is active **When** the user provides simple input (arrow keys/WASD, or on-screen touch controls on mobile) **Then** the vehicle's visual heading/lean responds within a narrow band around the fixed path — enough to feel interactive, explicitly **not** free-roam, not physics-simulated, and with no collision detection of any kind |
| AC-3 | **Given** the mode is active **When** rendered **Then** it uses the vehicle's actual current configuration (paint, wheels, everything from Specs 6–8) — the same "no fake interactions" principle (SRS §32) that's applied throughout the project |
| AC-4 | **Given** the drive path completes (a fixed duration, e.g. 30–45 seconds) **When** reached **Then** it ends gracefully, returning to the normal showroom view — this is a bounded delight moment, not an open-ended mode |
| AC-5 | **Given** an "Exit" control **When** clicked at any time **Then** the user can leave the mode immediately and return to the showroom |
| AC-6 | **Given** `prefers-reduced-motion` **When** set **Then** "Drive It" is not offered at all (its entire value proposition is fast camera motion, which directly conflicts with a reduced-motion preference — unlike other specs' animations, there's no meaningful "static" version of this feature to fall back to) |
| AC-7 | **Given** mobile/touch devices **When** in this mode **Then** on-screen touch controls (e.g. a virtual steering indicator) are provided, consistent with SRS §27's touch-support requirement elsewhere in the app |

---

## 3. API contract

None — entirely client-side, reusing existing catalog/configuration data.

---

## 4. Data model changes

None.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Entering** | brief camera transition into chase-cam position |
| **Driving** | AC-1/AC-2 |
| **Complete** | smooth return to showroom view |
| **Exited early** | same return transition, triggered by AC-5 |

**Route(s):** integrated into `/configure/[slug]`, as a mode toggle, not a new route.
**Directory:** `frontend/src/components/showroom/DriveItMode/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | fixed-path progression math, input-to-lean response bounds (never exceeding the "narrow band" from AC-2) | `frontend/tests/showroom/driveItPath.test.ts` |
| **Component** | reduced-motion omission (AC-6), exit control, touch controls presence on mobile | `frontend/tests/showroom/DriveItMode.test.tsx` |
| **E2E** | enter mode → provide input → assert vehicle responds within bounds → let it complete → assert return to showroom; also test early exit | `frontend/e2e/drive-it-mode.spec.ts` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Any real driving mechanics: physics, collision, other traffic, lap timing, scoring — explicitly ruled out by the SRS's own "not a real driving game" framing.
- Free-roam camera/movement — the path is fixed; input only affects visual feel within it.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | It would be easy to over-invest in this feature (real physics, multiple tracks) beyond its stated "purely for delight" purpose. | Product owner | Resolved — the acceptance criteria above deliberately cap scope at a single fixed path with bounded visual-only input response; any request to add real driving mechanics should be treated as a new, separate feature idea, not an extension of this spec. |

---

## 9. Rollout

- **Feature flag:** none — purely additive and self-contained.
- **Migration order:** after Spec 28 (uses its environments).
- **Rollback:** remove the mode toggle and its components; no other spec depends on this one — fittingly, as the last item in the entire backlog.
- **Observability:** none needed.

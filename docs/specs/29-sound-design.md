# Spec: Sound Design Toggle

**File:** `docs/specs/29-sound-design.md`
**Status:** Draft
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §35.1 (Sound design toggle); depends on `05-3d-showroom-core.md`, `12-loading-error-a11y-shell.md`

---

## 1. Problem statement

**Today:** The showroom is silent. SRS §35.1 calls this a "low cost, disproportionately raises perceived quality" feature — engine start-up, door-close thud, and ambient showroom audio on interaction.

**Who is affected:** Every user with sound on; must not annoy users who don't expect audio from a car-configuration site (autoplay-with-sound is broadly considered bad practice and is blocked by browsers by default anyway).

**Why it matters now:** It's the cheapest item in the §35 backlog — a good low-effort, high-perceived-value addition once the core 3D interactions (Spec 5) it attaches sound cues to already exist.

**Success looks like:** Interacting with the vehicle (rotating, opening a door, entering the interior) has a subtle matching sound, entirely optional and off by default, easy to mute.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** first visit to the showroom **When** it loads **Then** sound is **off by default** — no audio plays without explicit user opt-in (respects autoplay norms and unexpected-noise concerns) |
| AC-2 | **Given** a mute/unmute control **When** toggled on **Then** subsequent interactions play matching sounds: idle ambient loop (low volume), door open/close (Spec 5), a brief engine start-up cue when entering the showroom, headlight/brake-light toggle cues (Spec 5, AC-9) |
| AC-3 | **Given** the mute preference **When** set **Then** it persists in `localStorage` (a per-viewer convenience, not account state) across visits |
| AC-4 | **Given** `prefers-reduced-motion` is set **When** the showroom loads **Then** sound remains independently controlled — reduced motion does not imply muted, and muted does not imply reduced motion; they're separate preferences |
| AC-5 | **Given** any sound-triggering interaction **When** it fires **Then** the corresponding sound is preloaded ahead of time (not fetched on first trigger) so there's no audible lag between the visual and audio event |

---

## 3. API contract

None — purely client-side, static audio assets.

---

## 4. Data model changes

None.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Muted (default)** | mute icon shown, no audio |
| **Unmuted** | speaker icon shown, sounds play per AC-2 |

**Route(s):** integrated into `/configure/[slug]`.
**Directory:** `frontend/src/lib/sound/`, `frontend/public/audio/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | mute state persistence, correct sound triggered per interaction type | `frontend/tests/sound/soundManager.test.ts` |
| **Component** | toggle control renders and reflects state | `frontend/tests/showroom/SoundToggle.test.tsx` |
| **E2E** | unmute, trigger a door-open interaction, assert the corresponding audio element's play was called (mocked `HTMLAudioElement`) | `frontend/e2e/sound-design.spec.ts` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Full engine-sound simulation tied to RPM/speed (there's no driving simulation until Spec 37) — this is discrete event-based sound cues only.
- Spatial/3D positional audio — simple stereo cues are sufficient for this scope.

---

## 8. Risks and open questions

None beyond standard browser autoplay-policy handling, which AC-1's off-by-default design sidesteps entirely (unmuting is always a direct user gesture, satisfying every browser's autoplay requirements automatically).

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A.
- **Rollback:** remove the toggle and audio assets; no dependents.
- **Observability:** none needed.

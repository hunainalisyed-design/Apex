# Spec: Sound Design Toggle

**File:** `docs/specs/29-sound-design.md`
**Status:** Implemented
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

### How each criterion is implemented

- **Sounds:** six cues in `frontend/public/audio/`, all **CC0**, **144 KB in total**, content-addressed per Spec 25 (`mp3` added to the versioned extensions and the `immutable` cache rule). Sources are in `frontend/public/audio/CREDITS.md`:
  - engine start: looneybits, OpenGameArt
  - real car door open and close: GGBotNet, OpenGameArt
  - headlight switch and brake click: Kenney's Interface Sounds
  - showroom ambience: **generated** for the project (filtered brown noise), because no suitable CC0 recording existed

  Candidates were collected, trimmed, peak-normalised to -3 dBFS and presented on a listening page. The product owner deferred to the suggested set (engine C, door A/A, headlight A, brake B, ambience A), and any cue is a one-file swap. Relative levels are set per cue in `lib/sound/cues.ts`.
- **AC-1:** off unless the viewer turns it on. The server render is always "off", and nothing is downloaded while off.
- **AC-2:** `lib/sound/soundManager.ts` uses the Web Audio API (`AudioContext` plus decoded buffers), so cues are instant and can overlap.
  - **All cars:** turning sound on plays the engine start and brings in the quiet looping ambience (fading in and out). Entering the showroom with sound already on does the same.
  - **Placeholder cars only** (Apex GT/RS), because only that rig animates doors and lights:
    - the door latch plays as the doors start to swing, and the thud as they arrive shut (`detectDoorEvent`, driven by the rig's real door animation);
    - headlight and brake-light cues play on those controls.

  This follows the project's **no fake interactions** rule: real-model cars don't animate doors or lights, so they get no door or light sounds. Their Headlights / Brake Pulse buttons, which previously did nothing on those cars, are now hidden for them.
- **Autoplay:** turning sound on is itself a click, so audio starts at once; the context is resumed inside that click. A returning visitor who left sound on arrives without a gesture, so the engine start and ambience wait for their first click, tap or key rather than failing silently.
- **AC-3:** `lib/sound/soundPreference.ts` stores the setting in `localStorage` (`apex:sound-enabled`). Every access is guarded. Blocked storage means "off" on the next visit, but the choice still applies for the current page, and changes in other tabs are picked up.
- **AC-4:** the preference never reads or implies `prefers-reduced-motion`, and a test asserts this in both directions.
- **AC-5:** every cue is fetched and decoded the moment sound turns on, before any interaction can trigger it. A cue that fails to load just stays silent.

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
| **Muted (default)** | muted-speaker icon, "Sound off", `aria-pressed=false`; no audio and no audio downloads |
| **Unmuted** | speaker icon, "Sound on", `aria-pressed=true`; sounds play per AC-2 |
| **Unmuted, audio not yet allowed** (returning visitor) | entry cues wait for the first click/tap/key |

**Route(s):** integrated into `/configure/[slug]`.
**Directory:** `frontend/src/lib/sound/`, `frontend/public/audio/`; toggle in `frontend/src/components/showroom/SoundToggle.tsx`, wiring in `useShowroomSound.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | preference default, persistence, blocked storage, independence from reduced motion; the manager's preloading, per-cue playback and levels, the ambience loop, waiting for a gesture, mute dropping queued cues, failed cues; door-event detection | `frontend/tests/sound/soundManager.test.ts` |
| **Component** | toggle states; showroom wiring: off on first visit, on plays engine and ambience and persists, returning visitor, mute, light and door cues on placeholder cars, light controls hidden on real-model cars, silent while muted | `frontend/tests/showroom/SoundToggle.test.tsx` |
| **E2E** | real Web Audio in the browser, instrumented to record which file each playback started: nothing downloaded or played while off; unmute gives engine start + ambience; Interior/Front camera moves give door open/close; headlight cue; choice survives a reload; real-model car has no light controls and no door sound | `frontend/e2e/sound-design.spec.ts` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Full engine-sound simulation tied to RPM/speed (there's no driving simulation until Spec 37) — this is discrete event-based sound cues only.
- Spatial/3D positional audio — simple stereo cues are sufficient for this scope.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Browser autoplay policy. | Implementer | Off by default, and unmuting is itself a user gesture. The one gap is a returning visitor with sound left on, who has made no gesture yet; entry cues wait for their first interaction (see "Autoplay" above). |
| 2 | Sound quality can't be judged automatically. | Product owner | The candidates were presented on a listening page; the chosen set is in `CREDITS.md` and each cue is a one-file swap. Two cues come from a pack titled "Low Quality" (the car doors), so it's worth listening before a public launch. |
| 3 | Real-model cars don't animate doors or lights. | Product owner | Resolved for this spec: no sounds and no light buttons on those cars. Animating them needs each model's door and light meshes, a separate piece of work. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A.
- **Rollback:** remove the toggle and audio assets; no dependents.
- **Observability:** none needed.

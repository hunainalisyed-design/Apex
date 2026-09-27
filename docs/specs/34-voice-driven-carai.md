# Spec: Voice-Driven CarAI

**File:** `docs/specs/34-voice-driven-carai.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §35.3 (Voice-driven CarAI); depends on `15-carai-assistant-ui.md`, `14-ai-configuration-backend.md`

---

## 1. Problem statement

**Today:** CarAI (Specs 14/15) only accepts typed input. SRS §35.3 wants spoken commands ("make it more aggressive") with the assistant narrating changes back, instead of typed-only input.

**Who is affected:** Users who'd rather speak than type; a nice-to-have alternate input method, not a replacement.

**Why it matters now:** It's the cheapest item in §35.3 by far — it's purely a new input/output modality bolted onto Spec 15's already-complete pipeline, requiring zero changes to Spec 14's backend.

**Success looks like:** A user taps a microphone icon, says "make it more aggressive," sees their words transcribed into the chat as if typed, gets the same recommendation card Spec 15 already produces, and optionally hears CarAI's reply spoken back.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a browser supporting the Web Speech API's `SpeechRecognition` (standard or `webkit`-prefixed; notably absent in Firefox) **When** the chat window (Spec 15) renders **Then** a microphone button appears beside Send; **given** an unsupported browser **when** rendered **then** the button is omitted entirely, leaving typed input as the only path |
| AC-2 | **Given** the microphone button is tapped **When** the user speaks **Then** the transcribed text appears in the message box in real time (added after anything already typed), listening stops by itself at a pause or when the button is tapped again, and the user reviews it and taps Send — which calls `POST /api/ai/configure` (Spec 14) **exactly as if it had been typed**, with no changes to the backend contract or the recommendation pipeline. Nothing is sent automatically, so a misheard request never reaches the paid AI unreviewed |
| AC-3 | **Given** CarAI's reply is received **When** the "speak replies" switch (in the chat header) is on **Then** the `assistantMessage` is read aloud via `SpeechSynthesis`, in addition to appearing as a chat bubble. Only new replies are read — not ones already in the chat, and never error messages |
| AC-4 | **Given** the "speak replies" preference **When** set **Then** it defaults to **off** and persists in `localStorage` (`apex:speak-replies`) — consistent with Spec 29's sound-design default-off pattern, since unexpected audio output is equally unwelcome here |
| AC-5 | **Given** speech recognition fails or is denied microphone permission **When** this happens **Then** the chat shows a brief inline notice saying why (blocked microphone, no microphone, didn't catch that, or voice unavailable) and typing carries on, never blocking the assistant |
| AC-6 | **Given** someone uses the microphone for the first time **When** listening starts **Then** a one-line note says "Voice is turned into text by your browser's speech service." — Chrome and Edge send the audio to their own cloud service — and it isn't shown again on that device |
| AC-7 | **Given** a reply is being read aloud **When** the user taps Stop, sends another message, turns the switch off, or closes the chat **Then** it stops at once |

---

## 3. API contract

None — reuses Spec 14's `POST /api/ai/configure` unchanged.

### Breaking-change check

- [x] N/A — no backend contract touched.

---

## 4. Data model changes

None.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Unsupported** | microphone button absent (AC-1) |
| **Listening** | the microphone turns red (pressed) and a pulsing "Listening… speak now" line appears under the message box (the pulse respects reduced motion) |
| **Permission denied / error** | fallback to typed input (AC-5) |
| **Speaking (reply)** | a "Speaking…" line with a Stop button under the reply being read (AC-7) |

Both buttons are real toggle buttons (`aria-pressed`, labeled), reachable by keyboard. The chat's own text moved into `messages/en-US.json` (`carai`) unchanged, per the i18n convention. Focus stays in the message box while typing or while spoken words arrive (see §8, Risk #2).

**Route(s):** integrated into Spec 15's chat window.
**Directory:** `frontend/src/lib/voice/`, `frontend/src/components/ai/ChatWindow/` (`ChatComposer.tsx`, `useVoiceInput.ts`)

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | support detection, interim/final transcripts, error mapping, abort/stop, reading one reply at a time and stopping, the preference (and blocked storage) | `frontend/tests/voice/voiceInput.test.ts` |
| **Component** | microphone absent when unsupported, words filling the box and going out through the same `sendMessage` as typing, adding to typed text, every error notice, the one-time privacy note, speak-replies off by default / on / Stop / never re-reading old replies or errors, focus staying in the box | `frontend/tests/ai/VoiceButton.test.tsx`, `frontend/tests/ai/ChatWindow.test.tsx` |
| **E2E** | with the browser's speech features faked: a spoken request fills the box and sends the same request as typing; speak-replies off by default, reads replies once on, remembered after reload; no microphone without recognition. WebGL is off in these tests (voice doesn't depend on the 3D scene, and software rendering makes clicks time out) | `frontend/e2e/voice-carai.spec.ts` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Any voice command that bypasses CarAI's own natural-language understanding (e.g. a fixed voice-command grammar) — all voice input becomes plain text fed to the existing AI pipeline, never a separate command system.
- Wake-word ("Hey CarAI") always-listening behavior — explicit tap-to-talk only, for privacy and simplicity.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Web Speech API browser support is inconsistent (notably Firefox lacks `SpeechRecognition` support). | Product owner | Resolved — accepted, mitigated entirely by AC-1's progressive enhancement; typed input always remains fully functional. |
| 2 | Found while building this: the shared focus trap (`useFocusTrap`, Spec 11/13) re-ran its "focus the first button" step whenever its dismiss callback changed identity, and the chat (like several dialogs) passes a new one every render — so each keystroke moved focus out of the message box. | Implementer | Resolved — the callback is now read through a ref and focus moves only when the trap opens; covered by a regression test. Also fixes the same latent issue in every other dialog using the hook. |

---

## 9. Rollout

- **Feature flag:** none — purely additive UI, safe to ship directly given its progressive-enhancement design.
- **Migration order:** N/A.
- **Rollback:** remove the microphone button and speech-synthesis toggle; Spec 15's typed chat is entirely unaffected.
- **Observability:** none needed.

# Spec: Voice-Driven CarAI

**File:** `docs/specs/34-voice-driven-carai.md`
**Status:** Draft
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
| AC-1 | **Given** a browser supporting the Web Speech API's `SpeechRecognition` (not universal — notably absent in Firefox) **When** the chat window (Spec 15) renders **Then** a microphone button appears; **given** an unsupported browser **when** rendered **then** the button is omitted entirely, leaving typed input as the only path |
| AC-2 | **Given** the microphone button is tapped **When** the user speaks **Then** the transcribed text appears in the message input in real time, and submitting it calls `POST /api/ai/configure` (Spec 14) **exactly as if it had been typed** — no changes to the backend contract or the recommendation pipeline |
| AC-3 | **Given** CarAI's reply is received **When** a "speak replies" preference is enabled **Then** the `assistantMessage` is read aloud via the Web Speech API's `SpeechSynthesis`, in addition to appearing as a chat bubble |
| AC-4 | **Given** the "speak replies" preference **When** set **Then** it defaults to **off** and persists in `localStorage` — consistent with Spec 29's sound-design default-off pattern, since unexpected audio output is equally unwelcome here |
| AC-5 | **Given** speech recognition fails or is denied microphone permission **When** this happens **Then** the chat falls back to typed input with a brief inline notice, never blocking the assistant entirely |

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
| **Listening** | visual waveform/pulse indicator while `SpeechRecognition` is active |
| **Permission denied / error** | fallback to typed input (AC-5) |
| **Speaking (reply)** | subtle "speaking" indicator on the assistant's message while `SpeechSynthesis` plays, with a way to stop it mid-sentence |

**Route(s):** integrated into Spec 15's chat window.
**Directory:** `frontend/src/lib/voice/`, additions to `frontend/src/components/ai/ChatWindow/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | transcription-to-message-submit wiring, speak-replies preference persistence | `frontend/tests/voice/voiceInput.test.ts` |
| **Component** | unsupported-browser button omission, permission-denied fallback | `frontend/tests/ai/VoiceButton.test.tsx` |
| **E2E** | mocked `SpeechRecognition` producing a transcript → assert it flows through the exact same path as a typed message (reusing Spec 15's own E2E assertions) | `frontend/e2e/voice-carai.spec.ts` |

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

---

## 9. Rollout

- **Feature flag:** none — purely additive UI, safe to ship directly given its progressive-enhancement design.
- **Migration order:** N/A.
- **Rollback:** remove the microphone button and speech-synthesis toggle; Spec 15's typed chat is entirely unaffected.
- **Observability:** none needed.

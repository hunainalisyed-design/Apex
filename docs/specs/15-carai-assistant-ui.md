# Spec: CarAI Assistant UI

**File:** `docs/specs/15-carai-assistant-ui.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §15 (AI Assistant UI); depends on `14-ai-configuration-backend.md`, `06-exterior-customization.md` (configuration store), `09-build-summary.md` (option-name lookup), `12-loading-error-a11y-shell.md` (`getErrorMessage`, `withReducedMotion`, toast), `13-navigation-scroll-shell.md` (`NavRightSlot`)

---

## 1. Problem statement

**Today:** Spec 14 provides a working `/api/ai/configure` endpoint, but nothing in the browser calls it. SRS §15 describes a floating assistant with a chat window, message history, recommendation cards, and an Apply action — none of which exists yet.

**Who is affected:** Every user who wants to configure by describing intent instead of clicking through panels — this is the UI half of the feature the product is named around (CarAI).

**Why it matters now:** It's the natural next spec after 14, and the last piece needed before SRS §2's full user journey (including "Ask CarAI for recommendations" and "Apply AI-generated configurations") is real end-to-end.

**Success looks like:** A user opens the floating assistant, types "I want a sporty car for daily driving," sees CarAI's reply along with a clear recommendation card, clicks "Apply Configuration," and watches the 3D vehicle and price update exactly as if they'd clicked those options themselves.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** `/configure/[slug]` **When** the page renders **Then** a floating AI button is visible, styled per SRS §21's dark/glassmorphism language, and clicking it toggles an expandable chat window open/closed |
| AC-2 | **Given** the nav's AI Assistant control (Spec 13's `NavRightSlot`) **When** clicked from any page **Then** it navigates to the default vehicle's showroom (or the currently-open one, if already there) with the chat window opened automatically — the floating button and the nav control are two entry points into the same feature |
| AC-3 | **Given** the chat window is open **When** messages exist **Then** they render in order (user messages and CarAI replies visually distinguished), auto-scrolling to the latest message as new ones arrive |
| AC-4 | **Given** the user submits a message **When** sent **Then** the frontend calls `POST /api/ai/configure` (Spec 14) with the message, prior history, the current `vehicleSlug`, and the current selections read live from the configuration store (Spec 6); the input and send control are disabled and a loading/typing indicator shows until a response arrives |
| AC-5 | **Given** a response with a non-null `recommendation` **When** rendered **Then** the chat shows CarAI's `assistantMessage` as a reply bubble, followed by a recommendation card listing each changed category by human-readable option name (using the same option-name lookup Spec 9's build summary uses) and the recommendation's total price, with an "Apply Configuration" button |
| AC-6 | **Given** a response with `recommendation: null` **When** rendered **Then** only the reply bubble appears — no card, no Apply button |
| AC-7 | **Given** a recommendation card **When** "Apply Configuration" is clicked **Then** the recommendation's `singleSelections`/`multiSelections` are merged directly into the configuration store (Spec 6) via its existing actions — the 3D scene and price update through the exact same pipeline a manual swatch click would trigger, and the chat marks that message as applied |
| AC-8 | **Given** the request to `/api/ai/configure` fails for any reason (`AI_PROVIDER_ERROR` or otherwise) **When** this happens **Then** the chat shows an inline error bubble using Spec 12's `getErrorMessage` mapping ("CarAI is temporarily unavailable. You can continue configuring manually."), prior history is preserved, and the rest of the configurator remains fully usable |
| AC-9 | **Given** the user switches to a different vehicle **When** the new showroom loads **Then** the chat history resets to empty — a conversation is scoped to one vehicle's context, consistent with how the configuration store itself resets on vehicle change (Spec 6) |
| AC-10 | **Given** a keyboard-only user **When** they interact with the assistant **Then** the floating button is a focusable real button, opening the chat moves focus into the message input, Escape closes the chat window and returns focus to the floating button, and the recommendation card's Apply action is reachable and operable via Enter/Space |
| AC-11 | **Given** `prefers-reduced-motion` **When** the chat window opens or closes **Then** it appears/disappears instantly via Spec 12's `withReducedMotion` rather than sliding or fading |
| AC-12 | **Given** a mobile viewport **When** the chat window opens **Then** it takes over as a full-screen sheet rather than a small floating popover, remaining fully usable on small screens (SRS §27) |
| AC-13 | **Given** a request is already in flight **When** the user tries to send another message **Then** the send action is disabled until the current one resolves, preventing duplicate/overlapping requests |

---

## 3. API contract

No new endpoints. This spec is the sole frontend consumer of `POST /api/ai/configure` (Spec 14).

### Breaking-change check

- [x] N/A — no new contract.

---

## 4. Data model changes

None server-side. Client-side chat state (not persisted, scoped per vehicle session per AC-9):

```ts
// frontend/src/state/carAiChatStore.ts
interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system-error";
  content: string;
  recommendation?: AiConfigureResponseDto["recommendation"];
  breakdown?: PriceBreakdownDto;
  applied?: boolean; // set true once the user clicks Apply on this message's recommendation
}

interface CarAiChatState {
  vehicleSlug: string;
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  sendMessage(text: string): Promise<void>;
  applyRecommendation(messageId: string): void; // merges into configurationStore (Spec 6)
  reset(): void; // called on vehicle change, AC-9
}
```

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | typing/thinking indicator shown in the message list while awaiting a response (AC-4) |
| **Empty** | a freshly opened chat (no messages yet) shows a short CarAI greeting/prompt suggestion (e.g. example commands from SRS §14) rather than a blank panel |
| **Error** | inline error bubble per AC-8; does not clear existing history or block manual configuration |
| **Success** | reply bubble, optionally with a recommendation card and working Apply action |

Also specify:
- **Validation:** the message input has a reasonable max length (implementer's choice, e.g. 500 characters) to keep requests bounded; empty messages cannot be sent.
- **Keyboard/screen-reader:** covered by AC-10; new messages are announced via an `aria-live="polite"` region (reusing Spec 12's toast/live-region pattern) so screen-reader users don't have to poll the chat manually.
- **Responsive:** AC-12.
- **Permission-gated content:** none — guest mode (SRS §36.5); no account is required to use CarAI.

**Route(s):** integrated into `/configure/[slug]` (Spec 5); the nav control (AC-2) can navigate there from any page.
**Directory:** `frontend/src/components/ai/CarAIButton/`, `frontend/src/components/ai/ChatWindow/`, `frontend/src/components/ai/RecommendationCard/`, `frontend/src/state/carAiChatStore.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | `carAiChatStore`: message ordering, loading-state guarding duplicate sends (AC-13), reset on vehicle change (AC-9), apply merges correctly into the configuration store | `frontend/tests/state/carAiChatStore.test.ts` |
| **Component** | chat window states (empty/loading/error/success), recommendation card renders correct option names and price, keyboard operability | `frontend/tests/ai/ChatWindow.test.tsx` |
| **E2E** | open chat → send a message → mocked backend returns a recommendation → click Apply → assert 3D/store/price all reflect it, identically to a manual selection; also test the error path and the nav entry point (AC-2) | `frontend/e2e/carai-assistant.spec.ts` |

**Traceability**

| AC | Test |
|---|---|
| AC-1, AC-10, AC-11 | `ChatWindow.test.tsx` |
| AC-2 | `carai-assistant.spec.ts :: nav entry point` |
| AC-3, AC-4 | `ChatWindow.test.tsx` + `carai-assistant.spec.ts` |
| AC-5, AC-6 | `ChatWindow.test.tsx :: recommendation card rendering` |
| AC-7 | `carai-assistant.spec.ts :: apply merges into store` |
| AC-8 | `carai-assistant.spec.ts :: error path` |
| AC-9 | `carAiChatStore.test.ts :: reset on vehicle change` |
| AC-12 | `carai-assistant.spec.ts` mobile-viewport variant |
| AC-13 | `carAiChatStore.test.ts :: duplicate-send guard` |

**Coverage:** ≥80% on new code.

**Not covered, deliberately:** the actual quality of CarAI's replies (Spec 14's concern, not this spec's) — this spec's tests use mocked backend responses throughout.

---

## 7. Out of scope

- The backend AI logic itself (Spec 14) — this spec only calls it.
- Voice input (SRS §35.3, Phase 3 backlog).
- Persisting chat history beyond the current vehicle session (e.g. resuming a conversation after closing the tab) — not requested by the SRS.

---

## 7a. Implementation notes

- **`RecommendationCard` needs no vehicle-catalog lookup of its own.** `AiConfigureResponseDto.breakdown.lineItems` (from the real `calculatePrice` call the backend already ran, Spec 14) already has every changed option's resolved `name`, since the backend merges the recommendation into current selections before pricing. The card is built purely from `message.recommendation` (which ids/categories changed) + `message.breakdown.lineItems` (their resolved names/prices) — no `vehicle` prop, no second id→name map, and it structurally can't drift from what was actually priced. Multi-select categories are filtered by id membership in the recommendation's array, not just by category, since `lineItems` also includes options the user already had before the recommendation.
- **`applyRecommendation` merges via configurationStore's existing actions only** (AC-7's own wording), not a new store action: `setSingleSelection` per changed category (plain overwrite), and for multi-select categories a diff — `toggleMultiSelection` is called only for ids not already present, since it toggles rather than sets and calling it on an already-selected id would incorrectly remove it. This mirrors the backend's own union-merge semantics (`Array.from(new Set([...current, ...recommended]))` in `backend/src/services/ai/configureVehicle.ts`) using only what the store already exposed. One accepted subtlety: the diff is computed against the store's *live* state at Apply-time, so if the user manually changes selections between receiving a recommendation and clicking Apply, the resulting total can differ slightly from the `breakdown.totalPriceCents` shown on the card at receive-time — expected given the "existing actions" design, not a bug.
- **`carAiChatStore` is a plain global Zustand module store, not React-Context-scoped** — specifically so `isOpen` survives a Next.js client-side navigation triggered by the nav entry point (AC-2). The nav control writes `isOpen: true` synchronously in its `<Link>`'s `onClick`, before/independent of the route transition; the module is never torn down except on a full page reload, so the write is still in effect once `ConfigureShowroom`/`ChatWindow` mount for the target vehicle. `ConfigureShowroom`'s own new reset-on-vehicle-change effect (mirroring the existing `hydrateDefaults`/`hydrateFromSaved` effect) deliberately never touches `isOpen`, so a nav-triggered "open" survives that reset too.
- **Two same-commit `useEffect`s deliberately compose for focus placement (AC-10).** `useFocusTrap` (shared with `CaptureBuild`'s modal and Spec 13's nav mobile menu) auto-focuses the first focusable element in DOM order on open — which would be the header's close button, not the message input AC-10 actually wants. A second `useEffect(() => { if (isOpen) inputRef.current?.focus(); }, [isOpen])`, declared after the `useFocusTrap` call, runs after it on the same commit and deterministically wins. Not a race condition, and not a bug to "simplify away."
- **`ChatWindow` is `role="dialog"` without `aria-modal="true"` and with no full-viewport dimming backdrop**, unlike `CaptureBuild`'s success-modal precedent — a floating assistant isn't meant to block the rest of the page. In practice the desktop floating panel (`fixed bottom-24 right-6 w-96`) does overlap part of the right-hand configurator panel column while open; e2e tests close the chat (Escape) before interacting with panel content underneath it, matching how a real user would continue configuring manually, rather than asserting simultaneous click-through of an open overlay (not a realistic expectation for any floating widget).
- **`ChatWindow` does NOT use the standard `glass-panel` utility class**, found via manual browser screenshots (not caught by any automated test, since jsdom doesn't render CSS visually): at `glass-panel`'s usual 4% background opacity, this window — which overlaps the busy, text-heavy configurator panel behind it — let that panel's own text show through the blur, making both illegible. Uses a near-opaque `bg-[#0a0a0c]/95` (the page's own dark background color) plus `backdrop-blur-xl` instead, reading as a solid panel rather than a faint tint. Worth remembering for any future floating overlay in this codebase that might sit above dense text content, not just a decorative background/sparse 3D scene.
- **`NEXT_PUBLIC_AI_ASSISTANT_ENABLED`** (new frontend env var) mirrors the backend's own `AI_ASSISTANT_ENABLED` (Spec 14) — two independently-set env vars kept in sync manually, same accepted tradeoff class as this project's pricing formula being implemented independently frontend/backend (Spec 3 Risk #1). When either is off, the floating button and nav control simply don't render, per the spec's own Rollout wording.
- **jsdom has no `Element.prototype.scrollTo`** — `vitest.setup.ts` gained a no-op stub for it, the same treatment already given to `matchMedia` and WebGL context creation there, since `ChatWindow`'s auto-scroll-to-latest-message effect (AC-3) is the first component to call it.
- **This repo's first `page.route()` network-interception e2e tests.** `carai-assistant.spec.ts`'s happy-path and error-path tests mock `POST /api/ai/configure` directly in the browser rather than depending on a real `ANTHROPIC_API_KEY` (none is configured in this environment — Spec 14 was built and tested entirely against a mocked backend client) or the backend's current temporary unconfigured-key 502 behavior, which could change independently of this spec.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | SRS §22 places "AI Assistant" as a persistent nav-bar item (implying it should be reachable from anywhere, including pages with no vehicle context, like `/` or `/about`), while SRS §15 describes it as a floating button (implying it's local to the showroom). | Product owner | Resolved — both are entry points to the same feature (AC-2): the nav control works from anywhere by navigating into a vehicle's showroom first, since CarAI's recommendations are always vehicle-scoped (Spec 14) and there's no meaningful "vehicle-less" conversation to have. |
| 2 | Applying a recommendation that includes accessories/packages the user already explicitly removed earlier in the same session could feel like the assistant is "overriding" a deliberate choice. | Product owner | Open — not addressed in Phase 2; Apply always merges the full recommendation as given. Revisit only if user feedback shows this is confusing in practice. |

---

## 9. Rollout

- **Feature flag:** inherits Spec 14's `AI_ASSISTANT_ENABLED` flag — when disabled, this spec's floating button and nav control should simply not render, rather than rendering and then always erroring.
- **Migration order:** N/A — no schema.
- **Rollback:** remove the floating button, chat components, and nav integration; the rest of the configurator is unaffected.
- **Observability:** none beyond what Spec 14 already logs server-side; client-side, log Apply-click rate vs. recommendations-shown as a basic usefulness signal once Phase 3 analytics (§34.3) exists.

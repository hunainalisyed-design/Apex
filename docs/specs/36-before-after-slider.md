# Spec: Before/After Slider on AI Recommendations

**File:** `docs/specs/36-before-after-slider.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §35.4 (Before/after slider); depends on `15-carai-assistant-ui.md`, `11-screenshot-capture.md`

---

## 1. Problem statement

**Today:** A CarAI recommendation card (Spec 15) shows the proposed changes as a text list. SRS §35.4 wants a drag-to-compare visual slider between the current build and the AI-suggested one, making the difference immediately visible rather than requiring the user to read a list and imagine it.

**Who is affected:** Users evaluating a CarAI recommendation before deciding whether to apply it.

**Why it matters now:** It's a low-effort visual enhancement to an already-built feature (Spec 15), reusing Spec 11's capture mechanism rather than introducing anything new.

**Success looks like:** A recommendation card shows a slider; dragging it left reveals the current build, dragging right reveals what it would look like with CarAI's changes applied — before the user commits to anything.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a CarAI recommendation card with a non-null recommendation (Spec 15, AC-5) **When** rendered **Then** it includes a before/after slider **alongside** the plain text list of changes (which stays: it names exactly what changes, including options the placeholder car can't show) |
| AC-2 | **Given** the slider **When** it needs a "before" and "after" image **Then** both are drawn in a **separate, hidden 3D view** (its own small renderer, never the live showroom's) in the showroom's studio look at Spec 11's standard camera: "before" is the build when the card first appears, "after" is that build with the recommendation merged in exactly as Apply would do it. The live 3D view is never changed, so it can't flash the "after" state. The pair is made once per recommendation and reused (e.g. when the chat is reopened); the pictures reset with the chat when the vehicle changes |
| AC-3 | **Given** the two images **When** the slider renders **Then** dragging it (mouse, touch or pen), or the arrow keys (5% steps; Home/End jump to the ends), moves a clip-path divider between them in real time. It is a proper `role="slider"` with its value read out ("N% of CarAI's suggestion shown") |
| AC-4 | **Given** the user decides to proceed **When** they click "Apply Configuration" (Spec 15, AC-7, unchanged) **Then** the actual apply behavior is identical to before this spec — the slider is a visualization aid only, and moving it changes nothing |
| AC-5 | **Given** `prefers-reduced-motion` **When** set **Then** the slider still functions (it's user-driven, not an ambient animation) but the divider's glide on keyboard steps, and the loading shimmer, are removed. A drag always follows the pointer exactly, with no glide |
| AC-6 | **Given** several recommendations arrive **When** their pictures are made **Then** one hidden 3D view works through them all, changing the build in place — it is not re-created per picture or per recommendation, and it is removed when the work is done. (Rapidly re-creating 3D contexts with a heavy real model once crashed this app; see `next.config.ts`.) |

---

## 3. API contract

None — purely a frontend visualization built from data Spec 15 already has.

---

## 4. Data model changes

None.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Preparing images** | "Preparing a before/after preview…" with a subtle shimmer (respects reduced motion) while the hidden view draws both pictures |
| **Ready** | interactive slider (AC-3) |
| **Error** | if either capture fails (no WebGL, a model that won't load, or no picture within 15 seconds), the preview simply isn't shown and the card is Spec 15's original list and Apply — never a broken slider |

**Route(s):** integrated into Spec 15's `RecommendationCard`.
**Directory:** `frontend/src/components/ai/RecommendationCard/BeforeAfterSlider/` (`BeforeAfterSlider`, `RecommendationComparison`, `ComparisonStudio`, `StudioCanvas`), `frontend/src/state/comparisonStore.ts`, `frontend/src/lib/ai/mergeRecommendation.ts`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | `mergeRecommendation` matches the real Apply exactly (paint over a custom color, accessories added not removed, nothing to change); the queue (order, no repeats, stale answers after a reset); the hidden studio draws before → after, never touches the live build, uses one view per batch, gives up after the timeout, rebuilds after a broken view, refuses another vehicle's pair | `frontend/tests/ai/beforeAfterCapture.test.tsx` |
| **Component** | slider drag (pointer), keyboard (arrows, Home/End, clamping), ARIA values, glide vs. reduced motion; the card: preparing → slider alongside the list, error → just the list, Apply unaffected by the slider, made once per recommendation | `frontend/tests/ai/BeforeAfterSlider.test.tsx` |
| **E2E** | a recommendation shows a slider of two real, different renders; keyboard and mouse move it without changing the build; Apply still updates the price. Without WebGL: the plain list, and Apply works. On a real-model car (Porsche): two recommendations render cleanly with no lost 3D context. (WebGL is off for the main showroom in these tests — only the hidden view renders — to keep the page responsive under software rendering.) | `frontend/e2e/before-after-slider.spec.ts` |

**Coverage:** ≥80% on new code.

---

## 7. Out of scope

- Any slider elsewhere in the app (e.g. comparing two saved builds) — scoped specifically to CarAI recommendations per SRS §35.4's own framing.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | Briefly applying a hypothetical configuration to the live Three.js scene for capture, then reverting it, needs to be genuinely invisible to the user (no visible flash of the "after" state on the real 3D view). | Implementer | Resolved — both pictures are drawn in a separate hidden 3D view; the live scene is never changed, so there's no flash by construction. |
| 2 | A second 3D view means creating WebGL contexts, and rapidly creating/destroying them with a heavy real model once crashed this app ("Context Lost", `next.config.ts`). | Implementer | Resolved — one hidden view per batch, reused for every picture (AC-6); covered by an E2E on a real-model car that fails on any lost context. |

---

## 9. Rollout

- **Feature flag:** none.
- **Migration order:** N/A.
- **Rollback:** falls back to Spec 15's plain-text change list, which remains fully functional independent of this spec.
- **Observability:** none needed.

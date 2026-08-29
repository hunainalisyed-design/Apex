# Spec: AI-Generated Concept Renders

**File:** `docs/specs/35-ai-concept-renders.md`
**Status:** Draft
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §35.3 (AI-generated concept renders); depends on `14-ai-configuration-backend.md`, `09-build-summary.md`

---

## 1. Problem statement

**Today:** CarAI (Spec 14) recommends real, buildable configurations using only catalog options — deliberately constrained (Spec 14, AC-1/AC-2) so it can never invent anything unavailable. SRS §35.3 wants a *different* kind of output: an aspirational, clearly-labeled "dream concept" image imagining an even more extreme version of the user's build — explicitly positioned as inspiration, not a purchasable configuration.

**Who is affected:** Users who've finished a build and want a fun, top-of-funnel "what if" moment.

**Why it matters now:** It's spec'd here because it's conceptually adjacent to CarAI, but it requires a genuinely different capability (image generation) than anything else in the project has needed — see the vendor decision flagged below.

**Success looks like:** A user clicks "Imagine the Ultimate Version," and after a short wait sees an AI-generated image of a more extreme take on their build, unmistakably labeled as a non-purchasable concept — never confused with an actual selectable configuration.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a finished build **When** the user clicks "Imagine the Ultimate Version" **Then** the backend sends a prompt (describing the vehicle, its current configuration, and an instruction to imagine a more extreme/aspirational version) to an image-generation provider and returns the resulting image |
| AC-2 | **Given** the generated image **When** displayed **Then** it is **unmistakably labeled** ("AI Concept — Not a Real Configuration" or similar), visually distinct from the real 3D showroom and from Spec 14's real, buildable recommendation cards — this must never be confusable with something the user could actually order |
| AC-3 | **Given** the generated image **When** shown **Then** there is **no "Apply" action** of any kind next to it — unlike Spec 14/15's recommendations, this output can never be applied to the real configuration, since it isn't built from real catalog options |
| AC-4 | **Given** generation fails or times out **When** this happens **Then** a clear error state shows ("Couldn't generate a concept right now — try again"), and the rest of the build/summary experience is unaffected |
| AC-5 | **Given** this is a paid, per-request external API call **When** exposed to users **Then** it is rate-limited per session/IP more conservatively than Spec 14's already-flagged rate-limiting need, since image generation is typically more expensive per call than a text completion |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/ai/concept-render` | none (rate-limited) | `200` `{ imageUrl: string }` | |

```ts
export interface ConceptRenderRequest {
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
}
```

### Provider abstraction

```ts
// backend/src/services/imageGeneration/ImageGenerationProvider.ts
export interface ImageGenerationProvider {
  generate(prompt: string): Promise<{ imageUrl: string }>;
}
```

The concrete provider is intentionally not named in this spec's contract — see Risk #1. Whatever is chosen implements this one-method interface, keeping the rest of the backend decoupled from the vendor choice.

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `502` | `IMAGE_PROVIDER_ERROR` | provider call failed/timed out |
| `429` | `TOO_MANY_ATTEMPTS` | rate limit exceeded (AC-5) |

### Breaking-change check

- [x] First version of this contract.

---

## 4. Data model changes

None — generated images are not persisted (regenerated on demand, not saved as part of a `Configuration`); this keeps scope small and avoids storage-cost questions for a purely aspirational, disposable output.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | "Imagining the ultimate version..." with a premium-feeling loading animation, since generation genuinely takes several seconds |
| **Error** | AC-4 |
| **Success** | image + prominent "AI Concept" label, no Apply action (AC-2/AC-3) |

**Route(s):** integrated into the build summary (Spec 9) or CarAI chat (Spec 15).
**Directory:** `frontend/src/components/ai/ConceptRender/`, `backend/src/services/imageGeneration/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | prompt construction from a given configuration | `backend/tests/imageGeneration/prompt.test.ts` |
| **Integration** | endpoint behavior against a mocked `ImageGenerationProvider` (success, failure, rate-limit) | `backend/tests/integration/conceptRender.int.test.ts` |
| **Component** | the "not a real configuration" labeling and absence of an Apply action are asserted explicitly, given how important that distinction is | `frontend/tests/ai/ConceptRender.test.tsx` |

**Coverage:** ≥80% on new code; the labeling/no-apply-action assertions are treated as correctness-critical, not cosmetic.

---

## 7. Out of scope

- Choosing the image-generation provider — see Risk #1, explicitly left open rather than decided here.
- Any editing/regeneration-with-feedback loop — one-shot generation only.
- Saving or sharing the generated concept image — it's ephemeral, viewed once per generation.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | This feature requires an image-generation API, which is a materially different (and separately paid) vendor relationship than the Claude API decision already locked in for CarAI's text/structured-output work (Claude does not generate images). Candidates include a diffusion-model API (e.g. via Replicate or fal.ai) or a provider offering both text and image generation under one account. | **Product owner — open, not decided by this spec.** | **Unresolved by design.** Unlike the smaller implementation calls made throughout this backlog, committing to a new paid third-party API relationship is a product/business decision, not an engineering detail — this spec is written against the `ImageGenerationProvider` interface specifically so that decision can be made independently, without blocking spec approval or requiring a rewrite once made. |
| 2 | Image-generation costs can be significant per call relative to CarAI's text completions — worth a hard per-day/per-IP cap in addition to the per-minute rate limit in AC-5. | Product owner | Open — a concrete cap should be set once a provider (and its real pricing) is chosen. |

---

## 9. Rollout

- **Feature flag:** `CONCEPT_RENDERS_ENABLED` — should default to **off** until Risk #1's provider decision is made and its cost implications are understood.
- **Migration order:** N/A.
- **Rollback:** disable the flag; nothing else depends on this spec.
- **Observability:** log every generation request's cost/latency/outcome — this is the single most expensive-per-call feature in the entire backlog and needs cost visibility from day one.

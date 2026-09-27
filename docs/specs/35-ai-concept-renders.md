# Spec: AI-Generated Concept Renders

**File:** `docs/specs/35-ai-concept-renders.md`
**Status:** Implemented
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
| AC-1 | **Given** a finished build **When** the user clicks "Imagine the Ultimate Version" (next to Capture Build/Video in the configurator) **Then** the backend validates the build like a save, builds a prompt from the catalog's own names for the vehicle and its visible options with an instruction to imagine a more extreme/aspirational version, sends it to the configured image-generation provider, and returns the resulting image. The request carries no free text, so nothing a user sends can steer the prompt |
| AC-2 | **Given** the generated image **When** displayed **Then** it is **unmistakably labeled** "AI Concept — Not a Real Configuration" in every state of its dialog (loading, image, error), with an "AI Concept" badge on the image itself and a dashed violet frame — visually distinct from the real 3D showroom and from Spec 14's buildable recommendation cards |
| AC-3 | **Given** the generated image **When** shown **Then** there is **no "Apply" action** of any kind — only Close. It isn't built from real catalog options and can never be applied to the configuration |
| AC-4 | **Given** generation fails or times out (60 seconds) **When** this happens **Then** the dialog shows "Couldn't generate a concept right now — try again." with a Try Again button, and the rest of the build/summary experience is unaffected. The vendor's own error detail is never shown |
| AC-5 | **Given** this is a paid, per-request external API call **When** exposed to users **Then** it's limited to **2 a minute and 10 a day per visitor (IP)** and **100 a day across the whole site** (UTC days) — more conservatively than Spec 14's CarAI |
| AC-6 | **Given** no image provider is chosen yet (Risk #1) **When** the feature is turned on with `IMAGE_PROVIDER="placeholder"` **Then** a local, clearly-labeled "development placeholder" image is returned at no cost, and the dialog says so — so the whole flow can be built, tested and demoed before a vendor is picked |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/ai/concept-render` | none (rate-limited) | `200` `ApiResponse<ConceptRenderDto>` | off unless `CONCEPT_RENDERS_ENABLED=true` and a provider is configured |

```ts
export interface ConceptRenderRequest {
  vehicleSlug: string;
  singleSelections: Record<SingleSelectCategory, string>;
  multiSelections: Record<MultiSelectCategory, string[]>;
  customPaintHex?: string | null; // only with the Custom Color paint; described by its color
}

export interface ConceptRenderDto {
  imageUrl: string; // the image itself as a data: URL — never a link to the provider, never stored
  isPlaceholder: boolean; // true for the development placeholder
}
```

### Provider abstraction

```ts
// backend/src/services/imageGeneration/ImageGenerationProvider.ts
export interface ImageGenerationProvider {
  readonly name: string; // for logs
  readonly isPlaceholder: boolean;
  readonly estimatedCostUsd: number; // per image, for the cost log
  generate(prompt: string, options: { signal: AbortSignal }): Promise<{ data: Buffer; contentType: string }>;
}
```

The provider returns the image's bytes; the backend passes them to the browser as a data: URL, so there's no expiring vendor link and the browser never contacts the vendor. The only provider today is the development placeholder (`IMAGE_PROVIDER="placeholder"`); a real vendor is one new adapter registered in `services/imageGeneration/index.ts`.

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `400` | `VALIDATION_ERROR` | reused — malformed build or custom color |
| `404` | `VEHICLE_NOT_FOUND` | reused |
| `422` | `OPTION_VEHICLE_MISMATCH` / `DUPLICATE_OPTION_SELECTION` | reused |
| `429` | `RATE_LIMITED` | reused — over 2 a minute (the codebase's API rate-limit code; `TOO_MANY_ATTEMPTS` is its login-only code) |
| `429` | `CONCEPT_RENDER_DAILY_LIMIT` | **new** — over 10 a day for this visitor, or 100 a day site-wide |
| `502` | `IMAGE_PROVIDER_ERROR` | **new** — provider call failed, timed out, or returned something that isn't an image |
| `503` | `CONCEPT_RENDERS_DISABLED` | **new** — the flag is off or no provider is configured (checked before the rate limits, so these never use anyone's allowance) |

### Breaking-change check

- [x] First version of this contract.

---

## 4. Data model changes

None — generated images are not persisted (regenerated on demand, not saved as part of a `Configuration`); this keeps scope small and avoids storage-cost questions for a purely aspirational, disposable output.

---

## 5. UI states

| State | Behaviour |
|---|---|
| **Loading** | "Imagining the ultimate version…" with a spinner (respects reduced motion), since generation genuinely takes several seconds |
| **Error** | AC-4 |
| **Success** | image + prominent "AI Concept" label, no Apply action (AC-2/AC-3); with the placeholder, a note saying no provider is connected yet |

The dialog is modal (focus-trapped, Escape or clicking outside closes it); closing cancels a generation still in progress and returns focus to the button. It is hidden entirely unless `NEXT_PUBLIC_CONCEPT_RENDERS_ENABLED=true`.

**Route(s):** a button in the configurator beside Capture Build/Video, opening a dialog.
**Directory:** `frontend/src/components/ai/ConceptRender/`, `backend/src/services/imageGeneration/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | prompt construction, the placeholder (labeling, XML escaping), provider selection and the flag, timeout/abort, rejecting unusable images, the site-wide daily cap and its UTC rollover | `backend/tests/imageGeneration/prompt.test.ts` |
| **Integration** | the endpoint with a fake provider: success, custom color, validation (nothing invalid reaches the provider), provider failure, off/no-provider (not consuming allowance), per-minute, per-day and site-wide limits, the placeholder end to end | `backend/tests/integration/conceptRender.int.test.ts` |
| **Component** | the "not a real configuration" label in every state and the absence of any Apply action (asserted explicitly), loading/success/placeholder/error/retry, each error message, closing cancels and returns focus | `frontend/tests/ai/ConceptRender.test.tsx` |
| **E2E** | with the endpoint mocked and WebGL off: the labeled, non-applicable flow and retry-after-failure (with `NEXT_PUBLIC_CONCEPT_RENDERS_ENABLED=true`); hidden entirely by default | `frontend/e2e/concept-render.spec.ts` |

**Coverage:** ≥80% on new code; the labeling/no-apply-action assertions are treated as correctness-critical, not cosmetic.

---

## 7. Out of scope

- Connecting a real image-generation provider — see Risk #1. The product owner chose to build against the interface with a development placeholder and connect a vendor later.
- Any editing/regeneration-with-feedback loop — one-shot generation only.
- Saving or sharing the generated concept image — it's ephemeral, viewed once per generation.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | This feature requires an image-generation API, which is a materially different (and separately paid) vendor relationship than the Claude API decision already locked in for CarAI's text/structured-output work (Claude does not generate images). Candidates include a diffusion-model API (e.g. via Replicate or fal.ai) or a provider offering both text and image generation under one account. | **Product owner** | **Decided for now: no vendor yet.** Built against the interface with a local development placeholder (`IMAGE_PROVIDER="placeholder"`) and the feature off by default; the vendor (e.g. Replicate/FLUX or OpenAI) is added later as one adapter. Original note: Unlike the smaller implementation calls made throughout this backlog, committing to a new paid third-party API relationship is a product/business decision, not an engineering detail — this spec is written against the `ImageGenerationProvider` interface specifically so that decision can be made independently, without blocking spec approval or requiring a rewrite once made. |
| 2 | Image-generation costs can be significant per call relative to CarAI's text completions — worth a hard per-day/per-IP cap in addition to the per-minute rate limit in AC-5. | Product owner | Resolved — 10 a day per visitor and 100 a day site-wide (AC-5); revisit the numbers once a vendor's real pricing is known. |

---

## 9. Rollout

- **Feature flag:** `CONCEPT_RENDERS_ENABLED` (backend) and `NEXT_PUBLIC_CONCEPT_RENDERS_ENABLED` (frontend) — both default to **off** until Risk #1's provider is connected and its cost implications are understood. Turning it on also needs `IMAGE_PROVIDER` set.
- **Migration order:** N/A.
- **Rollback:** disable the flag; nothing else depends on this spec.
- **Observability:** every generation attempt logs `concept_render.generate` with provider, vehicle, latency, outcome (success/error/timeout) and estimated cost — this is the single most expensive-per-call feature in the entire backlog and needs cost visibility from day one.

# Spec: AI Configuration Backend (CarAI)

**File:** `docs/specs/14-ai-configuration-backend.md`
**Status:** Implemented
**Author:** Syed Hunain Raza
**Reviewer:** hunainalisyed@gmail.com
**Related:** SRS §13 (AI Car Configuration Assistant), §14 (AI Configuration Commands), §16 (AI API Architecture); depends on `02-vehicle-catalog-data-model.md` (catalog, category constants), `03-dynamic-pricing-engine.md`

---

## 1. Problem statement

**Today:** Phase 1 gives users full manual control over their configuration (Specs 6–8), but nothing lets them describe what they want in plain language and get a real, applicable recommendation back. SRS §13 calls this assistant **CarAI**; §14 requires its output to be structured data the frontend can safely apply, not prose; §16 requires the AI provider to be called only from the backend, with API keys never reaching the browser.

**Who is affected:** Every user who'd rather describe an intent ("sporty car for daily driving," "something elegant and minimal") than click through sixteen category panels themselves.

**Why it matters now:** It's the first Phase 2 spec and the foundation Spec 15 (the chat UI) is built on — this spec defines the contract and the safety guarantees; Spec 15 only needs to call it and render the result.

**Success looks like:** A user's natural-language request reliably comes back as a recommendation built entirely from options that actually exist on the vehicle they're looking at, with a server-computed real price — never an invented option, never a hallucinated total, and never an exposed API key.

---

## 2. Acceptance criteria

| # | Criterion |
|---|---|
| AC-1 | **Given** a request naming a vehicle and a user message **When** the backend calls the Claude API **Then** it uses tool-use with parameters whose valid values are dynamically constrained, per category, to that specific vehicle's actual `CustomizationOption` ids (Spec 2) fetched at request time — the model is structurally unable to select an option that doesn't exist for that vehicle |
| AC-2 | **Given** the model's tool-call response **When** the backend receives it **Then** every returned `(category, optionId)` pair is independently re-validated against the current catalog before being included in the response — this is defense in depth on top of AC-1's enum constraint, not a replacement for it; any pair that somehow fails validation is silently dropped from the recommendation rather than failing the whole request |
| AC-3 | **Given** a validated recommendation **When** the response is built **Then** its price total is computed by calling Spec 3's pricing function server-side over the user's current selections merged with the recommendation's changes — the total is never a number the model produced itself |
| AC-4 | **Given** a message that doesn't warrant any configuration change (off-topic, a clarifying question, insufficient detail to act on) **When** processed **Then** the response has `recommendation: null` and an `assistantMessage` that responds appropriately without fabricating a change |
| AC-5 | **Given** the request includes the user's current selections **When** a relative command is sent (e.g. "make the interior darker," "make it more aggressive") **Then** the recommendation is computed relative to those current selections, not the vehicle's defaults |
| AC-6 | **Given** the Claude API call fails, times out, or returns output that cannot be parsed at all **When** this happens **Then** the endpoint returns `502` with code `AI_PROVIDER_ERROR`, which this spec adds to Spec 12's `getErrorMessage` mapping as: "CarAI is temporarily unavailable. You can continue configuring manually." (SRS §28's exact copy) |
| AC-7 | **Given** an unknown `vehicleSlug` **When** requested **Then** the endpoint returns `404` `VEHICLE_NOT_FOUND` (Spec 2's existing code, reused) |
| AC-8 | **Given** the Claude API key **When** the system runs **Then** it exists only as a backend environment variable (`ANTHROPIC_API_KEY`), is never referenced by any frontend code path, and never appears in any response body, error message, or client-visible log (SRS §16) |
| AC-9 | **Given** a user message attempting prompt injection (e.g. asking the assistant to ignore its instructions, invent an option, or set an arbitrary price) **When** processed **Then** the structural constraints from AC-1/AC-2/AC-3 mean the worst possible outcome is an unhelpful or off-tone `assistantMessage` — it can never result in an invalid option being returned or in a price that disagrees with Spec 3's real calculation |

---

## 3. API contract

### Endpoints

| Method | Route | Auth | Success | Notes |
|---|---|---|---|---|
| `POST` | `/api/ai/configure` | none (guest) | `200` `ApiResponse<AiConfigureResponseDto>` | stateless — the frontend owns conversation history (Spec 15) and resends whatever context is relevant on each call |

### Request and response DTOs

```ts
// backend/src/types/ai.ts

export interface AiConfigureRequest {
  vehicleSlug: string;
  message: string;                      // the user's latest natural-language message
  history?: { role: "user" | "assistant"; content: string }[]; // prior turns, most-recent last, for context
  currentSelections: {
    singleSelections: Record<SingleSelectCategory, string>;
    multiSelections: Record<MultiSelectCategory, string[]>;
  };
}

export interface AiConfigureResponseDto {
  assistantMessage: string;             // CarAI's natural-language reply, always present
  recommendation: {
    singleSelections: Partial<Record<SingleSelectCategory, string>>; // only categories CarAI chose to change
    multiSelections: Partial<Record<MultiSelectCategory, string[]>>; // accessories/packages to add
  } | null;                             // null when no change is warranted (AC-4)
  breakdown: PriceBreakdownDto | null;   // present only when recommendation is non-null (AC-3)
}
```

The recommendation is intentionally partial (only the categories CarAI decided to change), matching SRS §13's own example response, which lists five items, not all eighteen categories. Applying it (Spec 15) is a direct merge into the configuration store (Spec 6) — never a full replacement — since every id in it is already guaranteed to be a valid option for the current vehicle.

### Error codes

| HTTP | `code` | When |
|---|---|---|
| `502` | `AI_PROVIDER_ERROR` | the Claude API call failed, timed out, or its output could not be parsed at all |
| `404` | `VEHICLE_NOT_FOUND` | reused from Spec 2 |
| `400` | `VALIDATION_ERROR` | malformed request shape |
| `503` | `AI_ASSISTANT_DISABLED` | `AI_ASSISTANT_ENABLED` is explicitly set to `"false"` (added during implementation — see Rollout and §7a) |

### Breaking-change check

- [x] First version of this contract.

---

## 4. Data model changes

None. This endpoint is stateless — no conversation, message, or recommendation is persisted server-side in Phase 2. The frontend (Spec 15) holds message history in its own component/session state for the duration of the chat.

### Server-side catalog-to-tool-schema mapping (canonical for this spec)

```ts
// backend/src/services/ai/buildToolSchema.ts
export function buildConfigureToolSchema(vehicle: VehicleDetailDto): AnthropicToolDefinition {
  // For each SingleSelectCategory, an enum of that vehicle's actual CustomizationOption ids.
  // For each MultiSelectCategory, an array-of-enum of that vehicle's actual CustomizationOption ids.
  // Rebuilt fresh per request from live catalog data — never cached stale across a catalog change.
}
```

---

## 5. UI states

This spec has no UI of its own (Spec 15 owns the chat interface). It defines the states Spec 15 must handle:

| State | Behaviour (owned by Spec 15, contract defined here) |
|---|---|
| **Calculating** | `POST /api/ai/configure` in flight |
| **No change recommended** | `recommendation: null` — Spec 15 shows `assistantMessage` only, no "Apply" action |
| **Error** | `AI_PROVIDER_ERROR` or any other failure — Spec 15 shows the SRS §28 message and lets the user keep configuring manually (AC-6) |
| **Success with recommendation** | Spec 15 renders `assistantMessage` plus a recommendation card and an "Apply Configuration" action |

**Route(s):** none (backend-only).
**Directory:** `backend/src/routes/ai.ts`, `backend/src/services/ai/`

---

## 6. Test plan

| Level | What it covers | Where |
|---|---|---|
| **Unit** | `buildConfigureToolSchema`: enums always exactly match the given vehicle's live catalog | `backend/tests/ai/toolSchema.test.ts` |
| **Unit** | response validation: any option id not in the catalog is dropped, not passed through | `backend/tests/ai/validateRecommendation.test.ts` |
| **Integration** | `POST /api/ai/configure` against a mocked Claude client: happy path, no-recommendation path, provider-error path, price computed via real Spec 3 function | `backend/tests/integration/ai.int.test.ts` |
| **Integration** | prompt-injection style inputs (asking for a nonexistent option, asking to set price directly) still return only valid, correctly-priced recommendations or `recommendation: null` | `backend/tests/integration/ai.int.test.ts :: adversarial inputs` |

**Traceability**

| AC | Test |
|---|---|
| AC-1 | `toolSchema.test.ts` |
| AC-2 | `validateRecommendation.test.ts` |
| AC-3 | `ai.int.test.ts :: price computed via Spec 3` |
| AC-4, AC-5 | `ai.int.test.ts :: recommendation and relative-command cases` (mocked model responses) |
| AC-6 | `ai.int.test.ts :: provider error mapping` |
| AC-7 | `ai.int.test.ts :: 404 VEHICLE_NOT_FOUND` |
| AC-8 | manual/config review — no automated test can prove a secret is *never* logged, but a lint rule flagging `ANTHROPIC_API_KEY` usage outside `backend/src/services/ai/` is a reasonable guard |
| AC-9 | `ai.int.test.ts :: adversarial inputs` |

**Coverage:** ≥80% on new code; the validation path (AC-2) should be close to 100% given its security role.

**Not covered, deliberately:** the quality/helpfulness of CarAI's actual recommendations (a prompt-engineering and model-behavior concern, not something a unit/integration test can meaningfully assert) — evaluated manually during implementation and refined iteratively.

---

## 7. Out of scope

- The chat UI itself (Spec 15).
- Recommending a *different vehicle* than the one currently open — CarAI operates within the currently-loaded vehicle's catalog only; cross-vehicle recommendations ("which car should I get") are not handled. See Risk #2.
- Persisted conversation history across sessions — Phase 2 is stateless per the frontend's own session; a "saved chat history" feature is not requested anywhere in the SRS.
- Enforcing a stated budget constraint (e.g. "under €100,000") beyond passing the user's own words to the model and returning the real computed total — see Risk #1.

---

## 7a. Implementation notes

- **A schema that only constrains option ids gives the model nothing to reason with.** `buildConfigureToolSchema` enforces which ids are *valid*, but doesn't tell the model what any id *is* — mapping "make the interior darker" to a specific `INTERIOR_MATERIAL`/`INTERIOR_LIGHTING` id needs option names/descriptions/prices, and the user's current selections resolved to names, not bare ids. `buildPrompt.ts` builds this: static persona/rules go in `system`; the per-vehicle catalog (every option's name/description/price, grouped by category) plus current selections (ids resolved to names) plus `history` plus the latest `message` go in `messages`, in that order — this is what makes AC-5's relative commands actually work, not just what the enum constraint alone provides.
- **One forced tool, never free text to parse.** `recommend_configuration` is always called via `tool_choice: {type: "tool", name: ...}` — the backend never branches on "did the model call a tool or reply in prose," it only ever reads the tool's structured `input`. `assistantMessage` lives *inside* that same tool call (not a separate content block), so there's exactly one code path for extracting output, not two.
- **Flat per-category schema, not a nested optional `recommendation` object.** Strict mode requires every property in `required`; optionality is expressed via a nullable type (`{"anyOf": [{"type":"null"}, {"type":"string","enum":[...]}]}` per category), not omission. A nested object would need the same per-category nullable leaves one level deeper, plus an extra null/object branch — flat is simpler and no less constrained. All-category-null is how "no recommendation is warranted" (AC-4) is represented.
- **Merge semantics** (not stated as precisely as this in §3, resolved here): `singleSelections` — the recommendation replaces the current value per changed category (only one value is ever possible per category). `multiSelections` — the recommendation's ids are *added* to the current selections per category (per §3's own DTO comment, "accessories/packages to add"), deduplicated via `Set` before merging — this specifically avoids `calculatePrice` throwing `DUPLICATE_OPTION_SELECTION` when the model "recommends" an accessory the user already has.
- **Every Claude API failure collapses to one `AiProviderError` → 502, deliberately not distinguished by SDK exception subclass.** The `try` block around the API call wraps nothing else, so any error it throws — a typed SDK exception or otherwise — is by definition an AI-provider failure, not a bug elsewhere in the orchestration; AC-6 treats all of them identically, so there's no behavioral reason to branch on error type.
- **Thinking is left adaptive (Opus 5's own default) at `effort: "low"`, not disabled**, even though this task ("pick from a constrained catalog, write a short reply") doesn't obviously need extended thinking. Disabling thinking on Opus 5 has a documented failure mode where the model can write what should be a tool call into visible text instead of a real `tool_use` block — for a forced-single-tool endpoint that would surface as an avoidable `AI_PROVIDER_ERROR`, not a correctness risk, but there's no reason to accept that cost. Model/timeout/max_tokens/thinking/effort are all pinned as named constants in `claudeClient.ts` (Risk #3), not inline literals.
- **No live-API smoke test was run during this implementation** — every test (unit and integration) exercises this against a mocked `createConfigureMessage`, never the real Claude API, since no `ANTHROPIC_API_KEY` was available in this environment at implementation time. In particular, the exact nullable-`anyOf` JSON-schema shape and forced `tool_choice` + adaptive-thinking combination are believed correct from Anthropic's own current documentation but have **not** been empirically verified against a live call. Do this before shipping Spec 15's chat UI against this endpoint for real.
- **`AI_ASSISTANT_ENABLED` and its `503 AI_ASSISTANT_DISABLED` code were added during implementation**, not originally in this spec's §3 — the Rollout section only suggested the flag as something to "consider," but building it was cheap and this is explicitly the first endpoint in the product that spends real money per request. The error code is now listed in §3 alongside the two ACs' original three.
- **This repo's first `vi.mock()` usage.** No prior backend test mocked an external dependency — every earlier integration test ran against a real seeded Postgres only. `claudeClient.ts` is deliberately a one-function wrapper (`createConfigureMessage`) specifically so the mocking surface stays minimal — tests mock that one function, never the `@anthropic-ai/sdk` package itself.
- **The AI rate limiter's tight window (1 request / 5s) blocked this file's own rapid-fire integration tests against each other** — `aiRateLimit` isn't what `ai.int.test.ts` is testing, so that test file mocks `middleware/rateLimit.js` to bypass it (`aiRateLimit` replaced with a pass-through, `configurationRateLimit` left real via `importOriginal`), rather than adding test-only reset surface area to production code.

---

## 8. Risks and open questions

| # | Risk / question | Owner | Resolution |
|---|---|---|---|
| 1 | SRS §14 includes budget-constrained requests ("Give me a configuration under €100,000"). This spec doesn't parse or enforce a numeric budget separately from the model's own reasoning — it relies on the model to attempt satisfying the constraint and returns whatever real total results, which may exceed the stated budget. | Product owner | Resolved for Phase 2 — accepted as best-effort; the response's `breakdown.totalPriceCents` is always truthful (Spec 3), so Spec 15's UI can compare it against a budget the user stated and say so, even if this backend doesn't enforce it directly. Revisit with explicit budget-fitting logic (e.g. reject-and-retry with a lower-cost prompt) only if real usage shows the model regularly misses badly. |
| 2 | No cost/rate control exists yet on an endpoint that calls a paid external API and requires no auth. | Product owner | Open — recommend a per-IP rate limit similar to Spec 10's Risk #1, sized to a reasonable chat cadence (e.g. one request per few seconds), implemented before this ships publicly. Full abuse monitoring remains Phase 3 (§34.2). |
| 3 | Claude API model choice, max tokens, and temperature aren't pinned in this spec. | Implementer | Open — an implementation detail to settle when writing the integration, not a product decision; should be pinned in code/config (not hardcoded inline) so it can be tuned without a spec change. |

---

## 9. Rollout

- **Feature flag:** consider gating `/api/ai/configure` behind a simple env-var flag (`AI_ASSISTANT_ENABLED`) so it can be disabled instantly if the Claude API has an outage or costs run away, without a deploy.
- **Migration order:** N/A — no schema.
- **Rollback:** disable the flag above, or remove the route; Spec 15's UI degrades to its error state (AC-6) and the rest of the app is unaffected.
- **Observability:** log every request's latency, token usage, and whether a recommendation was produced or rejected by validation (AC-2) — this is the first spec in the product that spends real money per request, so cost visibility matters from day one, not deferred entirely to Phase 3.

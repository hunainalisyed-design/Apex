import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Pinned here, not inline, per Spec 14 Risk #3 ("should be pinned in code/config so it can
// be tuned without a spec change").
export const AI_MODEL = "claude-opus-5";
const REQUEST_TIMEOUT_MS = 25_000; // a synchronous chat request, not a job — much shorter
// than the SDK's own 10-minute default.
const MAX_TOKENS = 2048; // this endpoint's output is a short reply plus a handful of
// enum-constrained fields, never a long document.

export interface CreateConfigureMessageParams {
  system: string;
  messages: Anthropic.MessageParam[];
  tool: Anthropic.Tool;
}

/**
 * The one place this backend calls the Claude API (Spec 14) — kept as a thin wrapper so
 * tests can mock exactly this function (`vi.mock("./claudeClient.js")`) rather than the
 * whole @anthropic-ai/sdk package. This is the first mocked-external-client pattern in this
 * repo; keeping the seam this small is deliberate given that.
 *
 * `tool_choice` forces the model to always call the one tool it's given — the response is
 * therefore never free text to parse, only ever that tool's structured `input` (AC-9).
 * Thinking stays adaptive (Opus 5's own default) at low effort — deliberately NOT disabled,
 * since disabling thinking on Opus 5 has a documented failure mode where the model can
 * write what should be a tool call into visible text instead of a real tool_use block,
 * which would inflate this endpoint's AI_PROVIDER_ERROR rate for no benefit on a task this
 * simple (pick from a constrained catalog, write a short reply).
 */
export async function createConfigureMessage(params: CreateConfigureMessageParams): Promise<Anthropic.Message> {
  return client.messages.create(
    {
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: params.system,
      messages: params.messages,
      tools: [params.tool],
      tool_choice: { type: "tool", name: params.tool.name },
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
    },
    { timeout: REQUEST_TIMEOUT_MS },
  );
}

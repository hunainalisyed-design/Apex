import Anthropic from "@anthropic-ai/sdk";
import type { CustomizationOption, Vehicle } from "@prisma/client";
import { logger } from "../../lib/logger.js";
import { mapOptionToDto, mapVehicleToDetailDto } from "../catalog.js";
import { calculatePrice, PricingError } from "../pricing.js";
import type { PriceBreakdownDto } from "../../types/pricing.js";
import { MULTI_SELECT_CATEGORIES } from "../../types/catalog.js";
import type { AiConfigureRequest, AiConfigureResponseDto } from "../../types/ai.js";
import type { MultiSelectCategory, SingleSelectCategory } from "../../types/pricing.js";
import { buildConfigureToolSchema, CONFIGURE_TOOL_NAME } from "./buildToolSchema.js";
import { buildConversationMessages, buildSystemPrompt } from "./buildPrompt.js";
import { createConfigureMessage } from "./claudeClient.js";
import { validateRecommendation, type RawToolRecommendation } from "./validateRecommendation.js";

/** Any Claude API failure, timeout, or output this backend can't use at all (Spec 14, AC-6)
 * — the route maps this to 502 AI_PROVIDER_ERROR. Never carries the raw Anthropic error
 * message's full detail into anything client-visible beyond the generic mapped copy. */
export class AiProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderError";
  }
}

export interface ConfigureVehicleWithAiInput {
  vehicle: Vehicle;
  options: CustomizationOption[];
  request: Pick<AiConfigureRequest, "message" | "history" | "currentSelections">;
}

/**
 * The one function the route calls (Spec 14). Builds the prompt + tool schema from the
 * live catalog, forces Claude to call the one tool, re-validates its output (AC-2), merges
 * it into the user's current selections, and prices the result with the real Spec 3
 * function — the total is never a number the model produced (AC-3).
 */
export async function configureVehicleWithAi(input: ConfigureVehicleWithAiInput): Promise<AiConfigureResponseDto> {
  const vehicleDetail = mapVehicleToDetailDto(input.vehicle, input.options);
  const optionDtos = input.options.map(mapOptionToDto);

  const tool = buildConfigureToolSchema(vehicleDetail);
  const messages = buildConversationMessages(vehicleDetail, input.request);

  // Spec 22 AC-4: every AI call gets one structured log line with latency, outcome, and the
  // vehicle slug (never the user's message text or any other PII) — this is the first place
  // in the product a "hard-to-reproduce" AI-provider issue becomes visible outside a
  // terminal someone happened to be watching.
  const startedAt = Date.now();
  let response: Anthropic.Message;
  try {
    response = await createConfigureMessage({ system: buildSystemPrompt(), messages, tool });
  } catch (err) {
    // This try block wraps nothing but the one call to createConfigureMessage — its entire
    // body is a single client.messages.create() call, so ANY error it throws (a typed SDK
    // exception — rate limit, auth, connection/timeout, not-found, generic API status — or
    // anything else) is by definition an AI-provider failure, not a bug elsewhere in this
    // function. AC-6 treats every one of these identically, so there's no need to
    // distinguish by type here.
    const message = err instanceof Error ? err.message : "unknown error";
    logger.info(
      { vehicleSlug: vehicleDetail.slug, latencyMs: Date.now() - startedAt, outcome: "error" },
      "ai.configure call",
    );
    throw new AiProviderError(`CarAI request failed: ${message}`);
  }

  if (response.stop_reason !== "tool_use") {
    logger.info(
      { vehicleSlug: vehicleDetail.slug, latencyMs: Date.now() - startedAt, outcome: "error" },
      "ai.configure call",
    );
    throw new AiProviderError(`CarAI did not return a usable recommendation (stop_reason: ${response.stop_reason}).`);
  }
  logger.info(
    { vehicleSlug: vehicleDetail.slug, latencyMs: Date.now() - startedAt, outcome: "success" },
    "ai.configure call",
  );

  const toolUseBlock = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use" && block.name === CONFIGURE_TOOL_NAME,
  );
  if (!toolUseBlock) {
    throw new AiProviderError("CarAI's response did not include the expected tool call.");
  }

  const raw = toolUseBlock.input as RawToolRecommendation;
  const assistantMessage = typeof raw.assistantMessage === "string" ? raw.assistantMessage : "";

  const validated = validateRecommendation(raw, optionDtos);
  const hasRecommendation =
    Object.keys(validated.singleSelections).length > 0 || Object.keys(validated.multiSelections).length > 0;

  if (!hasRecommendation) {
    return { assistantMessage, recommendation: null, breakdown: null };
  }

  const mergedSingle: Record<SingleSelectCategory, string> = {
    ...input.request.currentSelections.singleSelections,
    ...validated.singleSelections,
  };

  const mergedMulti: Record<MultiSelectCategory, string[]> = { ...input.request.currentSelections.multiSelections };
  for (const category of MULTI_SELECT_CATEGORIES) {
    const recommended = validated.multiSelections[category];
    if (!recommended) continue;
    mergedMulti[category] = Array.from(new Set([...(mergedMulti[category] ?? []), ...recommended]));
  }

  const pricingStartedAt = Date.now();
  let breakdown: PriceBreakdownDto;
  try {
    breakdown = calculatePrice({
      vehicle: { slug: vehicleDetail.slug, basePriceCents: vehicleDetail.basePriceCents, currency: vehicleDetail.currency },
      options: optionDtos,
      singleSelections: mergedSingle,
      multiSelections: mergedMulti,
    });
  } catch (err) {
    logger.info(
      {
        vehicleSlug: vehicleDetail.slug,
        latencyMs: Date.now() - pricingStartedAt,
        outcome: err instanceof PricingError ? "validation-rejected" : "error",
      },
      "pricing.calculate",
    );
    throw err;
  }
  logger.info(
    { vehicleSlug: vehicleDetail.slug, latencyMs: Date.now() - pricingStartedAt, outcome: "success" },
    "pricing.calculate",
  );

  return { assistantMessage, recommendation: validated, breakdown };
}

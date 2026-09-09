import type Anthropic from "@anthropic-ai/sdk";
import { MULTI_SELECT_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "../../types/catalog.js";
import type { CustomizationOptionDto, VehicleDetailDto } from "../../types/catalog.js";
import type { AiConfigureRequest } from "../../types/ai.js";

const SYSTEM_PROMPT = `You are CarAI, a configuration assistant built into a premium car configurator.

Rules:
- You must call the recommend_configuration tool exactly once, every time — never reply with plain text.
- Only use option ids from the catalog given to you in this conversation; each field's enum is exhaustive, so there is no valid choice outside it.
- Set a category's field to null when you are not changing it. If the user's message doesn't warrant any configuration change (it's off-topic, a clarifying question, or too vague to act on), leave every category null and just reply helpfully in assistantMessage.
- Treat relative requests ("make it more aggressive", "make the interior darker", "add something sporty") as relative to the user's CURRENT selections given below, not the vehicle's defaults.
- Never state a specific total price in your reply — the app always shows the real, authoritative computed price separately, and a number you state yourself could be wrong.`;

function formatPriceDelta(priceDeltaCents: number): string {
  if (priceDeltaCents === 0) return "included";
  const amount = (priceDeltaCents / 100).toFixed(2);
  return `+${amount}`;
}

function describeOption(option: CustomizationOptionDto): string {
  const description = option.description ? ` — ${option.description}` : "";
  return `  - ${option.id}: "${option.name}"${description} (${formatPriceDelta(option.priceDeltaCents)})`;
}

function buildCatalogBlock(vehicle: VehicleDetailDto): string {
  const lines: string[] = [`Vehicle: ${vehicle.name} — ${vehicle.tagline}`, "", "Available options by category:"];

  for (const category of [...SINGLE_SELECT_CATEGORIES, ...MULTI_SELECT_CATEGORIES]) {
    const options = vehicle.options[category] ?? [];
    if (options.length === 0) continue;
    lines.push(`${category}:`);
    for (const option of options) lines.push(describeOption(option));
  }

  return lines.join("\n");
}

function resolveOptionName(options: CustomizationOptionDto[], id: string | undefined): string {
  if (!id) return "(none)";
  return options.find((option) => option.id === id)?.name ?? id;
}

function buildCurrentSelectionsBlock(
  vehicle: VehicleDetailDto,
  currentSelections: AiConfigureRequest["currentSelections"],
): string {
  const lines: string[] = ["Current selections:"];

  for (const category of SINGLE_SELECT_CATEGORIES) {
    const options = vehicle.options[category] ?? [];
    lines.push(`  ${category}: ${resolveOptionName(options, currentSelections.singleSelections[category])}`);
  }

  for (const category of MULTI_SELECT_CATEGORIES) {
    const options = vehicle.options[category] ?? [];
    const ids = currentSelections.multiSelections[category] ?? [];
    const names = ids.length > 0 ? ids.map((id) => resolveOptionName(options, id)).join(", ") : "(none)";
    lines.push(`  ${category}: ${names}`);
  }

  return lines.join("\n");
}

export function buildSystemPrompt(): string {
  return SYSTEM_PROMPT;
}

/**
 * Assembles the conversation Claude sees (Spec 14, AC-5): a first user turn carrying the
 * vehicle's full catalog (option names/descriptions/prices, not just the ids the tool
 * schema constrains to — the model needs names to map an intent like "darker interior" to
 * the right id) plus the user's current selections resolved to names, followed by the
 * prior turns (`history`) and finally the latest message. This is what makes relative
 * commands work: the model always has the actual current build in front of it, not the
 * vehicle's defaults.
 */
export function buildConversationMessages(
  vehicle: VehicleDetailDto,
  request: Pick<AiConfigureRequest, "message" | "history" | "currentSelections">,
): Anthropic.MessageParam[] {
  const contextMessage = [buildCatalogBlock(vehicle), "", buildCurrentSelectionsBlock(vehicle, request.currentSelections)].join(
    "\n",
  );

  const history: Anthropic.MessageParam[] = (request.history ?? []).map((turn) => ({
    role: turn.role,
    content: turn.content,
  }));

  return [{ role: "user", content: contextMessage }, ...history, { role: "user", content: request.message }];
}

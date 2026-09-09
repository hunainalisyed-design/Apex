import type Anthropic from "@anthropic-ai/sdk";
import { MULTI_SELECT_CATEGORIES, SINGLE_SELECT_CATEGORIES } from "../../types/catalog.js";
import type { VehicleDetailDto } from "../../types/catalog.js";

export const CONFIGURE_TOOL_NAME = "recommend_configuration";

/**
 * Builds the one tool CarAI is forced to call (Spec 14, AC-1) — rebuilt fresh every request
 * from the given vehicle's live catalog, never cached stale across a catalog change. Every
 * category is its own top-level, nullable, enum-constrained property rather than a nested
 * optional "recommendation" object: strict mode requires every property to be listed in
 * `required` (optionality is expressed via a nullable type, not omission), so a nested
 * object variant would need the exact same per-category nullable leaves one level deeper,
 * plus an extra null/object branch to choose between — flat is simpler and no less
 * constrained. All-null across every category is how "no recommendation is warranted"
 * (AC-4) is represented, with no separate flag needed.
 */
export function buildConfigureToolSchema(vehicle: VehicleDetailDto): Anthropic.Tool {
  const properties: Record<string, unknown> = {
    assistantMessage: {
      type: "string",
      description:
        "CarAI's natural-language reply to the user. Always present, even when no configuration change is warranted.",
    },
  };
  const required: string[] = ["assistantMessage"];

  for (const category of SINGLE_SELECT_CATEGORIES) {
    const optionIds = (vehicle.options[category] ?? []).map((option) => option.id);
    properties[category] = {
      anyOf: [{ type: "null" }, { type: "string", enum: optionIds }],
      description: `The CustomizationOption id to change this vehicle's ${category} to, or null to leave it unchanged.`,
    };
    required.push(category);
  }

  for (const category of MULTI_SELECT_CATEGORIES) {
    const optionIds = (vehicle.options[category] ?? []).map((option) => option.id);
    properties[category] = {
      anyOf: [{ type: "null" }, { type: "array", items: { type: "string", enum: optionIds } }],
      description: `CustomizationOption ids to add to this vehicle's ${category} selections, or null to add none.`,
    };
    required.push(category);
  }

  return {
    name: CONFIGURE_TOOL_NAME,
    description:
      "Report your reply to the user and, if warranted, a configuration recommendation built ONLY from this vehicle's real option ids — every enum above is exhaustive, there is no valid choice outside it. Leave a category null when you are not changing it. You must call this tool exactly once, every time.",
    strict: true,
    input_schema: {
      type: "object",
      properties,
      required,
      additionalProperties: false,
    },
  } as Anthropic.Tool;
}

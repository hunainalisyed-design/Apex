import type { PriceLineItemDto } from "../../types/pricing.js";

/** Categories the prompt describes, in the order a viewer would notice them. */
const DESCRIBED = [
  "PAINT",
  "WHEELS",
  "BRAKE_CALIPER",
  "WINDOW_TINT",
  "SPOILER",
  "FRONT_ACCESSORY",
  "REAR_ACCESSORY",
  "BODY_PACKAGE",
  "CARBON_COMPONENT",
  "ACCESSORY",
  "PACKAGE",
] as const;

const LABELS: Record<(typeof DESCRIBED)[number], string> = {
  PAINT: "paint",
  WHEELS: "wheels",
  BRAKE_CALIPER: "brake calipers",
  WINDOW_TINT: "window tint",
  SPOILER: "spoiler",
  FRONT_ACCESSORY: "front",
  REAR_ACCESSORY: "rear",
  BODY_PACKAGE: "body kit",
  CARBON_COMPONENT: "carbon",
  ACCESSORY: "accessory",
  PACKAGE: "package",
};

/** Default/"none" picks add nothing to a visual description. */
function isMeaningful(name: string): boolean {
  return !/^(none|standard|no |stock)/i.test(name.trim());
}

/**
 * The image prompt for a build (Spec 35, AC-1). Built only from the catalog's own names for the
 * already-validated selections (the request carries no free text), so nothing a user sends can
 * steer the prompt. Interior choices are left out: the render is an exterior hero shot.
 */
export function buildConceptPrompt(vehicleName: string, lineItems: PriceLineItemDto[], customPaintHex: string | null): string {
  const features: string[] = [];
  for (const category of DESCRIBED) {
    for (const item of lineItems.filter((i) => i.category === category)) {
      if (category === "PAINT" && customPaintHex) {
        features.push(`custom paint in color ${customPaintHex}`);
      } else if (isMeaningful(item.name)) {
        features.push(`${item.name} ${LABELS[category]}`.replace(/\s+/g, " ").trim());
      }
    }
  }

  return [
    `An aspirational concept car render: an even more extreme, dramatic "ultimate" version of a ${vehicleName}.`,
    features.length > 0 ? `Keep its character: ${features.join(", ")}.` : "",
    "Push it further than any real build: sharper aero, a lower and wider stance, bold concept-car details.",
    "Photorealistic automotive photography, 3/4 front hero angle from slightly low, soft studio lighting on a reflective floor, dark gradient backdrop.",
    "No text, no logos, no watermarks, no people.",
  ]
    .filter(Boolean)
    .join(" ");
}

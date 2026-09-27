import { logger } from "../../lib/logger.js";
import type { GeneratedImage, ImageGenerationProvider } from "./ImageGenerationProvider.js";
import { placeholderProvider } from "./placeholderProvider.js";

export type { ImageGenerationProvider } from "./ImageGenerationProvider.js";

/** A generation that takes longer than this is abandoned (AC-4). */
export const GENERATION_TIMEOUT_MS = 60_000;
/** Across the whole site, per UTC day — the hard cost ceiling (Spec 35, Risk #2). */
export const GLOBAL_DAILY_LIMIT = 100;
/** A generated image larger than this is treated as a provider failure. */
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

/** Off unless explicitly turned on (Spec 35 §9 — off until a provider and its costs are settled). */
export function isConceptRendersEnabled(): boolean {
  return process.env.CONCEPT_RENDERS_ENABLED === "true";
}

let providerOverride: ImageGenerationProvider | null | undefined;

/**
 * The configured provider, from IMAGE_PROVIDER, or null when none is. Only "placeholder" exists
 * today (the product owner chose to connect a real vendor later); a real adapter is added here.
 */
export function getImageGenerationProvider(): ImageGenerationProvider | null {
  if (providerOverride !== undefined) return providerOverride;
  switch (process.env.IMAGE_PROVIDER) {
    case "placeholder":
      return placeholderProvider;
    default:
      return null;
  }
}

/** Test-only: use this provider (null = none configured); undefined = back to IMAGE_PROVIDER. */
export function setImageGenerationProviderForTests(provider: ImageGenerationProvider | null | undefined): void {
  providerOverride = provider;
}

// --- Site-wide daily cap ----------------------------------------------------------------

let capDay = "";
let capCount = 0;

function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** Takes one of today's site-wide generations; false once they're used up. */
export function takeDailySlot(now: Date = new Date()): boolean {
  const day = utcDay(now);
  if (day !== capDay) {
    capDay = day;
    capCount = 0;
  }
  if (capCount >= GLOBAL_DAILY_LIMIT) return false;
  capCount += 1;
  return true;
}

export function resetDailyCapForTests(): void {
  capDay = "";
  capCount = 0;
}

// --- Generation -------------------------------------------------------------------------

/** A provider failure or timeout — the route answers 502 IMAGE_PROVIDER_ERROR (AC-4). */
export class ImageProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageProviderError";
  }
}

/**
 * One generation (AC-1), with a timeout, a sanity check on what came back, and a cost/latency
 * log line for every attempt (Spec 35 §9 — the most expensive call in the backlog). Returns the
 * image as a data: URL; nothing is stored.
 */
export async function generateConceptImage(provider: ImageGenerationProvider, prompt: string, context: { vehicleSlug: string }): Promise<string> {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);
  let outcome = "error";
  try {
    const image: GeneratedImage = await Promise.race([
      provider.generate(prompt, { signal: controller.signal }),
      new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () => reject(new ImageProviderError("timed out")), { once: true });
      }),
    ]);
    if (!image.contentType.startsWith("image/") || image.data.length === 0 || image.data.length > MAX_IMAGE_BYTES) {
      throw new ImageProviderError("provider returned an unusable image");
    }
    outcome = "success";
    return `data:${image.contentType};base64,${image.data.toString("base64")}`;
  } catch (err) {
    outcome = controller.signal.aborted ? "timeout" : "error";
    throw err instanceof ImageProviderError ? err : new ImageProviderError("provider failed");
  } finally {
    clearTimeout(timer);
    logger.info(
      {
        provider: provider.name,
        vehicleSlug: context.vehicleSlug,
        latencyMs: Date.now() - started,
        outcome,
        estimatedCostUsd: provider.estimatedCostUsd,
      },
      "concept_render.generate",
    );
  }
}

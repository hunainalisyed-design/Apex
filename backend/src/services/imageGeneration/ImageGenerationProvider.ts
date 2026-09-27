/**
 * The one seam between Spec 35 and whichever image-generation vendor is chosen (Spec 35,
 * Risk #1 — a product decision, deliberately still open). A real adapter (e.g. Replicate or
 * OpenAI) implements this single method: send the prompt, return the image's bytes. Nothing
 * else in the backend knows which vendor it is.
 */
export interface GeneratedImage {
  data: Buffer;
  /** e.g. "image/webp", "image/png" — must be an image type. */
  contentType: string;
}

export interface ImageGenerationProvider {
  /** A short name for logs, e.g. "placeholder", "replicate-flux-schnell". */
  readonly name: string;
  /** True only for the development placeholder, so the UI can say so. */
  readonly isPlaceholder: boolean;
  /** Estimated cost of one image in US dollars, for the cost log (Spec 35 §9). */
  readonly estimatedCostUsd: number;
  /** Must honour `signal` — the caller aborts it on timeout. Throw on any failure. */
  generate(prompt: string, options: { signal: AbortSignal }): Promise<GeneratedImage>;
}

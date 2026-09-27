import { ApiRequestError } from "./configurations";
import type { ConceptRenderDto, ConceptRenderRequest } from "@/types/conceptRender";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** Off unless explicitly turned on (Spec 35 §9) — mirrors the backend's CONCEPT_RENDERS_ENABLED. */
export const CONCEPT_RENDERS_ENABLED = process.env.NEXT_PUBLIC_CONCEPT_RENDERS_ENABLED === "true";

/** Asks for an AI concept image of the build (Spec 35). Throws ApiRequestError on failure. */
export async function requestConceptRender(request: ConceptRenderRequest, signal?: AbortSignal): Promise<ConceptRenderDto> {
  const res = await fetch(`${API_BASE_URL}/api/ai/concept-render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiRequestError(json.code ?? "UNKNOWN_ERROR", json.message ?? "Something went wrong.", json.details);
  return json.data as ConceptRenderDto;
}

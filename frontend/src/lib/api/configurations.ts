import type { SaveConfigurationRequest, SavedConfigurationDto } from "@/types/configuration";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** Carries the backend's {code, message} error envelope — the first place in this
 * codebase that actually surfaces it, rather than collapsing failure to a generic
 * fallback (Spec 10, AC-10 needs a real message). */
export class ApiRequestError extends Error {
  code: string;
  /** Field-specific validation messages (Spec 16) — e.g. { email: ["..."] } for
   * EMAIL_ALREADY_REGISTERED. Undefined for every error that isn't field-specific, in which
   * case getErrorMessage(code) is the form-level fallback. */
  details?: Record<string, string[]>;

  constructor(code: string, message: string, details?: Record<string, string[]>) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.details = details;
  }
}

/** Saves a configuration. Deliberately does NOT collapse failure to a fallback value like
 * fetchConfiguration below — a failed save must surface a real error (AC-10). */
export async function saveConfiguration(payload: SaveConfigurationRequest): Promise<SavedConfigurationDto> {
  const res = await fetch(`${API_BASE_URL}/api/configurations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(json.code ?? "UNKNOWN_ERROR", json.message ?? "Something went wrong while saving.");
  }
  return json.data as SavedConfigurationDto;
}

/** Fetches a saved configuration by its publicId. Returns null on any failure (unknown
 * id, network error) — same "collapse to a fallback" convention as this app's other
 * server-side fetch helpers, since a failed lookup here just means "no saved build." Used
 * both server-side (page.tsx hydration) and client-side (SaveSharePanel), so this module
 * intentionally has no "use client" directive — plain fetch works in both. */
export async function fetchConfiguration(publicId: string): Promise<SavedConfigurationDto | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/configurations/${publicId}`, { cache: "no-store" });
    if (!res.ok) return null;
    const { data } = (await res.json()) as { data: SavedConfigurationDto };
    return data;
  } catch {
    return null;
  }
}

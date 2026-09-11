import type { CreateLeadRequest, LeadDto } from "@/types/leads";
import { ApiRequestError } from "./configurations";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** credentials:"include" so optionalAuth can attribute the lead to a signed-in user
 * server-side (Spec 19, AC-4) — the same requirement Spec 17's saveConfiguration fix
 * needed for the analogous optionalAuth-driven behavior. */
export async function createLead(request: CreateLeadRequest): Promise<LeadDto> {
  const res = await fetch(`${API_BASE_URL}/api/leads`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(json.code ?? "UNKNOWN_ERROR", json.message ?? "Something went wrong.", json.details);
  }
  return json.data as LeadDto;
}

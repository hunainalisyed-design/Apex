import type { AiConfigureRequest, AiConfigureResponseDto } from "@/types/ai";
import { ApiRequestError } from "./configurations";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** Calls CarAI (Spec 14). Deliberately does NOT collapse failure to a fallback value like
 * fetchConfiguration does — a failed request must surface a real error so the chat can show
 * an inline error bubble (Spec 15, AC-8), reusing the same ApiRequestError class
 * configurationStore's own save() action already throws. */
export async function sendAiConfigureMessage(request: AiConfigureRequest): Promise<AiConfigureResponseDto> {
  const res = await fetch(`${API_BASE_URL}/api/ai/configure`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });

  const json = await res.json();
  if (!res.ok) {
    throw new ApiRequestError(json.code ?? "UNKNOWN_ERROR", json.message ?? "Something went wrong while asking CarAI.");
  }
  return json.data as AiConfigureResponseDto;
}

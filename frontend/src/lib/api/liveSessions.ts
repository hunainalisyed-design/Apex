import { ApiRequestError } from "./configurations";
import type { CreateLiveSessionRequest, LiveSessionDto } from "@/types/liveSession";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** Whether live sessions are offered at all (Spec 33 Rollout) — mirrors the backend's LIVE_COLLAB_ENABLED. */
export const LIVE_COLLAB_ENABLED = process.env.NEXT_PUBLIC_LIVE_COLLAB_ENABLED !== "false";

/** Starts a live session from the current build (AC-1). */
export async function createLiveSession(request: CreateLiveSessionRequest): Promise<LiveSessionDto> {
  const res = await fetch(`${API_BASE_URL}/api/live-sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiRequestError(json.code ?? "UNKNOWN_ERROR", json.message ?? "Something went wrong.", json.details);
  return json.data as LiveSessionDto;
}

export type LiveSessionLookup =
  | { status: "open"; session: LiveSessionDto }
  | { status: "notFound" }
  | { status: "disabled" }
  | { status: "unavailable" };

/** The join page's server-side check: is this link still a live session, and for which car? */
export async function getLiveSession(sessionId: string): Promise<LiveSessionLookup> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/live-sessions/${encodeURIComponent(sessionId)}`, { cache: "no-store" });
    if (res.status === 404) return { status: "notFound" };
    if (res.status === 503) return { status: "disabled" };
    if (!res.ok) return { status: "unavailable" };
    const { data } = (await res.json()) as { data: LiveSessionDto };
    return { status: "open", session: data };
  } catch {
    return { status: "unavailable" };
  }
}

/** The session's WebSocket URL, on the API's host (ws:// locally, wss:// behind https). */
export function liveSessionSocketUrl(sessionId: string): string {
  return `${API_BASE_URL.replace(/^http/, "ws")}/ws/live-sessions/${encodeURIComponent(sessionId)}`;
}

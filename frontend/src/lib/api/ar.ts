import { ApiRequestError } from "./configurations";
import type { ArModelUploadDto } from "@/types/ar";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/**
 * Hands the exported GLB to the backend for a short-lived public URL (Spec 27, AC-3) —
 * Android's Scene Viewer is a separate app that downloads the model itself, so an in-page
 * blob: URL can't reach it. iOS never calls this (Quick Look opens the blob directly).
 */
export async function uploadArModel(glb: Uint8Array<ArrayBuffer>): Promise<ArModelUploadDto> {
  const res = await fetch(`${API_BASE_URL}/api/ar/models`, {
    method: "POST",
    headers: { "Content-Type": "model/gltf-binary" },
    body: glb,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiRequestError(json.code ?? "UNKNOWN_ERROR", json.message ?? "AR upload failed.");
  }
  return json.data as ArModelUploadDto;
}

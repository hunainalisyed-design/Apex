import { ApiRequestError } from "./configurations";
import type { GalleryPageDto, LikeToggleDto, PublishStatusDto } from "@/types/gallery";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

export type GallerySort = "recent" | "popular";

/** The gallery's image URLs are paths on the API (Spec 31) — prefix them for <img src>. */
export function galleryImageSrc(captureImageUrl: string): string {
  return `${API_BASE_URL}${captureImageUrl}`;
}

async function galleryFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // credentials: "include" — the session cookie makes likedByMe (and liking) work.
  const res = await fetch(`${API_BASE_URL}/api/${path}`, {
    credentials: "include",
    ...init,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new ApiRequestError(json.code ?? "UNKNOWN_ERROR", json.message ?? "Something went wrong.", json.details);
  return json.data as T;
}

export function fetchGallery(sort: GallerySort, page = 1): Promise<GalleryPageDto> {
  return galleryFetch(`gallery?sort=${sort}&page=${page}`, {
    cache: "no-store",
  });
}

export function toggleLike(publicId: string): Promise<LikeToggleDto> {
  return galleryFetch(`gallery/${publicId}/like`, { method: "POST" });
}

/** Publishes the caller's own build with its captured PNG (Spec 11) as the gallery image. */
export function publishBuild(publicId: string, image: Blob): Promise<PublishStatusDto> {
  return galleryFetch(`configurations/${publicId}/publish`, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: image,
  });
}

export function unpublishBuild(publicId: string): Promise<PublishStatusDto> {
  return galleryFetch(`configurations/${publicId}/unpublish`, {
    method: "POST",
  });
}

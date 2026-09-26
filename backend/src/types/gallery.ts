/** One published build in the public gallery (Spec 31). Entirely derived from structured build
 * data plus the build's captured image — no free text, and nothing about the publisher (AC-5). */
export interface GalleryEntryDto {
  publicId: string;
  vehicleSlug: string;
  vehicleName: string;
  /** Path on this API, content-addressed, e.g. /api/gallery/APEX-7F82-K91X/image/1a2b3c4d.png */
  captureImageUrl: string;
  totalPriceCents: number;
  currency: string;
  /** All-time likes. */
  likeCount: number;
  /** Likes in the last 7 days — what "Most Popular This Week" sorts by. */
  weeklyLikeCount: number;
  /** false when signed out. */
  likedByMe: boolean;
  publishedAt: string;
}

export interface GalleryPageDto {
  entries: GalleryEntryDto[];
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** POST /gallery/:publicId/like response — the state after the toggle. */
export interface LikeToggleDto {
  liked: boolean;
  likeCount: number;
}

/** POST /configurations/:publicId/publish | unpublish response. */
export interface PublishStatusDto {
  publicId: string;
  isPublished: boolean;
  publishedAt: string | null;
}

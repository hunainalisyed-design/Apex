/** POST /api/ar/models response (Spec 27) — mirrors backend/src/types/ar.ts. */
export interface ArModelUploadDto {
  /** Absolute, unguessable URL Scene Viewer downloads the GLB from. */
  url: string;
  /** ISO 8601 — after this the URL returns 404. */
  expiresAt: string;
}

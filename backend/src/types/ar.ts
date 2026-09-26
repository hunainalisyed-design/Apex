/** POST /ar/models response (Spec 27) — where Android Scene Viewer can download the GLB. */
export interface ArModelUploadDto {
  /** Absolute, unguessable URL of the uploaded GLB. */
  url: string;
  /** ISO 8601 — after this the URL returns 404 AR_MODEL_NOT_FOUND. */
  expiresAt: string;
}

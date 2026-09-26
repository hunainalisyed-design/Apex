/** A showroom scene preset (Spec 28) — GET /environments. */
export interface EnvironmentDto {
  id: string;
  name: string;
  /** Full-resolution HDRI for desktop. */
  hdriUrl: string;
  /** Lower-resolution HDRI for small screens (may equal hdriUrl). */
  hdriMobileUrl: string;
  thumbnailUrl: string;
  /** true = studio backdrop + reflective floor, HDRI used only for lighting/reflections. */
  isStudio: boolean;
  /** Ground projection for outdoor scenes; null for the studio. */
  groundHeight: number | null;
  groundRadius: number | null;
}

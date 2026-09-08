/** The shareable URL for a saved build (Spec 10 AC-7) — used by SaveSharePanel's "Share"
 * button and the capture-success modal's "Copy Share Link" (Spec 11), so the construction
 * exists in exactly one place. */
export function buildShareUrl(vehicleSlug: string, publicId: string): string {
  return `${window.location.origin}/configure/${vehicleSlug}?build=${publicId}`;
}

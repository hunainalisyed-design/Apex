import type { VehicleSummaryDto } from "@/types/catalog";

export interface ComparePair {
  left: string;
  right: string;
}

/**
 * Resolves the two compared vehicles from ?left=/?right= query params (Spec 18, AC-1/AC-3).
 * Falls back to the first two vehicles in `vehicles`' own order (GET /api/vehicles' existing
 * createdAt-ascending order — Vehicle has no sortOrder column despite the spec's wording,
 * and adding one is out of this spec's declared "no schema changes" scope) whenever a param
 * is missing or names a vehicle not in the active catalog. If both sides would still resolve
 * to the same slug (e.g. an explicit ?left= happens to collide with the other side's
 * fallback default), the whole pair resets to the default rather than patching just one
 * side — simpler and more predictable than trying to pick a third alternative.
 */
export function resolveInitialPair(
  vehicles: VehicleSummaryDto[],
  leftParam: string | undefined,
  rightParam: string | undefined,
): ComparePair {
  const slugs = new Set(vehicles.map((v) => v.slug));
  const defaultLeft = vehicles[0]?.slug ?? "";
  const defaultRight = vehicles[1]?.slug ?? "";

  const left = leftParam && slugs.has(leftParam) ? leftParam : defaultLeft;
  const right = rightParam && slugs.has(rightParam) ? rightParam : defaultRight;

  if (left === right) {
    return { left: defaultLeft, right: defaultRight };
  }
  return { left, right };
}

/** A selector's own option list never offers the vehicle already chosen on the other side
 * (Spec 18, AC-4) — comparing a vehicle to itself is prevented structurally, not just
 * discouraged by validation. */
export function excludeVehicle(vehicles: VehicleSummaryDto[], slugToExclude: string): VehicleSummaryDto[] {
  return vehicles.filter((vehicle) => vehicle.slug !== slugToExclude);
}

/** The shareable comparison URL (Spec 18, AC-3). */
export function buildCompareUrl(left: string, right: string): string {
  return `/compare?left=${encodeURIComponent(left)}&right=${encodeURIComponent(right)}`;
}

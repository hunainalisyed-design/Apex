import type { VehicleDetailDto, VehicleSummaryDto } from "@/types/catalog";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** Fetches the active vehicle list. Collapses any failure (network error, non-2xx) to an
 * empty array rather than throwing — same "collapse to a fallback" convention as
 * fetchConfiguration in lib/api/configurations.ts. Used both server-side (Nav, /models) and
 * potentially client-side, so this module intentionally has no "use client" directive. */
export async function getVehicles(): Promise<VehicleSummaryDto[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/vehicles`, { cache: "no-store" });
    if (!res.ok) return [];
    const { data } = (await res.json()) as { data: VehicleSummaryDto[] };
    return data;
  } catch {
    return [];
  }
}

/** The nav's Configurator link target (Spec 13, AC-1) — the first vehicle from the
 * already isActive-filtered, already-ordered `GET /api/vehicles` list. Null means the
 * list is empty (fetch failure or no active vehicles), which the nav treats as "fall back
 * to /models" rather than a broken link (Spec 13 §5's documented error UI state). */
export async function getDefaultVehicleSlug(): Promise<string | null> {
  const vehicles = await getVehicles();
  return vehicles[0]?.slug ?? null;
}

/** Fetches one vehicle's full detail (all options included) by slug. Promoted from a
 * page-local, non-exported helper that used to live only in configure/[slug]/page.tsx
 * (Spec 17) — the garage list needs the same full detail, per vehicle, to run
 * deriveBuildSummary for each card. Collapses failure to null, same convention as
 * getVehicles above. */
export async function getVehicleDetail(slug: string): Promise<VehicleDetailDto | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/vehicles/${slug}`, { cache: "no-store" });
    if (!res.ok) return null;
    const { data } = (await res.json()) as { data: VehicleDetailDto };
    return data;
  } catch {
    return null;
  }
}

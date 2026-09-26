import type { EnvironmentDto } from "@/types/environments";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** The showroom's environment presets (Spec 28). Collapses failure to an empty list — same
 * convention as getVehicles — and the showroom then simply offers no switcher and renders
 * as it always has: environments are purely cosmetic (§5). */
export async function getEnvironments(): Promise<EnvironmentDto[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/environments`, { cache: "no-store" });
    if (!res.ok) return [];
    const { data } = (await res.json()) as { data: EnvironmentDto[] };
    return data;
  } catch {
    return [];
  }
}

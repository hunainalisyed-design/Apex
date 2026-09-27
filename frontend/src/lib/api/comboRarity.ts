import type { ComboRarityDto } from "@/types/comboRarity";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

/** The vehicle's cached paint + wheels rarity (Spec 32). `buildPublicId` also asks whether
 * that saved build was the first with its pair. Collapses any failure to null — a missing
 * badge is the correct fallback, never an error state (same convention as getVehicleDetail). */
export async function getComboRarity(slug: string, buildPublicId?: string | null): Promise<ComboRarityDto | null> {
  const query = buildPublicId ? `?build=${encodeURIComponent(buildPublicId)}` : "";
  try {
    const res = await fetch(`${API_BASE_URL}/api/vehicles/${encodeURIComponent(slug)}/combo-rarity${query}`);
    if (!res.ok) return null;
    const { data } = (await res.json()) as { data: ComboRarityDto };
    return data;
  } catch {
    return null;
  }
}

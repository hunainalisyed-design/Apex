import { notFound, redirect } from "next/navigation";
import { ConfigureShowroom } from "@/components/showroom/ConfigureShowroom";
import { fetchConfiguration } from "@/lib/api/configurations";
import type { VehicleDetailDto } from "@/types/catalog";
import { BuildNotFoundPanel } from "./BuildNotFoundPanel";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

async function getVehicle(slug: string): Promise<VehicleDetailDto | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/vehicles/${slug}`, { cache: "no-store" });
    if (!res.ok) return null;
    const { data } = (await res.json()) as { data: VehicleDetailDto };
    return data;
  } catch {
    return null;
  }
}

export default async function ConfigurePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ build?: string | string[] }>;
}) {
  const { slug } = await params;
  const { build } = await searchParams;
  const buildId = typeof build === "string" ? build : undefined;

  // Fetch the saved configuration first (only if a ?build= id is present) so the
  // redirect below can happen before ever fetching the vehicle for a stale slug.
  const saved = buildId ? await fetchConfiguration(buildId) : undefined;

  if (buildId && !saved) {
    return <BuildNotFoundPanel slug={slug} />;
  }

  // publicId is the source of truth for which vehicle to show (Spec 10, AC-5) — if the
  // URL's slug doesn't match, redirect to the correct one rather than rendering a
  // mismatched or broken state.
  if (saved && saved.vehicleSlug !== slug) {
    redirect(`/configure/${saved.vehicleSlug}?build=${buildId}`);
  }

  const vehicle = await getVehicle(saved ? saved.vehicleSlug : slug);

  if (!vehicle) {
    notFound();
  }

  return <ConfigureShowroom vehicle={vehicle} savedConfiguration={saved ?? null} />;
}

import { notFound, redirect } from "next/navigation";
import { ConfigureShowroom } from "@/components/showroom/ConfigureShowroom";
import { fetchConfiguration } from "@/lib/api/configurations";
import { getVehicleDetail } from "@/lib/api/vehicles";
import { BuildNotFoundPanel } from "./BuildNotFoundPanel";

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

  const vehicle = await getVehicleDetail(saved ? saved.vehicleSlug : slug);

  if (!vehicle) {
    notFound();
  }

  return <ConfigureShowroom vehicle={vehicle} savedConfiguration={saved ?? null} />;
}

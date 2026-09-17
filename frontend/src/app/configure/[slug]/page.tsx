import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ConfigureShowroom } from "@/components/showroom/ConfigureShowroom";
import { fetchConfiguration } from "@/lib/api/configurations";
import { getVehicleDetail } from "@/lib/api/vehicles";
import { formatPriceCents } from "@/lib/format/currency";
import { SITE_URL } from "@/lib/seo/siteUrl";
import { BuildNotFoundPanel } from "./BuildNotFoundPanel";

type ConfigurePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ build?: string | string[] }>;
};

/** Shared by generateMetadata and the page component so both agree on which build/vehicle
 * a `?build=` id actually resolves to, without fetching it twice differently. */
async function resolveBuild(slug: string, buildId: string | undefined) {
  const saved = buildId ? await fetchConfiguration(buildId) : undefined;
  // publicId is the source of truth for which vehicle to show (Spec 10, AC-5) — a mismatched
  // slug resolves to the saved build's real vehicle everywhere metadata/the page look it up.
  const canonicalSlug = saved?.vehicleSlug ?? slug;
  return { saved, canonicalSlug };
}

function ogImageUrl(slug: string, buildId: string | undefined): string {
  const query = new URLSearchParams({ slug });
  if (buildId) query.set("build", buildId);
  return `/api/og?${query.toString()}`;
}

export async function generateMetadata({ params, searchParams }: ConfigurePageProps): Promise<Metadata> {
  const { slug } = await params;
  const { build } = await searchParams;
  const buildId = typeof build === "string" ? build : undefined;

  const { saved, canonicalSlug } = await resolveBuild(slug, buildId);
  const vehicle = await getVehicleDetail(canonicalSlug);
  if (!vehicle) return { title: "Vehicle not found" };

  const description = saved
    ? `A custom-built ${vehicle.name} — ${formatPriceCents(saved.breakdown.totalPriceCents, vehicle.currency)}. Configure your own.`
    : `Customize the ${vehicle.name} — ${vehicle.tagline} Starting at ${formatPriceCents(vehicle.basePriceCents, vehicle.currency)}.`;
  const image = ogImageUrl(canonicalSlug, buildId);

  return {
    title: vehicle.name,
    description,
    openGraph: { title: vehicle.name, description, images: [{ url: image, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: vehicle.name, description, images: [image] },
  };
}

export default async function ConfigurePage({ params, searchParams }: ConfigurePageProps) {
  const { slug } = await params;
  const { build } = await searchParams;
  const buildId = typeof build === "string" ? build : undefined;

  const { saved, canonicalSlug } = await resolveBuild(slug, buildId);

  if (buildId && !saved) {
    return <BuildNotFoundPanel slug={slug} />;
  }

  if (saved && saved.vehicleSlug !== slug) {
    redirect(`/configure/${saved.vehicleSlug}?build=${buildId}`);
  }

  const vehicle = await getVehicleDetail(canonicalSlug);

  if (!vehicle) {
    notFound();
  }

  // schema.org structured data (Spec 23, AC-4) — `image` points at this vehicle's own OG
  // route rather than its thumbnailUrl: several seeded vehicles' thumbnailUrl paths don't
  // resolve to a real file yet (a pre-existing asset gap, out of scope here), while the OG
  // route always renders successfully for any vehicle.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: vehicle.name,
    description: vehicle.tagline,
    image: `${SITE_URL}${ogImageUrl(canonicalSlug, buildId)}`,
    offers: {
      "@type": "Offer",
      price: (vehicle.basePriceCents / 100).toFixed(2),
      priceCurrency: vehicle.currency,
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ConfigureShowroom vehicle={vehicle} savedConfiguration={saved ?? null} />
    </>
  );
}

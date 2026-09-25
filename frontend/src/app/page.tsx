import { Hero } from "@/components/landing/Hero";
import { FeatureStrip } from "@/components/landing/FeatureStrip";
import { ModelsSection } from "@/components/landing/ModelsSection/ModelsSection";
import { StatsSection } from "@/components/landing/StatsSection";
import { ScrollShowcase } from "@/components/landing/ScrollShowcase/ScrollShowcase";
import type { VehicleSummaryDto } from "@/types/catalog";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const FEATURED_VEHICLE_SLUG = "apex-gt";

const FALLBACK_VEHICLE: VehicleSummaryDto = {
  slug: FEATURED_VEHICLE_SLUG,
  name: "Apex GT",
  tagline: "Performance sports car.",
  basePriceCents: 0,
  currency: "EUR",
  horsepower: 0,
  topSpeedKph: 0,
  zeroToHundredSec: 0,
  thumbnailUrl: "",
  fallbackImageUrl: "",
  heroModelUrl: "",
  showroomModelUrl: "",
};

async function getFeaturedVehicle(): Promise<VehicleSummaryDto> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/vehicles/${FEATURED_VEHICLE_SLUG}`, {
      cache: "no-store",
    });
    if (!res.ok) return FALLBACK_VEHICLE;

    const { data } = (await res.json()) as { data: VehicleSummaryDto };
    return data;
  } catch {
    return FALLBACK_VEHICLE;
  }
}

export default async function Home() {
  const vehicle = await getFeaturedVehicle();

  return (
    <>
      <Hero vehicle={vehicle} />
      <FeatureStrip />
      <ModelsSection />
      <StatsSection vehicle={vehicle} />
      <ScrollShowcase vehicle={vehicle} />
    </>
  );
}

import { Hero } from "@/components/landing/Hero";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";
const FEATURED_VEHICLE_SLUG = "apex-gt";

const FALLBACK_VEHICLE = { name: "Apex GT", tagline: "Performance sports car." };

async function getFeaturedVehicle() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/vehicles/${FEATURED_VEHICLE_SLUG}`, {
      cache: "no-store",
    });
    if (!res.ok) return FALLBACK_VEHICLE;

    const { data } = (await res.json()) as { data: { name: string; tagline: string } };
    return { name: data.name, tagline: data.tagline };
  } catch {
    return FALLBACK_VEHICLE;
  }
}

export default async function Home() {
  const vehicle = await getFeaturedVehicle();

  return <Hero vehicle={vehicle} />;
}

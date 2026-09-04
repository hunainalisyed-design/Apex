import { notFound } from "next/navigation";
import { ConfigureShowroom } from "@/components/showroom/ConfigureShowroom";
import type { VehicleDetailDto } from "@/types/catalog";

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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const vehicle = await getVehicle(slug);

  if (!vehicle) {
    notFound();
  }

  return <ConfigureShowroom vehicle={vehicle} />;
}

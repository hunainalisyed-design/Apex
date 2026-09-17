import type { MetadataRoute } from "next";
import { getVehicles } from "@/lib/api/vehicles";
import { SITE_URL } from "@/lib/seo/siteUrl";

const STATIC_ROUTES = ["/", "/models", "/compare", "/about"];

/**
 * Spec 23, AC-3: only genuinely public, indexable routes — static marketing pages plus every
 * active vehicle's configurator in its default state (`/configure/{slug}`, no `?build=`).
 * User-specific saved-build URLs, /garage, /admin, auth pages, and reservation confirmations
 * are deliberately excluded (see robots.ts for the matching disallow rules).
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const vehicles = await getVehicles();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly",
    priority: path === "/" ? 1 : 0.8,
  }));

  const vehicleEntries: MetadataRoute.Sitemap = vehicles.map((vehicle) => ({
    url: `${SITE_URL}/configure/${vehicle.slug}`,
    changeFrequency: "weekly",
    priority: 0.9,
  }));

  return [...staticEntries, ...vehicleEntries];
}

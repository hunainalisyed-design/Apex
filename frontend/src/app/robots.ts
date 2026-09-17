import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/siteUrl";

/** Spec 23, AC-3 — the mirror image of sitemap.ts's inclusion list: everything user-specific
 * or access-gated is disallowed rather than simply left off the sitemap, since a crawler can
 * still reach a route by link even if it's not listed. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/garage", "/reservations", "/login", "/signup", "/forgot-password", "/reset-password"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

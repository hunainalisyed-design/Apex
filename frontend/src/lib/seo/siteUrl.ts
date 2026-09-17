/** The canonical public origin (Spec 23) — used for `metadataBase`, `sitemap.xml`/`robots.txt`
 * absolute URLs, and the OG image route. Same "blank in local dev, real value at deploy time"
 * convention as this project's other environment-dependent config (NEXT_PUBLIC_API_BASE_URL). */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { fetchConfiguration } from "@/lib/api/configurations";
import { getVehicleDetail } from "@/lib/api/vehicles";
import { deriveOgImageContent, type OgImageContent } from "@/lib/seo/ogImageContent";

/**
 * Dynamic per-build Open Graph image (Spec 23, AC-2), invoked directly from
 * /configure/[slug]'s generateMetadata rather than via Next's opengraph-image.tsx file
 * convention — that convention only receives a route's `params`, not its query string, and
 * the shared-build URL shape (`/configure/{slug}?build={publicId}`, Spec 10) is fixed as a
 * query param. A plain Route Handler using the same next/og ImageResponse API is functionally
 * equivalent and lets `build` be read from the query string directly.
 */
export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 };

const FALLBACK_CONTENT: OgImageContent = {
  vehicleName: "APEX",
  tagline: "A cinematic 3D vehicle configurator.",
  priceLabel: "",
  lines: [],
};

function renderCard(content: OgImageContent) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        background: "linear-gradient(135deg, #0a0a0c 0%, #1a1a1f 100%)",
        padding: 72,
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 28, letterSpacing: 8, opacity: 0.6 }}>APEX</div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center", gap: 14 }}>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700 }}>{content.vehicleName}</div>
        <div style={{ display: "flex", fontSize: 28, opacity: 0.7 }}>{content.tagline}</div>
        {content.lines.map((line) => (
          <div key={line} style={{ display: "flex", fontSize: 24, opacity: 0.85 }}>
            {line}
          </div>
        ))}
      </div>
      {content.priceLabel ? (
        <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>{content.priceLabel}</div>
      ) : null}
    </div>
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const slug = searchParams.get("slug");
  const buildId = searchParams.get("build");

  // Never 500 for a crawler over a bad/missing slug (this spec's own Rollout note) — an
  // unbranded-but-valid fallback image beats a broken link preview.
  const vehicle = slug ? await getVehicleDetail(slug) : null;
  const saved = vehicle && buildId ? await fetchConfiguration(buildId) : null;
  const content = vehicle ? deriveOgImageContent(vehicle, saved) : FALLBACK_CONTENT;

  return new ImageResponse(renderCard(content), {
    ...SIZE,
    headers: {
      // Cached at the edge/CDN per-URL (same publicId always renders the same image) per
      // this spec's own Risk #2, without needing to hand-roll a per-publicId cache ourselves.
      "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    },
  });
}

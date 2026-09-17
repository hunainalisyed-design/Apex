import { ImageResponse } from "next/og";

/**
 * Site-wide default Open Graph image (Spec 23, AC-1) — Next's file convention picks this up
 * automatically for every route that doesn't define its own (e.g. /, /models, /compare,
 * /about). /configure/[slug] overrides it with a per-vehicle/per-build image via its own
 * generateMetadata (see src/app/api/og/route.tsx) since this file convention can't see that
 * route's `?build=` query string — only its own route's params.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function DefaultOpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0a0c 0%, #1a1a1f 100%)",
          padding: 80,
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 32, letterSpacing: 10, opacity: 0.6 }}>APEX</div>
        <div style={{ display: "flex", fontSize: 72, fontWeight: 700, marginTop: 24 }}>
          Virtual Car Configurator
        </div>
        <div style={{ display: "flex", fontSize: 30, opacity: 0.7, marginTop: 20, maxWidth: 900 }}>
          Customize, price, and share your build in real time.
        </div>
      </div>
    ),
    size,
  );
}

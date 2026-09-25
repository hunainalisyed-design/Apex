import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Spec 26, AC-2: finds src/i18n/request.ts by convention (no locale routing/middleware).
const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // React 18/19 StrictMode's dev-only double-invoke of effects mounts every component
  // twice in quick succession — including the @react-three/fiber <Canvas> in
  // ShowroomScene.tsx, which owns an imperative WebGLRenderer/WebGL context lifecycle
  // StrictMode's double-mount isn't reliably safe for. This was invisible with the
  // lightweight procedural PlaceholderShowroomRig, but reproduced a real, consistent
  // "Context Lost" GPU crash once PorscheShowroomRig (Spec-less GLB integration) mounted a
  // real, heavier GLB there — confirmed by testing every other variable first (model file
  // size/texture resolution/geometry simplification ratio, Canvas antialias/dpr/
  // preserveDrawingBuffer, autoRotate) with no effect, then isolating StrictMode itself:
  // disabling it here made the crash disappear outright. Dev-only — production builds never
  // double-invoke effects, so this has no effect on deployed behavior.
  reactStrictMode: false,

  // Spec 25, AC-3: public/ files default to `max-age=0` (Next can't know they won't change),
  // but a content-addressed asset (`name.<8 hex>.glb`) never changes in place — a new version
  // always gets a new URL — so it's safe to cache for a year and mark immutable. Unversioned
  // files (anything not matching this pattern) keep Next's default. Lowercase-only on purpose —
  // it must agree with backend/src/services/assets/versioning.ts's isVersionedAssetUrl. Assumes
  // at least one directory level (every asset lives under /assets/ or /models/).
  async headers() {
    return [
      {
        source: "/:path*/:file([^/]+\\.[0-9a-f]{8}\\.(?:glb|gltf|jpg|jpeg|png|webp|avif))",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

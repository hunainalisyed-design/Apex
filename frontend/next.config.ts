import type { NextConfig } from "next";

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
};

export default nextConfig;

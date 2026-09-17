/** Feature-detects real WebGL support (Spec 12) — extracted from Canvas3DErrorBoundary so
 * Spec 18's CompareSceneErrorBoundary can share the exact same check rather than
 * duplicating it. */
export function isWebGLAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
  } catch {
    return false;
  }
}

/**
 * Reads the GPU/renderer string behind a WebGL context (Spec 22, AC-3) — e.g. "ANGLE
 * (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)". Attached to every 3D
 * error report sent to Sentry from Canvas3DErrorBoundary/CompareSceneErrorBoundary, since
 * SRS §34.2 specifically calls out "hard-to-reproduce WebGL/3D bugs" as the reason this
 * project needs error monitoring at all — the exact GPU/driver combination is usually the
 * only thing that distinguishes a report that reproduces from one that never will.
 * `WEBGL_debug_renderer_info` is unmasked-vendor/renderer only; it carries no personal data,
 * so there's nothing here for AC-3's "no request bodies" scrubbing rule to apply to.
 */
export function getWebGLRendererInfo(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl2") ??
      canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | WebGL2RenderingContext | null;
    if (!gl) return "unavailable";

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return "unknown (WEBGL_debug_renderer_info unsupported)";

    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) as string;
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) as string;
    return `${vendor} — ${renderer}`;
  } catch {
    return "unavailable";
  }
}

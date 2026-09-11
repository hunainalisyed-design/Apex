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

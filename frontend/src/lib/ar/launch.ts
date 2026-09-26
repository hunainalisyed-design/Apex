/**
 * Hand-off to the OS-native AR viewers (Spec 27, AC-4 — no custom AR UI is built here).
 * Both viewers are told not to allow resizing, so the car stays at the real-world size the
 * export gave it.
 */

/**
 * Opens iOS AR Quick Look on a USDZ blob URL. Quick Look is triggered by clicking an
 * `<a rel="ar">` whose first child is an `<img>` — that exact structure is what Safari
 * looks for; without the image it just downloads the file.
 */
export function openQuickLook(usdzUrl: string): void {
  const anchor = document.createElement("a");
  anchor.rel = "ar";
  anchor.href = `${usdzUrl}#allowsContentScaling=0`;
  anchor.appendChild(document.createElement("img"));
  document.body.appendChild(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
  }
}

/**
 * The `intent://` link that opens Google Scene Viewer in AR-only mode on `glbUrl` (a public
 * HTTPS URL — Scene Viewer downloads it itself). If ARCore isn't installed, Android follows
 * `S.browser_fallback_url` back to the current page instead of a dead end.
 */
export function buildSceneViewerIntent(glbUrl: string, title: string, fallbackUrl: string): string {
  const params = new URLSearchParams({ file: glbUrl, mode: "ar_only", resizable: "false", title });
  return (
    `intent://arvr.google.com/scene-viewer/1.2?${params.toString()}` +
    "#Intent;scheme=https;package=com.google.ar.core;action=android.intent.action.VIEW;" +
    `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end;`
  );
}

export function openSceneViewer(glbUrl: string, title: string): void {
  window.location.href = buildSceneViewerIntent(glbUrl, title, window.location.href);
}

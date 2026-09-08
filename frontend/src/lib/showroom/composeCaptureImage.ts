import { formatPriceCents } from "@/lib/format/currency";
import type { BuildSummary, BuildSummaryLine } from "@/lib/showroom/buildSummary";

const CAPTURE_WIDTH = 1600;
const CAPTURE_HEIGHT = 900; // 16:9 — matches the showroom's own aspect-video framing

export interface CaptureOverlayLine {
  label: string;
  value: string;
}

export interface CaptureOverlayLayout {
  vehicleName: string;
  lines: CaptureOverlayLine[];
  totalPriceLabel: string;
  publicId: string;
}

/** Up to three notable lines for the captured image (AC-4), preferring alwaysShown (always
 * exactly 3 today) then any non-default conditionalLines — pure, no DOM/canvas involved. */
export function selectOverlayLines(summary: BuildSummary): BuildSummaryLine[] {
  return [...summary.alwaysShown, ...summary.conditionalLines].slice(0, 3);
}

/** `{vehicleSlug}-{publicId}.png` (AC-5) — pure. */
export function buildCaptureFilename(vehicleSlug: string, publicId: string): string {
  return `${vehicleSlug}-${publicId}.png`;
}

/** Computes what text the overlay shows, fully pure (no DOM/canvas) so it's unit-testable
 * without jsdom's absent 2D canvas support — the imperative drawing in composeCaptureImage
 * below just renders whatever this returns. */
export function buildOverlayLayout(params: {
  vehicleName: string;
  lines: BuildSummaryLine[];
  totalPriceCents: number;
  currency: string;
  publicId: string;
}): CaptureOverlayLayout {
  return {
    vehicleName: params.vehicleName,
    lines: params.lines.map((line) => ({ label: line.label, value: line.optionName })),
    totalPriceLabel: formatPriceCents(params.totalPriceCents, params.currency),
    publicId: params.publicId,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load the captured frame for compositing."));
    img.src = src;
  });
}

/** Draws `img` into the full canvas, cropping (not stretching) to fill — "cover" fit. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, width: number, height: number) {
  const imgRatio = img.width / img.height;
  const targetRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let offsetX = 0;
  let offsetY = 0;

  if (imgRatio > targetRatio) {
    drawHeight = height;
    drawWidth = height * imgRatio;
    offsetX = (width - drawWidth) / 2;
  } else {
    drawWidth = width;
    drawHeight = width / imgRatio;
    offsetY = (height - drawHeight) / 2;
  }

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to export the composited image."));
    }, "image/png");
  });
}

/**
 * The imperative half (AC-4): draws the captured 3D frame into a fixed 16:9 canvas, then
 * overlays a dark scrim + the vehicle name/summary lines/price/publicId in the product's
 * glassmorphism style. Not unit-tested in detail — jsdom has no real 2D canvas rendering
 * and this project has no `canvas` npm package installed — verified via e2e and manual
 * screenshot review instead, matching this spec's own "not covered, deliberately:
 * pixel-perfect visual QA" carve-out.
 */
export async function composeCaptureImage(params: {
  frameDataUrl: string;
  layout: CaptureOverlayLayout;
}): Promise<Blob> {
  const frame = await loadImage(params.frameDataUrl);

  const canvas = document.createElement("canvas");
  canvas.width = CAPTURE_WIDTH;
  canvas.height = CAPTURE_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to acquire a 2D canvas context for image composition.");
  }

  // The captured WebGL frame has a transparent background (the showroom's own "black" is
  // the page's dark theme showing through the canvas, not an opaque pixel) — fill an
  // opaque dark backdrop first so transparent regions composite correctly instead of
  // showing through to whatever background the eventual PNG viewer defaults to.
  ctx.fillStyle = "#0a0a0c";
  ctx.fillRect(0, 0, CAPTURE_WIDTH, CAPTURE_HEIGHT);

  drawCover(ctx, frame, CAPTURE_WIDTH, CAPTURE_HEIGHT);

  const scrim = ctx.createLinearGradient(0, CAPTURE_HEIGHT * 0.55, 0, CAPTURE_HEIGHT);
  scrim.addColorStop(0, "rgba(10,10,12,0)");
  scrim.addColorStop(1, "rgba(10,10,12,0.88)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, CAPTURE_HEIGHT * 0.55, CAPTURE_WIDTH, CAPTURE_HEIGHT * 0.45);

  const padding = 56;
  const { layout } = params;

  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 44px system-ui, -apple-system, sans-serif";
  ctx.fillText(layout.vehicleName, padding, CAPTURE_HEIGHT - 220);

  ctx.font = "400 22px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  let lineY = CAPTURE_HEIGHT - 170;
  for (const line of layout.lines) {
    ctx.fillText(`${line.label}: ${line.value}`, padding, lineY);
    lineY += 30;
  }

  ctx.textAlign = "right";
  ctx.font = "600 34px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(layout.totalPriceLabel, CAPTURE_WIDTH - padding, CAPTURE_HEIGHT - 170);

  ctx.font = "400 18px ui-monospace, SFMono-Regular, monospace";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(layout.publicId, CAPTURE_WIDTH - padding, CAPTURE_HEIGHT - 56);

  return canvasToBlob(canvas);
}

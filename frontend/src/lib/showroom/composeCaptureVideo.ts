import type { CaptureOverlayLayout } from "./composeCaptureImage";

/** Vertical 9:16 clip, sized for phones (Spec 30, AC-1). */
export const VIDEO_WIDTH = 720;
export const VIDEO_HEIGHT = 1280;
/** One full 360° orbit. */
export const VIDEO_DURATION_MS = 4000;
export const VIDEO_FPS = 30;
/** Title cards (AC-3): the vehicle name opens the clip, the build summary closes it. */
export const INTRO_MS = 800;
export const OUTRO_MS = 1200;

export type Vec3 = [number, number, number];

export interface OrbitPose {
  position: Vec3;
  target: Vec3;
}

export interface OrbitOptions {
  /** Horizontal distance from the car's centre. Wide enough that the whole car fits the
   * narrow portrait frame at every angle. */
  radius: number;
  /** Camera height — a little above the target, for a slightly low, 3/4 "hero" look. */
  height: number;
  /** Point the camera looks at (the car's centre). */
  targetY: number;
  /** Where the orbit starts (radians around Y), so the clip opens on the default 3/4 view. */
  startAngle: number;
}

/** The showroom's default 3/4 camera sits at (4.5, 2, 5.5) — start the orbit there. Radius 12
 * keeps a margin around the widest (side-on) view of the longest car in the 9:16 frame —
 * checked on real renders; 11 left the Porsche's wing almost touching the edge. */
export const DEFAULT_ORBIT: OrbitOptions = { radius: 12, height: 2, targetY: 0.5, startAngle: Math.atan2(4.5, 5.5) };

/**
 * The camera pose at `progress` (0 → 1) through the clip: one full turn at constant speed —
 * a steady showcase orbit, no easing, so the clip's first and last frames line up and it
 * loops cleanly. Pure and deterministic (unit-tested).
 */
export function orbitCameraPose(progress: number, options: OrbitOptions = DEFAULT_ORBIT): OrbitPose {
  const p = Math.min(Math.max(progress, 0), 1);
  const angle = options.startAngle + p * Math.PI * 2;
  return {
    position: [Math.sin(angle) * options.radius, options.height, Math.cos(angle) * options.radius],
    target: [0, options.targetY, 0],
  };
}

export interface RecordingFormat {
  mimeType: string;
  extension: "mp4" | "webm";
}

/** MP4 first — it's what Instagram and TikTok accept — then WebM (Spec 30 decision 1). */
const FORMAT_PREFERENCE: RecordingFormat[] = [
  { mimeType: "video/mp4;codecs=avc1", extension: "mp4" },
  { mimeType: "video/mp4", extension: "mp4" },
  { mimeType: "video/webm;codecs=vp9", extension: "webm" },
  { mimeType: "video/webm;codecs=vp8", extension: "webm" },
  { mimeType: "video/webm", extension: "webm" },
];

/** Why video capture can't run here — reported, then the image fallback runs (AC-2). */
export type UnsupportedReason = "no-media-recorder" | "no-canvas-capture" | "no-supported-format";

/**
 * The best format this browser can record a canvas in, or why it can't (AC-2). Takes its
 * inputs as arguments so every browser combination can be tested without that browser.
 */
export function pickRecordingFormat(env: {
  mediaRecorder: { isTypeSupported(type: string): boolean } | undefined;
  canvasCaptureStream: boolean;
}): RecordingFormat | { unsupported: UnsupportedReason } {
  if (!env.mediaRecorder) return { unsupported: "no-media-recorder" };
  if (!env.canvasCaptureStream) return { unsupported: "no-canvas-capture" };
  const format = FORMAT_PREFERENCE.find((f) => {
    try {
      return env.mediaRecorder!.isTypeSupported(f.mimeType);
    } catch {
      return false;
    }
  });
  return format ?? { unsupported: "no-supported-format" };
}

/** pickRecordingFormat for the current browser. Client-only. */
export function pickCurrentRecordingFormat(): RecordingFormat | { unsupported: UnsupportedReason } {
  const recorder = typeof MediaRecorder === "undefined" ? undefined : MediaRecorder;
  const canvasCaptureStream = typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;
  return pickRecordingFormat({ mediaRecorder: recorder, canvasCaptureStream });
}

/** Total frames in a frame-by-frame clip: the full duration at VIDEO_FPS. */
export const VIDEO_FRAME_COUNT = Math.round((VIDEO_DURATION_MS / 1000) * VIDEO_FPS);

/** H.264 profiles to try with WebCodecs, most capable first (High → Main → Baseline, all
 * level 4.0, enough for 720×1280 at 30 fps). */
export const H264_CODECS = ["avc1.640028", "avc1.4d0028", "avc1.42e028"];

/**
 * How this browser will record the clip:
 * - "frames": WebCodecs — every frame is rendered on purpose and encoded with an exact
 *   timestamp, so the clip is always the full length at full frame rate with correct duration,
 *   however slow the device (it just takes longer). Preferred.
 * - "realtime": MediaRecorder — records whatever the device renders in real time; smooth on a
 *   normal GPU, choppy on a slow one. Used where WebCodecs H.264 isn't available.
 * - unsupported: neither — the image fallback runs (AC-2).
 */
export type VideoStrategy =
  | { kind: "frames"; codec: string; extension: "mp4" }
  | { kind: "realtime"; format: RecordingFormat }
  | { unsupported: UnsupportedReason };

export async function pickVideoStrategy(env: {
  videoEncoder: { isConfigSupported(config: VideoEncoderConfig): Promise<VideoEncoderSupport> } | undefined;
  mediaRecorder: { isTypeSupported(type: string): boolean } | undefined;
  canvasCaptureStream: boolean;
}): Promise<VideoStrategy> {
  if (env.videoEncoder) {
    for (const codec of H264_CODECS) {
      try {
        const support = await env.videoEncoder.isConfigSupported({ codec, width: VIDEO_WIDTH, height: VIDEO_HEIGHT, bitrate: 6_000_000, framerate: VIDEO_FPS });
        if (support.supported) return { kind: "frames", codec, extension: "mp4" };
      } catch {
        // try the next profile
      }
    }
  }
  const realtime = pickRecordingFormat(env);
  return "unsupported" in realtime ? realtime : { kind: "realtime", format: realtime };
}

/** pickVideoStrategy for the current browser. Client-only. */
export function pickCurrentVideoStrategy(): Promise<VideoStrategy> {
  return pickVideoStrategy({
    videoEncoder: typeof VideoEncoder === "undefined" ? undefined : VideoEncoder,
    mediaRecorder: typeof MediaRecorder === "undefined" ? undefined : MediaRecorder,
    canvasCaptureStream: typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype,
  });
}

/**
 * Frame-by-frame clip (the "frames" strategy): for each of VIDEO_FRAME_COUNT frames,
 * `renderFrame` draws frame `index` (at `timeMs` into the clip) into the 720×1280 canvas,
 * which is then encoded as H.264 with its exact timestamp and muxed into an MP4 (metadata at
 * the front, so it plays and uploads everywhere). Yields to the browser between frames so the
 * progress bar keeps updating.
 */
/** Thrown when a capture is cancelled (e.g. the showroom unmounted mid-render). */
function abortError(): DOMException {
  return new DOMException("Video capture was cancelled.", "AbortError");
}

export async function encodeFramesToMp4(params: {
  codec: string;
  signal?: AbortSignal;
  renderFrame: (ctx: CanvasRenderingContext2D, index: number, timeMs: number) => void;
  onProgress?: (fraction: number) => void;
}): Promise<Blob> {
  const { Muxer, ArrayBufferTarget } = await import("mp4-muxer");
  const frame = document.createElement("canvas");
  frame.width = VIDEO_WIDTH;
  frame.height = VIDEO_HEIGHT;
  const ctx = frame.getContext("2d");
  if (!ctx) throw new Error("No 2D context for the video frame.");

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width: VIDEO_WIDTH, height: VIDEO_HEIGHT, frameRate: VIDEO_FPS },
    fastStart: "in-memory",
  });
  let encoderError: unknown = null;
  let encoder: VideoEncoder | null = null;
  const frameDurationUs = 1_000_000 / VIDEO_FPS;
  try {
    // Created inside the try so it's always closed, even if configure() throws.
    encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (error) => {
        encoderError = error;
      },
    });
    encoder.configure({ codec: params.codec, width: VIDEO_WIDTH, height: VIDEO_HEIGHT, bitrate: 6_000_000, framerate: VIDEO_FPS });

    for (let index = 0; index < VIDEO_FRAME_COUNT; index++) {
      if (params.signal?.aborted) throw abortError();
      if (encoderError) throw encoderError;
      params.renderFrame(ctx, index, (index * 1000) / VIDEO_FPS);
      const videoFrame = new VideoFrame(frame, { timestamp: index * frameDurationUs, duration: frameDurationUs });
      encoder.encode(videoFrame, { keyFrame: index % VIDEO_FPS === 0 });
      videoFrame.close();
      params.onProgress?.((index + 1) / VIDEO_FRAME_COUNT);
      // Let the encoder drain and the UI repaint between frames.
      while (encoder.encodeQueueSize > 4) await new Promise((resolve) => setTimeout(resolve, 5));
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await encoder.flush();
    if (encoderError) throw encoderError;
    muxer.finalize();
  } finally {
    if (encoder && encoder.state !== "closed") encoder.close();
  }
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}

/** `{vehicleSlug}-{publicId}.{mp4|webm}` — Spec 11's naming, with the real format's extension (AC-4). */
export function buildVideoFilename(vehicleSlug: string, publicId: string, extension: RecordingFormat["extension"]): string {
  return `${vehicleSlug}-${publicId}.${extension}`;
}

/** 0 → 1 → 0 opacity for a card shown between `from` and `to` ms, with short fades. */
export function cardOpacity(timeMs: number, from: number, to: number, fadeMs = 200): number {
  if (timeMs < from || timeMs > to) return 0;
  return Math.min(1, (timeMs - from) / fadeMs, (to - timeMs) / fadeMs);
}

/** Draws the intro/outro title cards for time `timeMs` into the 720×1280 frame (AC-3) —
 * the same content Spec 11's image carries, laid out for portrait. */
export function drawTitleCards(ctx: CanvasRenderingContext2D, layout: CaptureOverlayLayout, timeMs: number): void {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const padding = 56;

  const intro = cardOpacity(timeMs, 0, INTRO_MS);
  if (intro > 0) {
    ctx.save();
    ctx.globalAlpha = intro;
    const top = ctx.createLinearGradient(0, 0, 0, height * 0.3);
    top.addColorStop(0, "rgba(10,10,12,0.85)");
    top.addColorStop(1, "rgba(10,10,12,0)");
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, width, height * 0.3);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "600 56px system-ui, -apple-system, sans-serif";
    ctx.fillText(layout.vehicleName, width / 2, 180, width - padding * 2);
    ctx.restore();
  }

  const outro = cardOpacity(timeMs, VIDEO_DURATION_MS - OUTRO_MS, VIDEO_DURATION_MS + 1);
  if (outro > 0) {
    ctx.save();
    ctx.globalAlpha = outro;
    const bottom = ctx.createLinearGradient(0, height * 0.55, 0, height);
    bottom.addColorStop(0, "rgba(10,10,12,0)");
    bottom.addColorStop(1, "rgba(10,10,12,0.92)");
    ctx.fillStyle = bottom;
    ctx.fillRect(0, height * 0.55, width, height * 0.45);

    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = "600 48px system-ui, -apple-system, sans-serif";
    ctx.fillText(layout.vehicleName, padding, height - 330, width - padding * 2);
    ctx.font = "400 26px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    let y = height - 270;
    for (const line of layout.lines) {
      ctx.fillText(`${line.label}: ${line.value}`, padding, y, width - padding * 2);
      y += 38;
    }
    ctx.font = "600 44px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText(layout.totalPriceLabel, padding, height - 110);
    ctx.textAlign = "right";
    ctx.font = "400 22px ui-monospace, SFMono-Regular, monospace";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(layout.publicId, width - padding, height - 110);
    ctx.restore();
  }
}

/**
 * Records `durationMs` of video (AC-1): every animation frame, the rendered 3D frame is
 * copied into a 720×1280 canvas and `drawOverlay` adds the title cards; that canvas is what
 * MediaRecorder records. The WebGL canvas keeps its drawing buffer (Spec 11), so copying it
 * outside the render loop is safe.
 */
export function recordCanvasClip(params: {
  source: HTMLCanvasElement;
  format: RecordingFormat;
  signal?: AbortSignal;
  durationMs?: number;
  drawOverlay: (ctx: CanvasRenderingContext2D, timeMs: number) => void;
  onProgress?: (fraction: number) => void;
}): Promise<Blob> {
  const durationMs = params.durationMs ?? VIDEO_DURATION_MS;
  const frame = document.createElement("canvas");
  frame.width = VIDEO_WIDTH;
  frame.height = VIDEO_HEIGHT;
  const ctx = frame.getContext("2d");
  if (!ctx) return Promise.reject(new Error("No 2D context for the video frame."));

  return new Promise<Blob>((resolve, reject) => {
    const stream = frame.captureStream(VIDEO_FPS);
    const recorder = new MediaRecorder(stream, { mimeType: params.format.mimeType, videoBitsPerSecond: 6_000_000 });
    const chunks: Blob[] = [];
    let raf = 0;
    const start = performance.now();

    const drawFrame = () => {
      if (params.signal?.aborted) {
        stream.getTracks().forEach((track) => track.stop());
        if (recorder.state === "recording") recorder.stop();
        reject(abortError());
        return;
      }
      const t = performance.now() - start;
      ctx.fillStyle = "#0a0a0c";
      ctx.fillRect(0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      ctx.drawImage(params.source, 0, 0, VIDEO_WIDTH, VIDEO_HEIGHT);
      params.drawOverlay(ctx, t);
      params.onProgress?.(Math.min(t / durationMs, 1));
      if (t < durationMs) raf = requestAnimationFrame(drawFrame);
      else if (recorder.state === "recording") recorder.stop();
    };

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = (event) => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((track) => track.stop());
      reject((event as unknown as { error?: Error }).error ?? new Error("Recording failed."));
    };
    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: params.format.mimeType.split(";")[0] });
      if (blob.size === 0) reject(new Error("Recording produced an empty file."));
      else resolve(blob);
    };

    drawFrame();
    recorder.start(250);
  });
}

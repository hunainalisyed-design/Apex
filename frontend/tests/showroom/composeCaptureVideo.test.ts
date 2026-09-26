import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORBIT,
  INTRO_MS,
  OUTRO_MS,
  VIDEO_DURATION_MS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  buildVideoFilename,
  cardOpacity,
  orbitCameraPose,
  H264_CODECS,
  VIDEO_FRAME_COUNT,
  pickRecordingFormat,
  pickVideoStrategy,
} from "../../src/lib/showroom/composeCaptureVideo";

describe("orbitCameraPose — the scripted 360° orbit (Spec 30, AC-1)", () => {
  it("is deterministic", () => {
    expect(orbitCameraPose(0.37)).toEqual(orbitCameraPose(0.37));
  });

  it("starts on the showroom's default 3/4 view and ends exactly where it started, so the clip loops", () => {
    const start = orbitCameraPose(0);
    const end = orbitCameraPose(1);
    const [x, , z] = start.position;
    expect(Math.atan2(x, z)).toBeCloseTo(Math.atan2(4.5, 5.5), 10);
    end.position.forEach((value, i) => expect(value).toBeCloseTo(start.position[i], 10));
  });

  it("makes one full turn at constant speed, at a constant distance and height, always looking at the car", () => {
    const samples = Array.from({ length: 9 }, (_, i) => orbitCameraPose(i / 8));
    const angles = samples.map(({ position: [x, , z] }) => Math.atan2(x, z));
    for (let i = 1; i < samples.length; i++) {
      const step = (angles[i] - angles[i - 1] + Math.PI * 2) % (Math.PI * 2);
      expect(step).toBeCloseTo(Math.PI / 4, 10); // 45° per eighth
    }
    for (const { position: [x, y, z], target } of samples) {
      expect(Math.hypot(x, z)).toBeCloseTo(DEFAULT_ORBIT.radius, 10);
      expect(y).toBe(DEFAULT_ORBIT.height);
      expect(target).toEqual([0, DEFAULT_ORBIT.targetY, 0]);
    }
  });

  it("clamps progress outside 0–1 instead of over-rotating", () => {
    expect(orbitCameraPose(-0.5)).toEqual(orbitCameraPose(0));
    expect(orbitCameraPose(1.5)).toEqual(orbitCameraPose(1));
  });

  it("is a vertical 9:16 clip of 3–5 seconds", () => {
    expect(VIDEO_WIDTH / VIDEO_HEIGHT).toBeCloseTo(9 / 16, 10);
    expect(VIDEO_DURATION_MS).toBeGreaterThanOrEqual(3000);
    expect(VIDEO_DURATION_MS).toBeLessThanOrEqual(5000);
  });
});

describe("pickRecordingFormat (AC-1, AC-2)", () => {
  const recorderSupporting = (...types: string[]) => ({ isTypeSupported: (t: string) => types.includes(t) });

  it("prefers MP4 — what Instagram and TikTok accept", () => {
    expect(pickRecordingFormat({ mediaRecorder: recorderSupporting("video/webm;codecs=vp9", "video/mp4;codecs=avc1"), canvasCaptureStream: true })).toEqual({
      mimeType: "video/mp4;codecs=avc1",
      extension: "mp4",
    });
  });

  it("falls back to WebM where MP4 isn't available", () => {
    expect(pickRecordingFormat({ mediaRecorder: recorderSupporting("video/webm;codecs=vp8"), canvasCaptureStream: true })).toEqual({
      mimeType: "video/webm;codecs=vp8",
      extension: "webm",
    });
  });

  it.each([
    [{ mediaRecorder: undefined, canvasCaptureStream: true }, "no-media-recorder"],
    [{ mediaRecorder: recorderSupporting("video/webm"), canvasCaptureStream: false }, "no-canvas-capture"],
    [{ mediaRecorder: recorderSupporting(), canvasCaptureStream: true }, "no-supported-format"],
  ])("reports why video can't be recorded (%#)", (env, reason) => {
    expect(pickRecordingFormat(env)).toEqual({ unsupported: reason });
  });

  it("treats a browser whose support check throws as not supporting that format", () => {
    const throwing = { isTypeSupported: () => { throw new Error("nope"); } };
    expect(pickRecordingFormat({ mediaRecorder: throwing, canvasCaptureStream: true })).toEqual({ unsupported: "no-supported-format" });
  });
});

describe("buildVideoFilename (AC-4)", () => {
  it("names the clip like Spec 11's image, with the real format's extension", () => {
    expect(buildVideoFilename("porsche-992-gt3-r", "PORS-7F82-K91X", "mp4")).toBe("porsche-992-gt3-r-PORS-7F82-K91X.mp4");
    expect(buildVideoFilename("apex-gt", "APEX-AAAA-BBBB", "webm")).toBe("apex-gt-APEX-AAAA-BBBB.webm");
  });
});

describe("title card timing (AC-3)", () => {
  it("shows the intro at the start and the outro at the end, with short fades", () => {
    expect(cardOpacity(0, 0, INTRO_MS)).toBe(0);
    expect(cardOpacity(INTRO_MS / 2, 0, INTRO_MS)).toBe(1);
    expect(cardOpacity(INTRO_MS + 1, 0, INTRO_MS)).toBe(0);

    const outroStart = VIDEO_DURATION_MS - OUTRO_MS;
    expect(cardOpacity(outroStart - 1, outroStart, VIDEO_DURATION_MS)).toBe(0);
    expect(cardOpacity(outroStart + 100, outroStart, VIDEO_DURATION_MS)).toBeCloseTo(0.5, 10);
    expect(cardOpacity(VIDEO_DURATION_MS - 500, outroStart, VIDEO_DURATION_MS)).toBe(1);
  });

  it("never overlaps the two cards", () => {
    expect(INTRO_MS).toBeLessThan(VIDEO_DURATION_MS - OUTRO_MS);
  });
});

describe("pickVideoStrategy — frame-by-frame first, then real-time, then image (AC-1, AC-2)", () => {
  const encoderSupporting = (...codecs: string[]) => ({
    isConfigSupported: async (config: VideoEncoderConfig) => ({ supported: codecs.includes(config.codec), config }),
  });
  const recorder = { isTypeSupported: (t: string) => t === "video/webm;codecs=vp9" };

  it("prefers WebCodecs H.264 (always a complete, full-frame-rate clip), best profile first", async () => {
    expect(
      await pickVideoStrategy({ videoEncoder: encoderSupporting("avc1.4d0028", "avc1.42e028"), mediaRecorder: recorder, canvasCaptureStream: true }),
    ).toEqual({ kind: "frames", codec: "avc1.4d0028", extension: "mp4" });
  });

  it("asks for a 720×1280, 30 fps H.264 encoder", async () => {
    const seen: VideoEncoderConfig[] = [];
    await pickVideoStrategy({
      videoEncoder: { isConfigSupported: async (config) => (seen.push(config), { supported: true, config }) },
      mediaRecorder: undefined,
      canvasCaptureStream: false,
    });
    expect(seen[0]).toMatchObject({ codec: H264_CODECS[0], width: 720, height: 1280, framerate: 30 });
  });

  it("falls back to real-time MediaRecorder where WebCodecs has no H.264", async () => {
    expect(await pickVideoStrategy({ videoEncoder: encoderSupporting(), mediaRecorder: recorder, canvasCaptureStream: true })).toEqual({
      kind: "realtime",
      format: { mimeType: "video/webm;codecs=vp9", extension: "webm" },
    });
    expect(await pickVideoStrategy({ videoEncoder: undefined, mediaRecorder: recorder, canvasCaptureStream: true })).toMatchObject({ kind: "realtime" });
  });

  it("reports unsupported when neither works, and survives a throwing support check", async () => {
    const throwing = { isConfigSupported: async () => { throw new Error("nope"); } };
    expect(await pickVideoStrategy({ videoEncoder: throwing, mediaRecorder: undefined, canvasCaptureStream: true })).toEqual({
      unsupported: "no-media-recorder",
    });
  });

  it("makes a 4-second clip at 30 fps: 120 frames", () => {
    expect(VIDEO_FRAME_COUNT).toBe(120);
  });
});

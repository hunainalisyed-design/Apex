import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VIDEO_FPS, VIDEO_FRAME_COUNT, encodeFramesToMp4 } from "../../src/lib/showroom/composeCaptureVideo";

// The frame-by-frame encoder (Spec 30), with WebCodecs faked: jsdom has no VideoEncoder,
// VideoFrame or 2D canvas. The real encoder is exercised end-to-end in e2e/shareable-video.spec.ts.
class FakeVideoEncoder {
  static instances: FakeVideoEncoder[] = [];
  static failAtFrame: number | null = null;
  state: "configured" | "closed" = "configured";
  encodeQueueSize = 0;
  encoded: Array<{ timestamp: number; keyFrame: boolean }> = [];
  constructor(private init: { output: (chunk: unknown, meta: unknown) => void; error: (e: unknown) => void }) {
    FakeVideoEncoder.instances.push(this);
  }
  configure() {}
  encode(frame: { timestamp: number }, options: { keyFrame: boolean }) {
    this.encoded.push({ timestamp: frame.timestamp, keyFrame: options.keyFrame });
    if (FakeVideoEncoder.failAtFrame === this.encoded.length) this.init.error(new Error("encoder crashed"));
    this.init.output({ type: options.keyFrame ? "key" : "delta", timestamp: frame.timestamp, byteLength: 1 }, {});
  }
  async flush() {}
  close() {
    this.state = "closed";
  }
}

const closedFrames: number[] = [];
class FakeVideoFrame {
  constructor(_source: unknown, public init: { timestamp: number; duration: number }) {}
  get timestamp() {
    return this.init.timestamp;
  }
  close() {
    closedFrames.push(this.init.timestamp);
  }
}

vi.mock("mp4-muxer", () => ({
  ArrayBufferTarget: class {
    buffer = new ArrayBuffer(8);
  },
  Muxer: class {
    chunks: unknown[] = [];
    target: { buffer: ArrayBuffer };
    constructor(options: { target: { buffer: ArrayBuffer } }) {
      this.target = options.target;
    }
    addVideoChunk(chunk: unknown) {
      this.chunks.push(chunk);
    }
    finalize() {}
  },
}));

describe("encodeFramesToMp4 (Spec 30)", () => {
  beforeEach(() => {
    FakeVideoEncoder.instances = [];
    FakeVideoEncoder.failAtFrame = null;
    closedFrames.length = 0;
    vi.stubGlobal("VideoEncoder", FakeVideoEncoder);
    vi.stubGlobal("VideoFrame", FakeVideoFrame);
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({} as never);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders and encodes every frame with its exact timestamp, a keyframe each second, then closes everything", async () => {
    const rendered: Array<[number, number]> = [];
    const progress: number[] = [];
    const blob = await encodeFramesToMp4({
      codec: "avc1.640028",
      renderFrame: (_ctx, index, timeMs) => rendered.push([index, timeMs]),
      onProgress: (p) => progress.push(p),
    });

    expect(blob.type).toBe("video/mp4");
    expect(rendered).toHaveLength(VIDEO_FRAME_COUNT);
    expect(rendered[30]).toEqual([30, 1000]);
    const encoder = FakeVideoEncoder.instances[0];
    expect(encoder.encoded).toHaveLength(VIDEO_FRAME_COUNT);
    expect(encoder.encoded[1].timestamp).toBeCloseTo(1_000_000 / VIDEO_FPS, 6);
    expect(encoder.encoded.filter((f) => f.keyFrame)).toHaveLength(VIDEO_FRAME_COUNT / VIDEO_FPS);
    expect(closedFrames).toHaveLength(VIDEO_FRAME_COUNT); // no leaked VideoFrames
    expect(encoder.state).toBe("closed");
    expect(progress.at(-1)).toBe(1);
  });

  it("stops and rejects if the encoder reports an error, still closing it", async () => {
    FakeVideoEncoder.failAtFrame = 10;
    await expect(encodeFramesToMp4({ codec: "avc1.640028", renderFrame: () => {} })).rejects.toThrow("encoder crashed");
    const encoder = FakeVideoEncoder.instances[0];
    expect(encoder.encoded.length).toBeLessThan(VIDEO_FRAME_COUNT);
    expect(encoder.state).toBe("closed");
  });

  it("stops with an AbortError when cancelled, still closing the encoder", async () => {
    const abort = new AbortController();
    const promise = encodeFramesToMp4({
      codec: "avc1.640028",
      signal: abort.signal,
      renderFrame: (_ctx, index) => {
        if (index === 5) abort.abort();
      },
    });
    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeVideoEncoder.instances[0].encoded.length).toBeLessThanOrEqual(6);
    expect(FakeVideoEncoder.instances[0].state).toBe("closed");
  });
});

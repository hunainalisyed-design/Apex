import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SOUND_CUES, detectDoorEvent } from "../../src/lib/sound/cues";
import { SoundManager } from "../../src/lib/sound/soundManager";
import {
  SOUND_PREFERENCE_KEY,
  getServerSoundEnabledSnapshot,
  getSoundEnabledSnapshot,
  readSoundEnabled,
  resetSoundPreferenceForTests,
  writeSoundEnabled,
} from "../../src/lib/sound/soundPreference";

/** A minimal Web Audio stand-in that records every sound started, with its buffer and level. */
function createFakeAudio(initialState: AudioContextState = "running") {
  const started: Array<{ buffer: unknown; loop: boolean; gain: number }> = [];
  const context = {
    state: initialState,
    currentTime: 0,
    destination: {},
    resume: vi.fn(async () => {
      context.state = "running";
    }),
    decodeAudioData: vi.fn(async (data: ArrayBuffer) => ({ decodedFrom: new TextDecoder().decode(data) })),
    createGain: () => {
      const gain = {
        value: 1,
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn((v: number) => {
          gain.value = v;
        }),
        cancelScheduledValues: vi.fn(),
      };
      return { gain, connect: (next: unknown) => next };
    },
    createBufferSource: () => {
      const source = {
        buffer: null as unknown,
        loop: false,
        gainNode: null as null | { gain: { value: number } },
        connect(gainNode: { gain: { value: number } }) {
          source.gainNode = gainNode;
          return gainNode;
        },
        start: vi.fn(() => started.push({ buffer: source.buffer, loop: source.loop, gain: source.gainNode!.gain.value })),
        stop: vi.fn(),
      };
      return source;
    },
  };
  const fetch = vi.fn(async (url: string) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer }));
  const target = new EventTarget();
  const manager = new SoundManager({
    createContext: () => context as unknown as AudioContext,
    fetch: fetch as unknown as (url: string) => Promise<Response>,
    target: target as unknown as Window,
  });
  return { manager, context, fetch, target, started };
}

const bufferFor = (id: keyof typeof SOUND_CUES) => ({ decodedFrom: SOUND_CUES[id].url });

describe("SoundManager (Spec 29)", () => {
  beforeEach(() => vi.spyOn(console, "warn").mockImplementation(() => {}));

  it("downloads nothing while sound is off (AC-1)", async () => {
    const { manager, fetch, started } = createFakeAudio();
    manager.play("doorOpen");
    await manager.playWhenReady("engineStart");
    await manager.startAmbience();
    expect(fetch).not.toHaveBeenCalled();
    expect(started).toHaveLength(0);
  });

  it("preloads every cue as soon as sound is turned on, before any trigger (AC-5)", async () => {
    const { manager, fetch } = createFakeAudio();
    await manager.enable();
    expect(fetch.mock.calls.map(([url]) => url).sort()).toEqual(Object.values(SOUND_CUES).map((c) => c.url).sort());
  });

  it("plays each interaction's own cue, at that cue's level (AC-2)", async () => {
    const { manager, started } = createFakeAudio();
    await manager.enable();
    manager.play("doorOpen");
    manager.play("headlightSwitch");
    expect(started).toEqual([
      { buffer: bufferFor("doorOpen"), loop: false, gain: SOUND_CUES.doorOpen.gain },
      { buffer: bufferFor("headlightSwitch"), loop: false, gain: SOUND_CUES.headlightSwitch.gain },
    ]);
  });

  it("plays the engine start once loaded, and loops the ambience only once", async () => {
    const { manager, started } = createFakeAudio();
    void manager.enable();
    await manager.playWhenReady("engineStart");
    await manager.startAmbience();
    await manager.startAmbience();
    expect(started.map((s) => s.buffer)).toEqual([bufferFor("engineStart"), bufferFor("ambience")]);
    expect(started[1].loop).toBe(true);
  });

  it("holds the entry cues until the first click when the browser hasn't allowed audio yet", async () => {
    const { manager, context, target, started } = createFakeAudio("suspended");
    context.resume.mockImplementationOnce(async () => {}); // the page-load attempt is refused
    await manager.enable();
    await manager.playWhenReady("engineStart");
    await manager.startAmbience();
    expect(started).toHaveLength(0);

    target.dispatchEvent(new Event("pointerdown"));
    await vi.waitFor(() => expect(started.map((s) => s.buffer)).toEqual([bufferFor("engineStart"), bufferFor("ambience")]));
  });

  it("turning sound off drops cues still waiting and fades the ambience out", async () => {
    const { manager, context, target, started } = createFakeAudio("suspended");
    context.resume.mockImplementationOnce(async () => {});
    await manager.enable();
    await manager.playWhenReady("engineStart");
    manager.disable();
    target.dispatchEvent(new Event("pointerdown"));
    await new Promise((r) => setTimeout(r, 0));
    expect(started).toHaveLength(0);

    const running = createFakeAudio();
    await running.manager.enable();
    await running.manager.startAmbience();
    running.manager.disable();
    expect(running.manager.isEnabled()).toBe(false);
    running.manager.play("doorClose");
    expect(running.started).toHaveLength(1); // only the ambience that was already playing
  });

  it("a quick off→on while cues are still downloading plays the engine start once, not twice", async () => {
    const { manager, fetch, started } = createFakeAudio();
    let finishDownloads!: () => void;
    const downloadsDone = new Promise<void>((resolve) => (finishDownloads = resolve));
    fetch.mockImplementation(async (url: string) => {
      await downloadsDone;
      return { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer } as never;
    });

    // What useShowroomSound does on "on", then "off" (effect cleanup), then "on" again.
    void manager.enable();
    const first = manager.playWhenReady("engineStart");
    const firstAmbience = manager.startAmbience();
    manager.disable();
    void manager.enable();
    const second = manager.playWhenReady("engineStart");
    const secondAmbience = manager.startAmbience();

    finishDownloads();
    await Promise.all([first, firstAmbience, second, secondAmbience]);
    expect(started.map((s) => s.buffer)).toEqual([bufferFor("engineStart"), bufferFor("ambience")]);
  });

  it("stays silent (but working) if a cue fails to download", async () => {
    const { manager, fetch, started } = createFakeAudio();
    fetch.mockImplementation(async (url: string) =>
      url === SOUND_CUES.doorOpen.url
        ? ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) } as never)
        : { ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer },
    );
    await manager.enable();
    manager.play("doorOpen");
    manager.play("doorClose");
    expect(started.map((s) => s.buffer)).toEqual([bufferFor("doorClose")]);
  });
});

describe("detectDoorEvent", () => {
  it.each([
    [0, 0.1, "open"],
    [0, 1, "open"], // reduced motion: jumps straight open
    [0.4, 0.6, null], // mid-swing
    [1, 0.5, null],
    [0.2, 0, "close"],
    [1, 0, "close"], // reduced motion: jumps straight shut
    [0, 0, null],
  ] as const)("%s → %s is %s", (previous, next, expected) => {
    expect(detectDoorEvent(previous, next)).toBe(expected);
  });
});

describe("sound preference (AC-1, AC-3, AC-4)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    resetSoundPreferenceForTests();
  });
  afterEach(() => vi.restoreAllMocks());

  it("is off by default, and always off during server rendering", () => {
    expect(readSoundEnabled()).toBe(false);
    expect(getSoundEnabledSnapshot()).toBe(false);
    expect(getServerSoundEnabledSnapshot()).toBe(false);
  });

  it("is remembered in localStorage across visits", () => {
    writeSoundEnabled(true);
    expect(window.localStorage.getItem(SOUND_PREFERENCE_KEY)).toBe("true");
    resetSoundPreferenceForTests(); // a fresh page load
    expect(getSoundEnabledSnapshot()).toBe(true);
  });

  it("still works for this page when storage is blocked, and reads as off when unreadable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    writeSoundEnabled(true);
    expect(getSoundEnabledSnapshot()).toBe(true);

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readSoundEnabled()).toBe(false);
  });

  it("is independent of prefers-reduced-motion (AC-4)", () => {
    vi.spyOn(window, "matchMedia").mockImplementation(
      (query: string) => ({ matches: query.includes("reduce"), media: query }) as MediaQueryList,
    );
    expect(getSoundEnabledSnapshot()).toBe(false); // reduced motion doesn't turn sound on…
    writeSoundEnabled(true);
    expect(getSoundEnabledSnapshot()).toBe(true); // …nor keep it from turning on
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
  });
});

import { SOUND_CUES, type OneShotCueId, type SoundCueId } from "./cues";

/** Ambience fades in and out rather than starting or cutting abruptly. */
const AMBIENCE_FADE_IN_S = 1.5;
const AMBIENCE_FADE_OUT_S = 0.5;

export interface SoundManagerDeps {
  createContext: () => AudioContext;
  fetch: (url: string) => Promise<Response>;
  /** Where the "first click/tap/key" listener that unlocks audio is attached. */
  target: Pick<Window, "addEventListener" | "removeEventListener">;
}

/**
 * The showroom's audio (Spec 29), on the Web Audio API: every cue is fetched and decoded into
 * memory as soon as sound is switched on (AC-5 — no fetch on first trigger), and plays
 * instantly and can overlap. Nothing is downloaded while sound is off.
 *
 * Browsers only let audio start after a user gesture. Turning sound on is itself a click, so
 * that path always works; but a returning visitor who left sound on arrives with no gesture
 * yet, so the entry cues (engine start, ambience) wait for their first click, tap or key.
 */
export class SoundManager {
  private context: AudioContext | null = null;
  private readonly buffers = new Map<SoundCueId, AudioBuffer>();
  private loading: Promise<void> | null = null;
  private enabled = false;
  private ambience: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private pending: Array<() => void> = [];
  private unlockListening = false;
  /** Bumped on every disable(): a playWhenReady/startAmbience still waiting on the preload
   * from before a mute is stale and must not fire — otherwise a quick off→on while loading
   * would play the engine start once per "on". */
  private generation = 0;

  constructor(private readonly deps: SoundManagerDeps) {}

  isEnabled(): boolean {
    return this.enabled;
  }

  /** Turns sound on and starts preloading every cue. Call from the toggle's click handler
   * where possible, so the audio context can start right away. */
  enable(): Promise<void> {
    this.enabled = true;
    const context = this.ensureContext();
    if (context.state === "suspended") void context.resume().catch(() => {});
    this.loading ??= this.preload(context);
    return this.loading;
  }

  /** Turns sound off: fades out the ambience and drops anything still waiting to play. */
  disable(): void {
    this.enabled = false;
    this.generation++;
    this.pending = [];
    this.stopAmbience();
  }

  /** Plays a one-shot cue now, if sound is on and the cue is loaded. Called from interaction
   * handlers (themselves user gestures), so a suspended context is resumed on the spot. */
  play(id: OneShotCueId): void {
    const context = this.context;
    const buffer = this.buffers.get(id);
    if (!this.enabled || !context || !buffer) return;
    if (context.state === "suspended") void context.resume().catch(() => {});
    const gain = context.createGain();
    gain.gain.value = SOUND_CUES[id].gain;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain).connect(context.destination);
    source.start();
  }

  /** Plays a cue once it's loaded — and, if the browser hasn't allowed audio yet, on the
   * visitor's first click/tap/key rather than never. */
  async playWhenReady(id: OneShotCueId): Promise<void> {
    const generation = this.generation;
    await this.loading;
    if (generation !== this.generation) return; // muted (and maybe re-enabled) meanwhile
    this.whenAudible(() => this.play(id));
  }

  /** Starts the quiet ambience loop (once), fading in. Same waiting rules as playWhenReady. */
  async startAmbience(): Promise<void> {
    const generation = this.generation;
    await this.loading;
    if (generation !== this.generation) return;
    this.whenAudible(() => {
      const context = this.context;
      const buffer = this.buffers.get("ambience");
      if (!this.enabled || !context || !buffer || this.ambience) return;
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, context.currentTime);
      gain.gain.linearRampToValueAtTime(SOUND_CUES.ambience.gain, context.currentTime + AMBIENCE_FADE_IN_S);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain).connect(context.destination);
      source.start();
      this.ambience = { source, gain };
    });
  }

  stopAmbience(): void {
    const context = this.context;
    const ambience = this.ambience;
    this.ambience = null;
    if (!context || !ambience) return;
    const now = context.currentTime;
    ambience.gain.gain.cancelScheduledValues(now);
    ambience.gain.gain.setValueAtTime(ambience.gain.gain.value, now);
    ambience.gain.gain.linearRampToValueAtTime(0, now + AMBIENCE_FADE_OUT_S);
    ambience.source.stop(now + AMBIENCE_FADE_OUT_S);
  }

  private ensureContext(): AudioContext {
    this.context ??= this.deps.createContext();
    return this.context;
  }

  private async preload(context: AudioContext): Promise<void> {
    await Promise.all(
      (Object.keys(SOUND_CUES) as SoundCueId[]).map(async (id) => {
        try {
          const response = await this.deps.fetch(SOUND_CUES[id].url);
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          this.buffers.set(id, await context.decodeAudioData(await response.arrayBuffer()));
        } catch (error) {
          // Cosmetic feature: a missing cue just stays silent.
          console.warn(`[sound] Couldn't load "${id}".`, error);
        }
      }),
    );
  }

  /** Runs `action` now if audio is running, else on the first user gesture. */
  private whenAudible(action: () => void): void {
    if (!this.enabled || !this.context) return;
    if (this.context.state === "running") {
      action();
      return;
    }
    this.pending.push(action);
    this.listenForUnlock();
  }

  private listenForUnlock(): void {
    if (this.unlockListening) return;
    this.unlockListening = true;
    const unlock = () => {
      this.deps.target.removeEventListener("pointerdown", unlock);
      this.deps.target.removeEventListener("keydown", unlock);
      this.unlockListening = false;
      const context = this.context;
      if (!context) return;
      void context.resume().then(() => {
        const actions = this.pending;
        this.pending = [];
        actions.forEach((action) => action());
      }, () => {});
    };
    this.deps.target.addEventListener("pointerdown", unlock);
    this.deps.target.addEventListener("keydown", unlock);
  }
}

let shared: SoundManager | null = null;

/** The page's one SoundManager (one AudioContext per page is the browser norm). Client-only. */
export function getSoundManager(): SoundManager {
  shared ??= new SoundManager({
    createContext: () => new AudioContext(),
    fetch: (url) => fetch(url),
    target: window,
  });
  return shared;
}

/**
 * The showroom's sound cues (Spec 29). All CC0 — sources in public/audio/CREDITS.md.
 * Files are content-addressed (Spec 25); `gain` sets each cue's level relative to the others,
 * since the files themselves are all peak-normalised to the same -3 dBFS.
 */
export const SOUND_CUES = {
  engineStart: { url: "/audio/engine-start.ead48d27.mp3", gain: 0.55 },
  doorOpen: { url: "/audio/door-open.92e8de4c.mp3", gain: 0.5 },
  doorClose: { url: "/audio/door-close.304d3c17.mp3", gain: 0.6 },
  headlightSwitch: { url: "/audio/headlight-switch.22bb2ed3.mp3", gain: 0.35 },
  brakeClick: { url: "/audio/brake-click.11100a82.mp3", gain: 0.3 },
  /** Looped, and deliberately barely audible — "presence", not a soundtrack. */
  ambience: { url: "/audio/showroom-ambience.0df1988d.mp3", gain: 0.25 },
} as const;

export type SoundCueId = keyof typeof SOUND_CUES;

/** A one-shot cue (everything except the looping ambience). */
export type OneShotCueId = Exclude<SoundCueId, "ambience">;

export type DoorEvent = "open" | "close" | null;

/**
 * Which door sound a change in the rig's door-open amount (0 = shut, 1 = open) calls for:
 * the latch as the door starts to leave the frame, the thud as it arrives shut. Anything in
 * between is the door mid-swing — silent. Works for reduced motion too, where the amount
 * jumps straight from 0 to 1 and back.
 */
export function detectDoorEvent(previous: number, next: number): DoorEvent {
  if (previous === 0 && next > 0) return "open";
  if (previous > 0 && next === 0) return "close";
  return null;
}

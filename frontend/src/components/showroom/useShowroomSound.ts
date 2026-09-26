"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import type { DoorEvent, OneShotCueId } from "@/lib/sound/cues";
import { getSoundManager } from "@/lib/sound/soundManager";
import {
  getServerSoundEnabledSnapshot,
  getSoundEnabledSnapshot,
  subscribeToSoundEnabled,
  writeSoundEnabled,
} from "@/lib/sound/soundPreference";

export interface ShowroomSound {
  enabled: boolean;
  /** The toggle's click handler — a user gesture, so turning sound on can start audio at once. */
  toggle: () => void;
  /** Plays a one-shot cue if sound is on (no-op otherwise). */
  cue: (id: OneShotCueId) => void;
  /** Door latch/thud for the rig's door animation. */
  onDoorEvent: (event: Exclude<DoorEvent, null>) => void;
}

/**
 * The showroom's sound wiring (Spec 29). Off by default (AC-1), remembered per viewer (AC-3),
 * independent of reduced motion (AC-4). Entering the showroom with sound already on — or
 * turning it on here — plays the engine start and brings up the ambience; leaving or muting
 * fades the ambience out.
 */
export function useShowroomSound(): ShowroomSound {
  const enabled = useSyncExternalStore(subscribeToSoundEnabled, getSoundEnabledSnapshot, getServerSoundEnabledSnapshot);

  useEffect(() => {
    if (!enabled) return;
    const manager = getSoundManager();
    void manager.enable();
    void manager.playWhenReady("engineStart");
    void manager.startAmbience();
    return () => manager.disable();
  }, [enabled]);

  const toggle = useCallback(() => {
    const next = !getSoundEnabledSnapshot();
    // Enable inside the click itself — the gesture that lets the browser start audio — rather
    // than waiting for the effect above, which runs after the gesture has ended.
    if (next) void getSoundManager().enable();
    writeSoundEnabled(next);
  }, []);

  const cue = useCallback((id: OneShotCueId) => {
    const manager = getSoundManager();
    if (manager.isEnabled()) manager.play(id);
  }, []);

  const onDoorEvent = useCallback((event: Exclude<DoorEvent, null>) => cue(event === "open" ? "doorOpen" : "doorClose"), [cue]);

  return { enabled, toggle, cue, onDoorEvent };
}

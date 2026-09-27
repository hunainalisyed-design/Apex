"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DriveSession, ShowroomControls } from "../ShowroomScene";

export type DriveState = "idle" | "entering" | "driving" | "leaving";

/** How long the fade to black takes, each way (hides the scene swap and the car's reset). */
export const DRIVE_FADE_MS = 300;
/** If the drive's environment takes longer than this to load, the drive starts anyway (in the current scene). */
export const DRIVE_ENVIRONMENT_TIMEOUT_MS = 10_000;

const LEFT_KEYS = new Set(["ArrowLeft", "a", "A"]);
const RIGHT_KEYS = new Set(["ArrowRight", "d", "D"]);

/** Typing in a field (a CarAI message, a name) must never steer the car. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

export interface UseDriveItOptions {
  controlsRef: React.RefObject<ShowroomControls | null>;
  /** Whether the drive has its own environment to load (false → drive in the current scene). */
  hasDriveEnvironment: boolean;
  /** Where focus goes back to when the drive ends. */
  returnFocusTo: React.RefObject<HTMLElement | null>;
}

export interface UseDriveItResult {
  state: DriveState;
  /** True from the moment Drive It starts until it has fully ended — the showroom locks meanwhile. */
  active: boolean;
  /** Whether the drive's environment should be shown instead of the build's own. */
  useDriveEnvironment: boolean;
  /** The black overlay is covering the scene. */
  faded: boolean;
  progress: number;
  offset: number;
  start: () => void;
  exit: () => void;
  /** Hold-to-steer from the on-screen buttons: -1 left, 1 right, 0 released. */
  setTouchInput: (direction: -1 | 0 | 1) => void;
  onEnvironmentReady: () => void;
  onEnvironmentError: () => void;
}

/**
 * "Drive It" (Spec 37): fade out → swap in the drive's environment (e.g. Coastal Road) → drive
 * the fixed path with a chase camera → fade out → put everything back exactly as it was (the
 * camera, the scene, the build — nothing is changed or saved). Ends by itself when the path
 * completes (AC-4) or at once on Exit/Escape (AC-5). Arrow keys or A/D steer (AC-2), as do the
 * hold-to-steer buttons (AC-7).
 */
export function useDriveIt({ controlsRef, hasDriveEnvironment, returnFocusTo }: UseDriveItOptions): UseDriveItResult {
  const [state, setState] = useState<DriveState>("idle");
  const [faded, setFaded] = useState(false);
  const [useDriveEnvironment, setUseDriveEnvironment] = useState(false);
  const [progress, setProgress] = useState(0);
  const [offset, setOffset] = useState(0);

  const stateRef = useRef<DriveState>("idle");
  const session = useRef<DriveSession | null>(null);
  const input = useRef(0);
  const keys = useRef({ left: false, right: false });
  const touch = useRef<-1 | 0 | 1>(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const waitingForEnvironment = useRef(false);
  const returnFocusPending = useRef(false);

  const setDriveState = useCallback((next: DriveState) => {
    stateRef.current = next;
    setState(next);
  }, []);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const updateInput = useCallback(() => {
    const keyInput = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0);
    input.current = touch.current !== 0 ? touch.current : keyInput;
  }, []);

  const finish = useCallback(() => {
    clearTimers();
    session.current?.stop();
    session.current = null;
    waitingForEnvironment.current = false;
    keys.current = { left: false, right: false };
    touch.current = 0;
    input.current = 0;
    setUseDriveEnvironment(false);
    setProgress(0);
    setOffset(0);
    setDriveState("idle");
    setFaded(false);
    // Focus goes back once the page has re-rendered: the Drive It button is disabled until then.
    returnFocusPending.current = true;
  }, [clearTimers, setDriveState]);

  const exit = useCallback(() => {
    const current = stateRef.current;
    if (current !== "entering" && current !== "driving") return;
    clearTimers();
    setDriveState("leaving");
    setFaded(true);
    later(DRIVE_FADE_MS, finish);
  }, [clearTimers, setDriveState, later, finish]);

  const beginDriving = useCallback(() => {
    if (stateRef.current !== "entering" || !waitingForEnvironment.current) return;
    waitingForEnvironment.current = false;
    clearTimers();
    const controls = controlsRef.current;
    if (!controls) {
      finish();
      return;
    }
    session.current = controls.startDrive({
      input,
      onUpdate: (p, o) => {
        setProgress(p);
        setOffset(o);
      },
      onComplete: exit,
    });
    setDriveState("driving");
    setFaded(false);
  }, [clearTimers, controlsRef, finish, exit, setDriveState]);

  /** The drive's environment failed or is too slow: drive in the build's own (already loaded) scene. */
  const driveInCurrentScene = useCallback(() => {
    if (stateRef.current !== "entering" || !waitingForEnvironment.current) return;
    setUseDriveEnvironment(false);
    beginDriving();
  }, [beginDriving]);

  const start = useCallback(() => {
    if (stateRef.current !== "idle" || !controlsRef.current) return;
    setDriveState("entering");
    setFaded(true);
    later(DRIVE_FADE_MS, () => {
      waitingForEnvironment.current = true;
      if (!hasDriveEnvironment) {
        beginDriving();
        return;
      }
      setUseDriveEnvironment(true); // the scene reports back via onEnvironmentReady / onEnvironmentError
      later(DRIVE_ENVIRONMENT_TIMEOUT_MS, driveInCurrentScene);
    });
  }, [controlsRef, setDriveState, later, hasDriveEnvironment, beginDriving, driveInCurrentScene]);

  const onEnvironmentReady = useCallback(() => beginDriving(), [beginDriving]);
  const onEnvironmentError = driveInCurrentScene;

  const setTouchInput = useCallback(
    (direction: -1 | 0 | 1) => {
      touch.current = direction;
      updateInput();
    },
    [updateInput],
  );

  // Keyboard steering and Escape, only while driving.
  useEffect(() => {
    if (state !== "driving" && state !== "entering") return;
    const onKey = (event: KeyboardEvent, down: boolean) => {
      if (isTypingTarget(event.target)) return;
      if (down && event.key === "Escape") {
        event.preventDefault();
        exit();
        return;
      }
      const left = LEFT_KEYS.has(event.key);
      const right = RIGHT_KEYS.has(event.key);
      if (!left && !right) return;
      event.preventDefault();
      if (left) keys.current.left = down;
      if (right) keys.current.right = down;
      updateInput();
    };
    const onDown = (e: KeyboardEvent) => onKey(e, true);
    const onUp = (e: KeyboardEvent) => onKey(e, false);
    const onBlur = () => {
      keys.current = { left: false, right: false };
      touch.current = 0;
      updateInput();
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [state, exit, updateInput]);

  useEffect(() => {
    if (state !== "idle" || !returnFocusPending.current) return;
    returnFocusPending.current = false;
    returnFocusTo.current?.focus();
  }, [state, returnFocusTo]);

  // Leaving the page mid-drive: stop cleanly.
  useEffect(
    () => () => {
      timers.current.forEach(clearTimeout);
      session.current?.stop();
    },
    [],
  );

  return {
    state,
    active: state !== "idle",
    useDriveEnvironment,
    faded,
    progress,
    offset,
    start,
    exit,
    setTouchInput,
    onEnvironmentReady,
    onEnvironmentError,
  };
}

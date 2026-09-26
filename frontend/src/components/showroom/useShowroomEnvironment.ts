"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import * as Sentry from "@sentry/nextjs";
import {
  DEFAULT_ENVIRONMENT_ID,
  SMALL_SCREEN_MAX_WIDTH,
  environmentSceneSettings,
  resolveEnvironment,
  type EnvironmentSceneSettings,
} from "@/lib/showroom/environment";
import { useConfigurationStore } from "@/state/configurationStore";
import type { EnvironmentDto } from "@/types/environments";
import type { ShowroomControls } from "./ShowroomScene";

/** Crossfade length (Spec 28, AC-3). */
export const ENVIRONMENT_FADE_MS = 600;

/** If a new HDRI never reports ready (e.g. a stalled download), the frozen frame is removed
 * after this long anyway, so the overlay can never get stuck over the live scene. */
const OVERLAY_SAFETY_TIMEOUT_MS = 10_000;

const SMALL_SCREEN_QUERY = `(max-width: ${SMALL_SCREEN_MAX_WIDTH}px)`;

function subscribeToSmallScreen(onChange: () => void) {
  const query = window.matchMedia(SMALL_SCREEN_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const isSmallScreen = () => window.matchMedia(SMALL_SCREEN_QUERY).matches;
const serverIsSmallScreen = () => false;

export interface EnvironmentOverlay {
  /** The frozen frame of the previous environment, shown over the canvas during a switch. */
  src: string;
  /** true once the new environment is ready — the overlay then fades out. */
  fading: boolean;
}

export interface ShowroomEnvironment {
  /** The environment actually shown (after fallback), or null when none are available. */
  selectedId: string | null;
  settings: EnvironmentSceneSettings | null;
  select: (id: string) => void;
  onReady: () => void;
  onError: (error: unknown) => void;
  overlay: EnvironmentOverlay | null;
}

/**
 * The showroom's environment state (Spec 28): which one is chosen (the configuration store,
 * so it's saved with the build — AC-4), which HDRI resolution to load, falling back to Studio
 * if one fails (§5), and the crossfade (AC-3): freeze the current frame over the canvas, swap
 * the environment underneath, fade the frozen frame out once the new one is ready. With
 * reduced motion it just cuts.
 */
export function useShowroomEnvironment(
  environments: EnvironmentDto[],
  controlsRef: RefObject<ShowroomControls | null>,
  reducedMotion: boolean,
): ShowroomEnvironment {
  const storedId = useConfigurationStore((s) => s.environmentId);
  const setEnvironmentId = useConfigurationStore((s) => s.setEnvironmentId);
  const smallScreen = useSyncExternalStore(subscribeToSmallScreen, isSmallScreen, serverIsSmallScreen);
  const [failedIds, setFailedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [overlay, setOverlay] = useState<EnvironmentOverlay | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // A failed environment falls back to Studio for this session; the stored choice is left
  // as-is, so saving doesn't silently rewrite what the user picked.
  const wantedId = storedId !== null && failedIds.has(storedId) ? DEFAULT_ENVIRONMENT_ID : storedId;
  const environment = resolveEnvironment(environments, wantedId);
  const settings = useMemo(
    () => (environment ? environmentSceneSettings(environment, smallScreen) : null),
    [environment, smallScreen],
  );

  const clearOverlay = useCallback(() => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = null;
    setOverlay(null);
  }, []);

  useEffect(() => () => {
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
  }, []);

  const select = useCallback(
    (id: string) => {
      if (id === environment?.id) return;
      const snapshot = reducedMotion ? null : controlsRef.current?.captureFrame();
      if (snapshot) {
        setOverlay({ src: snapshot, fading: false });
        if (fadeTimer.current) clearTimeout(fadeTimer.current);
        fadeTimer.current = setTimeout(clearOverlay, OVERLAY_SAFETY_TIMEOUT_MS);
      }
      setEnvironmentId(id === DEFAULT_ENVIRONMENT_ID ? null : id);
    },
    [environment?.id, reducedMotion, controlsRef, setEnvironmentId, clearOverlay],
  );

  const onReady = useCallback(() => {
    setOverlay((current) => {
      if (!current || current.fading) return current;
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(clearOverlay, ENVIRONMENT_FADE_MS);
      return { ...current, fading: true };
    });
  }, [clearOverlay]);

  const onError = useCallback(
    (error: unknown) => {
      // Purely cosmetic (§5): logged, never surfaced as a user-facing error.
      console.warn("[environments] HDRI failed to load; falling back to Studio.", error);
      Sentry.captureException(error, { tags: { feature: "environments", environmentId: environment?.id ?? "unknown" } });
      if (environment && environment.id !== DEFAULT_ENVIRONMENT_ID) {
        setFailedIds((previous) => new Set(previous).add(environment.id));
      } else {
        clearOverlay();
      }
    },
    [environment, clearOverlay],
  );

  return { selectedId: environment?.id ?? null, settings, select, onReady, onError, overlay };
}

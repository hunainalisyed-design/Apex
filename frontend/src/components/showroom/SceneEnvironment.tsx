"use client";

import { Component, Suspense, useEffect, type ReactNode } from "react";
import { Environment } from "@react-three/drei";
import type { EnvironmentSceneSettings } from "@/lib/showroom/environment";

/** The ground-projected dome's size — larger than `ground.radius` so the projected floor
 * fills the view, and well inside the camera's default far plane (1000). */
const GROUND_DOME_SCALE = 200;

/** Studio uses its HDRI for reflections only; kept dimmer than outdoor scenes so the existing
 * key/fill lights still shape the car the way they always have. */
const STUDIO_ENVIRONMENT_INTENSITY = 0.6;

export interface SceneEnvironmentProps {
  settings: EnvironmentSceneSettings;
  /** Called once this environment's HDRI has loaded and been applied. */
  onReady: () => void;
  /** Called if the HDRI fails to load — the caller falls back to Studio (Spec 28 §5). */
  onError: (error: unknown) => void;
}

/**
 * Applies one environment's HDRI to the scene (Spec 28, AC-2) — lighting and, for outdoor
 * scenes, the ground-projected backdrop, both from the same texture in the same element.
 * Loads behind its own Suspense boundary so the car never waits on an HDRI download, and
 * behind its own error boundary so a failed download never takes the showroom down.
 */
export function SceneEnvironment({ settings, onReady, onError }: SceneEnvironmentProps) {
  return (
    <EnvironmentErrorBoundary key={settings.hdriUrl} onError={onError}>
      <Suspense fallback={null}>
        <LoadedEnvironment settings={settings} onReady={onReady} />
      </Suspense>
    </EnvironmentErrorBoundary>
  );
}

function LoadedEnvironment({ settings, onReady }: { settings: EnvironmentSceneSettings; onReady: () => void }) {
  // Only runs after the HDRI has resolved — Suspense doesn't commit this component before then.
  useEffect(() => {
    onReady();
  }, [settings.hdriUrl, onReady]);

  if (settings.ground) {
    return (
      <Environment
        files={settings.hdriUrl}
        ground={{ height: settings.ground.height, radius: settings.ground.radius, scale: GROUND_DOME_SCALE }}
      />
    );
  }
  return <Environment files={settings.hdriUrl} background={false} environmentIntensity={STUDIO_ENVIRONMENT_INTENSITY} />;
}

class EnvironmentErrorBoundary extends Component<{ children: ReactNode; onError: (error: unknown) => void }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    this.props.onError(error);
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

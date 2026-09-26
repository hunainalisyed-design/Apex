import type { EnvironmentDto } from "@/types/environments";

/** The id used when a build has no environment (null) — the default Studio (Spec 28). */
export const DEFAULT_ENVIRONMENT_ID = "studio";

/** Below this viewport width the lower-resolution HDRI is used (Spec 28 Risk #1): ~1.6 MB
 * instead of ~6.5 MB, and a phone screen can't show the extra detail anyway. */
export const SMALL_SCREEN_MAX_WIDTH = 768;

/**
 * Which environment to show for a stored id: the matching one, else the default Studio,
 * else the first available — a removed or unknown id never leaves the scene without one.
 * null only when the list itself is empty (the API was unreachable).
 */
export function resolveEnvironment(environments: EnvironmentDto[], id: string | null): EnvironmentDto | null {
  return (
    environments.find((e) => e.id === (id ?? DEFAULT_ENVIRONMENT_ID)) ??
    environments.find((e) => e.id === DEFAULT_ENVIRONMENT_ID) ??
    environments[0] ??
    null
  );
}

/** Everything the 3D scene needs to render one environment. */
export interface EnvironmentSceneSettings {
  /** The one HDRI that drives BOTH the backdrop (outdoor) and the image-based lighting. */
  hdriUrl: string;
  /** "studio": gradient backdrop + reflective floor; "ground": the HDRI projected onto the ground. */
  backdrop: "studio" | "ground";
  ground: { height: number; radius: number } | null;
  /** The reflective studio floor only makes sense in the studio. */
  showStudioFloor: boolean;
}

/**
 * Derives backdrop and lighting from the SAME environment and the same HDRI, so the two can
 * never disagree (Spec 28, AC-2): there is no code path that swaps the background while the
 * car keeps reflecting the previous scene.
 */
export function environmentSceneSettings(environment: EnvironmentDto, smallScreen: boolean): EnvironmentSceneSettings {
  const hdriUrl = smallScreen ? environment.hdriMobileUrl : environment.hdriUrl;
  const grounded =
    !environment.isStudio && environment.groundHeight !== null && environment.groundRadius !== null;
  return {
    hdriUrl,
    backdrop: grounded ? "ground" : "studio",
    ground: grounded ? { height: environment.groundHeight!, radius: environment.groundRadius! } : null,
    showStudioFloor: !grounded,
  };
}

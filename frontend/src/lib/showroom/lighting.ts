export interface EmissiveState {
  color: string;
  intensity: number;
}

const HEADLIGHT_COLOR = "#f5f5f0";
const BRAKE_LIGHT_COLOR = "#e0393e";

/** Real emissive-material state for the headlights (AC-9) — never a UI-only indicator. */
export function getHeadlightEmissive(on: boolean): EmissiveState {
  return { color: HEADLIGHT_COLOR, intensity: on ? 2.5 : 0 };
}

/** Real emissive-material state for the brake lights during a momentary pulse (AC-9). */
export function getBrakeLightEmissive(pulsing: boolean): EmissiveState {
  return { color: BRAKE_LIGHT_COLOR, intensity: pulsing ? 4 : 0.15 };
}

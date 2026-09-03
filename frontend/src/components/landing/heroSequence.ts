/**
 * Pure hero reveal-sequence state machine (SRS §3): background fade-in -> vehicle reveal
 * -> camera move-in -> headline reveal -> CTA reveal -> idle rotation. Kept free of React
 * and timers so it's directly unit-testable; `useHeroSequence` wires it to real timing.
 */
export const HERO_STAGE_ORDER = [
  "background",
  "vehicle",
  "camera",
  "headline",
  "cta",
  "idle",
] as const;

export type HeroStage = (typeof HERO_STAGE_ORDER)[number];

export type HeroSequenceAction = { type: "advance" } | { type: "skip" };

export function heroSequenceReducer(stage: HeroStage, action: HeroSequenceAction): HeroStage {
  if (action.type === "skip") {
    return "idle";
  }

  const index = HERO_STAGE_ORDER.indexOf(stage);
  const nextIndex = Math.min(index + 1, HERO_STAGE_ORDER.length - 1);
  return HERO_STAGE_ORDER[nextIndex];
}

export function isStageAtLeast(stage: HeroStage, target: HeroStage): boolean {
  return HERO_STAGE_ORDER.indexOf(stage) >= HERO_STAGE_ORDER.indexOf(target);
}

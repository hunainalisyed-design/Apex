"use client";

import { useEffect, useReducer } from "react";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { HERO_STAGE_ORDER, heroSequenceReducer, type HeroStage } from "./heroSequence";

const STAGE_DURATION_MS = 550;

/**
 * Drives the reveal sequence once on mount. Reduced motion (AC-3) skips straight to the
 * final "idle" state — no staged timers, a single implicit cross-fade via CSS/variants
 * instead of a multi-stage animation.
 */
export function useHeroSequence(): HeroStage {
  const reducedMotion = useReducedMotion();
  const [stage, dispatch] = useReducer(heroSequenceReducer, "background");

  useEffect(() => {
    if (reducedMotion) {
      dispatch({ type: "skip" });
      return;
    }

    let cancelled = false;
    let remaining = HERO_STAGE_ORDER.length - 1;

    const advance = () => {
      if (cancelled || remaining <= 0) return;
      remaining -= 1;
      dispatch({ type: "advance" });
      if (remaining > 0) {
        timeoutId = setTimeout(advance, STAGE_DURATION_MS);
      }
    };

    let timeoutId = setTimeout(advance, STAGE_DURATION_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [reducedMotion]);

  return reducedMotion ? "idle" : stage;
}

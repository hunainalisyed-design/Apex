import { describe, expect, it } from "vitest";
import {
  HERO_STAGE_ORDER,
  heroSequenceReducer,
  isStageAtLeast,
  type HeroStage,
} from "../../src/components/landing/heroSequence";

describe("heroSequenceReducer", () => {
  it("advances through every stage in SRS §3's documented order", () => {
    let stage: HeroStage = "background";
    const seen: HeroStage[] = [stage];

    for (let i = 0; i < HERO_STAGE_ORDER.length - 1; i++) {
      stage = heroSequenceReducer(stage, { type: "advance" });
      seen.push(stage);
    }

    expect(seen).toEqual([...HERO_STAGE_ORDER]);
  });

  it("stays at idle once it reaches the end (AC-1)", () => {
    const stage = heroSequenceReducer("idle", { type: "advance" });
    expect(stage).toBe("idle");
  });

  it("is skippable — jumps straight to idle from any stage", () => {
    for (const stage of HERO_STAGE_ORDER) {
      expect(heroSequenceReducer(stage, { type: "skip" })).toBe("idle");
    }
  });
});

describe("isStageAtLeast", () => {
  it("orders stages correctly", () => {
    expect(isStageAtLeast("headline", "background")).toBe(true);
    expect(isStageAtLeast("background", "headline")).toBe(false);
    expect(isStageAtLeast("idle", "idle")).toBe(true);
  });
});

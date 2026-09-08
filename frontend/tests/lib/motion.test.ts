import { describe, expect, it } from "vitest";
import { withReducedMotion } from "../../src/lib/motion/withReducedMotion";

describe("withReducedMotion", () => {
  it("returns the instant value when reducedMotion is true (AC-5)", () => {
    expect(withReducedMotion(true, 0.9, 0)).toBe(0);
    expect(withReducedMotion(true, "animate", "instant")).toBe("instant");
  });

  it("returns the animate value when reducedMotion is false", () => {
    expect(withReducedMotion(false, 0.9, 0)).toBe(0.9);
    expect(withReducedMotion(false, "animate", "instant")).toBe("animate");
  });
});

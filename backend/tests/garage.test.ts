import { describe, expect, it } from "vitest";
import { decideClaimOutcome } from "../src/services/configurations.js";

describe("decideClaimOutcome (Spec 17, AC-7/AC-8)", () => {
  it("returns \"claim\" for an unowned (guest) build", () => {
    expect(decideClaimOutcome(null, "user-1")).toBe("claim");
  });

  it("returns \"idempotent\" when the caller already owns the build — a self-claim isn't an ownership change", () => {
    expect(decideClaimOutcome("user-1", "user-1")).toBe("idempotent");
  });

  it("returns \"conflict\" when a different user already owns the build (AC-8)", () => {
    expect(decideClaimOutcome("user-1", "user-2")).toBe("conflict");
  });
});

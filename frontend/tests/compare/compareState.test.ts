import { describe, expect, it } from "vitest";
import { buildCompareUrl, excludeVehicle, resolveInitialPair } from "../../src/lib/compare/compareState";
import type { VehicleSummaryDto } from "../../src/types/catalog";

function makeVehicle(slug: string, overrides: Partial<VehicleSummaryDto> = {}): VehicleSummaryDto {
  return {
    slug,
    name: slug,
    tagline: "",
    basePriceCents: 1000000,
    currency: "EUR",
    horsepower: 500,
    topSpeedKph: 300,
    zeroToHundredSec: 3.5,
    thumbnailUrl: "",
    fallbackImageUrl: "",
    ...overrides,
  };
}

// A synthetic 3-vehicle catalog — today's real seeded catalog only has 2, which can never
// expose a genuine third alternative to switch to. Using 3 here is what actually lets these
// pure functions be exercised meaningfully (see the plan's Context section, point 4).
const VEHICLES = [makeVehicle("apex-gt"), makeVehicle("apex-rs"), makeVehicle("apex-spyder")];

describe("resolveInitialPair (Spec 18, AC-1/AC-3)", () => {
  it("defaults to the first two vehicles in catalog order when no params are given", () => {
    expect(resolveInitialPair(VEHICLES, undefined, undefined)).toEqual({ left: "apex-gt", right: "apex-rs" });
  });

  it("uses both params when they're valid, distinct slugs", () => {
    expect(resolveInitialPair(VEHICLES, "apex-rs", "apex-spyder")).toEqual({
      left: "apex-rs",
      right: "apex-spyder",
    });
  });

  it("falls back to the default for a param naming an unknown slug", () => {
    expect(resolveInitialPair(VEHICLES, "not-a-real-slug", "apex-spyder")).toEqual({
      left: "apex-gt",
      right: "apex-spyder",
    });
  });

  it("falls back to the default when a param is missing", () => {
    expect(resolveInitialPair(VEHICLES, "apex-spyder", undefined)).toEqual({
      left: "apex-spyder",
      right: "apex-rs",
    });
  });

  it("resets to the full default pair when both params would resolve to the same slug (AC-4)", () => {
    expect(resolveInitialPair(VEHICLES, "apex-spyder", "apex-spyder")).toEqual({
      left: "apex-gt",
      right: "apex-rs",
    });
  });

  it("resets to the full default pair when an explicit param collides with the other side's fallback default", () => {
    // rightParam is missing so it falls back to VEHICLES[1] ("apex-rs") — which is exactly
    // what leftParam explicitly asked for, so patching just one side isn't possible.
    expect(resolveInitialPair(VEHICLES, "apex-rs", undefined)).toEqual({ left: "apex-gt", right: "apex-rs" });
  });
});

describe("excludeVehicle (Spec 18, AC-4)", () => {
  it("removes exactly the named slug from the list, keeping the rest", () => {
    const result = excludeVehicle(VEHICLES, "apex-rs");
    expect(result.map((v) => v.slug)).toEqual(["apex-gt", "apex-spyder"]);
  });

  it("is a no-op when the named slug isn't present", () => {
    const result = excludeVehicle(VEHICLES, "not-a-real-slug");
    expect(result).toHaveLength(3);
  });
});

describe("buildCompareUrl (Spec 18, AC-3)", () => {
  it("builds a shareable /compare URL with both slugs", () => {
    expect(buildCompareUrl("apex-gt", "apex-rs")).toBe("/compare?left=apex-gt&right=apex-rs");
  });
});

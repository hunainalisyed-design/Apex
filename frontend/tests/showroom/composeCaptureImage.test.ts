import { describe, expect, it } from "vitest";
import type { BuildSummary, BuildSummaryLine } from "../../src/lib/showroom/buildSummary";
import { buildCaptureFilename, buildOverlayLayout, selectOverlayLines } from "../../src/lib/showroom/composeCaptureImage";

function line(overrides: Partial<BuildSummaryLine> & { category: BuildSummaryLine["category"] }): BuildSummaryLine {
  return {
    label: overrides.category,
    optionName: "Default",
    priceDeltaCents: 0,
    ...overrides,
  };
}

function makeSummary(overrides: Partial<BuildSummary> = {}): BuildSummary {
  return {
    alwaysShown: [
      line({ category: "PAINT", label: "Paint", optionName: "Obsidian Black" }),
      line({ category: "WHEELS", label: "Wheels", optionName: "Standard Wheels" }),
      line({ category: "INTERIOR_MATERIAL", label: "Overall Finish", optionName: "Standard Cloth" }),
    ],
    conditionalLines: [],
    accessories: [{ category: "ACCESSORY", label: "Accessories", optionName: "None", priceDeltaCents: 0 }],
    packages: [{ category: "PACKAGE", label: "Packages", optionName: "None", priceDeltaCents: 0 }],
    breakdown: { vehicleSlug: "apex-gt", basePriceCents: 8_500_000, lineItems: [], totalPriceCents: 8_500_000, currency: "EUR" },
    ...overrides,
  };
}

describe("selectOverlayLines", () => {
  it("prefers the three alwaysShown lines when nothing else is notable (AC-4)", () => {
    const summary = makeSummary();

    const lines = selectOverlayLines(summary);

    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.category)).toEqual(["PAINT", "WHEELS", "INTERIOR_MATERIAL"]);
  });

  it("caps at three lines even when conditionalLines add more", () => {
    const summary = makeSummary({
      conditionalLines: [
        line({ category: "BRAKE_CALIPER", label: "Brake Calipers", optionName: "Red" }),
        line({ category: "SPOILER", label: "Spoiler", optionName: "Carbon Spoiler" }),
      ],
    });

    const lines = selectOverlayLines(summary);

    expect(lines).toHaveLength(3);
    expect(lines.map((l) => l.category)).toEqual(["PAINT", "WHEELS", "INTERIOR_MATERIAL"]);
  });
});

describe("buildCaptureFilename", () => {
  it("formats as {vehicleSlug}-{publicId}.png (AC-5)", () => {
    expect(buildCaptureFilename("apex-gt", "APEX-7F82-K91X")).toBe("apex-gt-APEX-7F82-K91X.png");
  });
});

describe("buildOverlayLayout", () => {
  it("selects the right label/value pairs and formats the price via Intl.NumberFormat", () => {
    const layout = buildOverlayLayout({
      vehicleName: "Apex GT",
      lines: [
        line({ category: "PAINT", label: "Paint", optionName: "Racing Red" }),
        line({ category: "WHEELS", label: "Wheels", optionName: "Sport Wheels" }),
      ],
      totalPriceCents: 9_450_000,
      currency: "EUR",
      publicId: "APEX-7F82-K91X",
    });

    expect(layout.vehicleName).toBe("Apex GT");
    expect(layout.lines).toEqual([
      { label: "Paint", value: "Racing Red" },
      { label: "Wheels", value: "Sport Wheels" },
    ]);
    expect(layout.totalPriceLabel).toMatch(/94,500/);
    expect(layout.totalPriceLabel).not.toContain("9450000");
    expect(layout.publicId).toBe("APEX-7F82-K91X");
  });
});

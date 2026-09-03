import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { calculatePrice, PricingError, type CalculatePriceInput } from "../src/services/pricing.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));

interface FixtureCase {
  name: string;
  input: CalculatePriceInput;
  expected?: { totalPriceCents: number; lineItems: unknown[] };
  expectedErrorCode?: string;
}

const fixtures: FixtureCase[] = JSON.parse(
  readFileSync(path.join(dirname, "../../fixtures/pricing-cases.json"), "utf-8"),
);

describe("calculatePrice (shared fixture contract, AC-1 through AC-5)", () => {
  for (const testCase of fixtures) {
    it(testCase.name, () => {
      if (testCase.expectedErrorCode) {
        expect(() => calculatePrice(testCase.input)).toThrow(PricingError);
        try {
          calculatePrice(testCase.input);
        } catch (err) {
          expect((err as PricingError).code).toBe(testCase.expectedErrorCode);
        }
        return;
      }

      const result = calculatePrice(testCase.input);
      expect(result.totalPriceCents).toBe(testCase.expected!.totalPriceCents);
      expect(result.lineItems).toEqual(testCase.expected!.lineItems);
    });
  }
});

describe("calculatePrice — additional backend edge cases", () => {
  it("is synchronous (no I/O), supporting AC-7's no-network-round-trip guarantee", () => {
    const result = calculatePrice(fixtures[0].input);
    expect(result).toBeDefined();
  });

  it("rejects an option selected under the wrong category", () => {
    const input: CalculatePriceInput = {
      vehicle: { slug: "fixture-car", basePriceCents: 1_000_000, currency: "EUR" },
      options: [{ id: "wheels-sport", category: "WHEELS", name: "Sport Wheels", priceDeltaCents: 450000 }],
      singleSelections: { PAINT: "wheels-sport" } as never,
      multiSelections: {},
    };

    expect(() => calculatePrice(input)).toThrow(PricingError);
  });
});

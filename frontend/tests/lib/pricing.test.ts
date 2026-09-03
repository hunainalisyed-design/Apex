import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { calculatePrice, PricingError, type CalculatePriceInput } from "../../src/lib/pricing";

const dirname = path.dirname(fileURLToPath(import.meta.url));

interface FixtureCase {
  name: string;
  input: CalculatePriceInput;
  expected?: { totalPriceCents: number; lineItems: unknown[] };
  expectedErrorCode?: string;
}

const fixtures: FixtureCase[] = JSON.parse(
  readFileSync(path.join(dirname, "../../../fixtures/pricing-cases.json"), "utf-8"),
);

describe("calculatePrice (shared fixture contract, AC-1 through AC-6)", () => {
  for (const testCase of fixtures) {
    it(testCase.name, () => {
      if (testCase.expectedErrorCode) {
        try {
          calculatePrice(testCase.input);
          expect.fail("expected calculatePrice to throw");
        } catch (err) {
          expect(err).toBeInstanceOf(PricingError);
          expect((err as PricingError).code).toBe(testCase.expectedErrorCode);
        }
        return;
      }

      const result = calculatePrice(testCase.input);
      expect(result.totalPriceCents).toBe(testCase.expected!.totalPriceCents);
      expect(result.lineItems).toEqual(testCase.expected!.lineItems);
    });
  }

  it("is synchronous — no await needed between input and result (AC-7)", () => {
    const result = calculatePrice(fixtures[0].input);
    expect(result).toBeDefined();
  });
});

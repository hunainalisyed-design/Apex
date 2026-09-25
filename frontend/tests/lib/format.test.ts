import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE } from "../../src/i18n/config";
import { formatPriceCents } from "../../src/lib/format/currency";
import { formatSavedDate } from "../../src/lib/format/date";
import { formatNumber } from "../../src/lib/format/number";

// Intl uses non-breaking / narrow no-break spaces in some locales ("85.000 €") — normalize
// them so assertions read naturally.
const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("shared formatting utilities (Spec 26, AC-1)", () => {
  it("defaults to en-US, keeping today's output unchanged", () => {
    expect(DEFAULT_LOCALE).toBe("en-US");
    expect(formatPriceCents(8_500_000, "EUR")).toBe("€85,000");
    expect(formatNumber(1015)).toBe("1,015");
    expect(formatSavedDate("2026-09-26T12:00:00Z")).toBe("Sep 26, 2026");
  });

  describe("formatPriceCents", () => {
    it.each([
      ["en-US", "€85,000"],
      ["de-DE", "85.000 €"],
      ["fr-FR", "85 000 €"],
      ["en-IE", "€85,000"],
    ])("formats cents for %s", (locale, expected) => {
      expect(plain(formatPriceCents(8_500_000, "EUR", locale))).toBe(expected);
    });

    it("never converts currency — only the display locale changes", () => {
      expect(plain(formatPriceCents(150_000, "USD", "de-DE"))).toBe("1.500 $");
    });

    it("drops fractional cents to whole units, as before", () => {
      expect(formatPriceCents(99_99, "EUR", "en-US")).toBe("€100");
    });
  });

  describe("formatNumber", () => {
    it.each([
      ["en-US", "1,015"],
      ["de-DE", "1.015"],
      ["fr-FR", "1 015"],
    ])("groups thousands for %s", (locale, expected) => {
      expect(plain(formatNumber(1015, { locale }))).toBe(expected);
    });

    it("uses the locale's decimal separator and honours fractionDigits", () => {
      expect(formatNumber(3.2, { locale: "en-US", fractionDigits: 1 })).toBe("3.2");
      expect(formatNumber(3.2, { locale: "de-DE", fractionDigits: 1 })).toBe("3,2");
      expect(formatNumber(8, { locale: "en-US", fractionDigits: 1 })).toBe("8.0");
    });

    it("shows the number as-is when fractionDigits is omitted", () => {
      expect(formatNumber(3.25)).toBe("3.25");
      expect(formatNumber(8)).toBe("8");
    });
  });

  describe("formatSavedDate", () => {
    it.each([
      ["en-US", "Sep 26, 2026"],
      ["de-DE", "26.09.2026"],
      ["en-IE", "26 Sept 2026"],
    ])("formats dates for %s", (locale, expected) => {
      expect(formatSavedDate("2026-09-26T12:00:00Z", locale)).toBe(expected);
    });
  });
});

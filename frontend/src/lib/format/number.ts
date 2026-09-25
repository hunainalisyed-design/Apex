import { DEFAULT_LOCALE } from "@/i18n/config";

/**
 * Every displayed non-money number (horsepower, top speed, 0–100 time) goes through here
 * (Spec 26, AC-1), so grouping and decimal separators follow the locale — 1015 hp reads
 * "1,015" in en-US and "1.015" in de-DE. `fractionDigits` fixes the decimals shown
 * (e.g. 1 for "3.2s"); omit it to show the number as-is.
 */
export function formatNumber(
  value: number,
  options: { locale?: string; fractionDigits?: number } = {},
): string {
  const { locale = DEFAULT_LOCALE, fractionDigits } = options;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits ?? 20,
  }).format(value);
}

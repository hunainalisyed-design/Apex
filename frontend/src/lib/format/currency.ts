import { DEFAULT_LOCALE } from "@/i18n/config";

/** Money is always an integer number of cents (docs/CLAUDE.md convention) — formatted for
 * display only here, at the UI layer. `locale` controls separators and symbol placement
 * only; there is no currency conversion (Spec 26 §7 — pricing stays in the vehicle's currency). */
export function formatPriceCents(cents: number, currency: string, locale: string = DEFAULT_LOCALE): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

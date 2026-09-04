/** Money is always an integer number of cents (docs/CLAUDE.md convention) — formatted for
 * display only here, at the UI layer. */
export function formatPriceCents(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Formats a saved build's timestamp for display (Spec 17, AC-2) — matches currency.ts's
 * "formatted for display only here, at the UI layer" convention. */
export function formatSavedDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(iso));
}

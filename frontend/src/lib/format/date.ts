import { DEFAULT_LOCALE } from "@/i18n/config";

/** Formats a saved build's timestamp for display (Spec 17, AC-2) — matches currency.ts's
 * "formatted for display only here, at the UI layer" convention (Spec 26, AC-1). */
export function formatSavedDate(iso: string, locale: string = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(iso));
}

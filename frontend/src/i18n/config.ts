/**
 * The one place the app's locale is decided (Spec 26). next-intl's request config
 * (./request.ts) and every lib/format/ helper default to DEFAULT_LOCALE, so strings and
 * numbers can never disagree about which locale is active.
 *
 * "en-US" keeps today's output byte-for-byte identical (Spec 26 is a no-visible-change
 * refactor). Adding a language = add its tag here plus a messages/<locale>.json file.
 */
export const SUPPORTED_LOCALES = ["en-US"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en-US";

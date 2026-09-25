import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE } from "./config";

/**
 * next-intl's per-request config (Spec 26, AC-2), in "without i18n routing" mode: no locale
 * segment in URLs and no middleware — every request uses DEFAULT_LOCALE until a second
 * language actually ships. Found by the next-intl plugin in next.config.ts by convention.
 */
export default getRequestConfig(async () => ({
  locale: DEFAULT_LOCALE,
  messages: (await import(`../../messages/${DEFAULT_LOCALE}.json`)).default,
}));

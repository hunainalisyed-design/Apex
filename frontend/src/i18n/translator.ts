import { createTranslator } from "next-intl";
import messages from "../../messages/en-US.json";
import { DEFAULT_LOCALE } from "./config";

/**
 * For strings produced outside React (Zustand stores, config arrays, plain helpers like
 * getErrorMessage) where `useTranslations` can't run. Reads the same messages file as the
 * components do — only the calling mechanism differs. Inside a component, prefer
 * `useTranslations` (client/sync) or `getTranslations` (async server component).
 */
export const translate = createTranslator({ locale: DEFAULT_LOCALE, messages });

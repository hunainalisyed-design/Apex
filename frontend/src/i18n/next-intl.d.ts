import type messages from "../../messages/en-US.json";
import type { AppLocale } from "./config";

// Makes every `t("...")` key and every locale compile-time checked against the English
// catalog (Spec 26) — a typo'd or removed key is a type error, not a runtime blank.
declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof messages;
  }
}

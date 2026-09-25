import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { DEFAULT_LOCALE } from "../../src/i18n/config";
import messages from "../../messages/en-US.json";

/** The real next-intl provider with the real English catalog (Spec 26) — what the root
 * layout gives every component in the app. vitest.setup.ts makes it RTL's default wrapper,
 * so component tests render exactly as they would in the app, with no per-test setup. */
export function IntlWrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale={DEFAULT_LOCALE} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useConsentStore } from "@/state/consentStore";

/**
 * Cookie consent banner (Spec 24, AC-1/AC-2) — mounted once in the root layout, right after
 * <Nav>. Renders nothing until hydrate() has read localStorage (avoids a hydration mismatch:
 * the server always renders "no banner decided yet" since localStorage doesn't exist there)
 * and nothing once a choice already exists, per AC-2's "the banner doesn't reappear on
 * subsequent visits." There is no bare dismiss/close action — only Accept or Reject — since
 * AC-1 wants a real recorded choice, not silent dismissal.
 *
 * Deliberately a normal in-flow bar, not a `fixed` floating overlay: this spec's own §5 UI
 * states row requires "non-blocking (doesn't cover primary content)," and a floating overlay
 * anchored to a viewport edge — this app's showroom/configurator UI docks its own controls
 * near the bottom of the screen — did exactly that, intercepting clicks on swatches, Save,
 * and Reserve buttons underneath it (caught via a full e2e run turning up failures across
 * unrelated specs, all at the same "element intercepts pointer events" root cause). Taking
 * up its own space between Nav and the page instead means it can never overlap anything by
 * construction, not by careful z-index/position tuning.
 */
export function CookieConsentBanner() {
  const t = useTranslations("consent");
  const hydrated = useConsentStore((s) => s.hydrated);
  const choice = useConsentStore((s) => s.choice);
  const hydrate = useConsentStore((s) => s.hydrate);
  const accept = useConsentStore((s) => s.accept);
  const reject = useConsentStore((s) => s.reject);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!hydrated || choice !== null) return null;

  return (
    <div
      role="region"
      aria-label={t("label")}
      className="flex flex-col items-center gap-3 border-b border-white/10 bg-black/60 px-6 py-3 text-center sm:flex-row sm:justify-between sm:text-left"
    >
      <p className="text-sm text-white/80">
        {t.rich("message", {
          link: (chunks) => (
            <Link href="/privacy-policy" className="underline underline-offset-2 hover:text-white">
              {chunks}
            </Link>
          ),
        })}
      </p>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={reject}
          className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white/80 transition hover:border-white/50 hover:text-white focus-ring"
        >
          {t("reject")}
        </button>
        <button
          type="button"
          onClick={accept}
          className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black transition hover:bg-white/90 focus-ring"
        >
          {t("accept")}
        </button>
      </div>
    </div>
  );
}

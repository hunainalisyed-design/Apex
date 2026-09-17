import * as Sentry from "@sentry/nextjs";

/**
 * Client-side error monitoring (Spec 22, AC-3). Next.js's instrumentation-client.ts
 * convention (v15.3+) — see node_modules/next/dist/docs/01-app/03-api-reference/
 * 03-file-conventions/instrumentation-client.md — runs this before hydration, so
 * Sentry.init() here catches errors from the very first render onward.
 *
 * No-ops when NEXT_PUBLIC_SENTRY_DSN is unset, same "blank in local dev, real value at
 * deploy time" convention as this project's other third-party keys — Sentry.init() with an
 * empty dsn disables the SDK rather than throwing.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // AC-3: never forward request/response bodies that might carry a lead's or a signed-in
  // user's personal data (name, email, message text).
  beforeSend(event) {
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
    }
    return event;
  },
});

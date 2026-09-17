import * as Sentry from "@sentry/node";

/**
 * Error monitoring (Spec 22, AC-3). No-ops when SENTRY_DSN is unset — same "blank in local
 * dev, real value at deploy time" convention as every other third-party key in this project
 * (Stripe, Resend, Anthropic; see backend/.env.example). Must be called before anything else
 * that might throw, so `server.ts` imports and calls this first.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    tracesSampleRate: 0.1,
    // AC-3: never forward request bodies that might carry a lead's or user's personal data,
    // or headers that might carry the session cookie / an Authorization bearer token.
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        if (event.request.headers) {
          delete event.request.headers.cookie;
          delete event.request.headers.authorization;
        }
      }
      return event;
    },
  });
}

export { Sentry };

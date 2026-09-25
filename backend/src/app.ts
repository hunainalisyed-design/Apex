import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import { sendApiError } from "./lib/apiError.js";
import { logger } from "./lib/logger.js";
import { redact } from "./lib/redact.js";
import { Sentry } from "./lib/sentry.js";
import { adminRouter } from "./routes/admin.js";
import { aiRouter } from "./routes/ai.js";
import { authRouter } from "./routes/auth.js";
import { configurationsRouter } from "./routes/configurations.js";
import { docsRouter } from "./routes/docs.js";
import { healthRouter } from "./routes/health.js";
import { leadsRouter } from "./routes/leads.js";
import { meRouter } from "./routes/me.js";
import { pricingRouter } from "./routes/pricing.js";
import { reservationsRouter, reservationsWebhookHandler } from "./routes/reservations.js";
import { vehiclesRouter } from "./routes/vehicles.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000",
      // Required for the httpOnly session cookie (Spec 16) to flow between the frontend and
      // backend origins — without this, the browser silently drops Set-Cookie on cross-origin
      // responses even though CORS otherwise allows the request.
      credentials: true,
    }),
  );

  // Stripe's webhook signature verification (Spec 20, AC-5) needs the exact raw request
  // body bytes to compute its HMAC — must be registered with its own express.raw() body
  // parser BEFORE the app-wide express.json() below, which would otherwise consume/parse
  // the body first and destroy the raw bytes. Not part of reservationsRouter for this
  // reason — every other route on that router is a normal JSON body, mounted after
  // express.json() like the rest of the app. CORS is irrelevant here (Stripe calls this
  // server-to-server, never from a browser), so no carve-out needed there.
  app.post("/api/reservations/webhook", express.raw({ type: "application/json" }), reservationsWebhookHandler);

  app.use(express.json());
  app.use(cookieParser());

  app.use("/api", healthRouter);
  app.use("/api", docsRouter);
  app.use("/api", vehiclesRouter);
  app.use("/api", pricingRouter);
  app.use("/api", configurationsRouter);
  app.use("/api", aiRouter);
  app.use("/api", authRouter);
  app.use("/api", meRouter);
  app.use("/api", leadsRouter);
  app.use("/api", reservationsRouter);
  app.use("/api", adminRouter);

  // Sentry's own Express error handler (Spec 22, AC-3) must be registered after every route
  // but before this app's own final handler below, so it can capture whatever reaches here.
  // A no-op (nothing to register) when SENTRY_DSN is unset, same as initSentry().
  Sentry.setupExpressErrorHandler(app);

  // The global error handler asyncHandler's own doc comment promises: Express 4 never
  // reaches error-handling middleware from a rejected promise on its own, which is exactly
  // what asyncHandler works around. Previously nothing sat here, so an uncaught error fell
  // through to Express's default HTML error page — inconsistent with this API's JSON error
  // envelope (docs/CLAUDE.md) and invisible to Sentry until the handler above was added.
  // Deliberately generic: the error's own message is logged (redacted) and sent to Sentry,
  // never echoed to the client, since an unexpected error's message could itself contain
  // request data (e.g. a Prisma error embedding a query value).
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    logger.error(
      {
        err: err instanceof Error ? { message: err.message, stack: err.stack } : redact(err),
        method: req.method,
        path: req.path,
      },
      "Unhandled error",
    );

    if (res.headersSent) return;
    sendApiError(res, 500, "INTERNAL_ERROR", "An unexpected error occurred.");
  });

  return app;
}

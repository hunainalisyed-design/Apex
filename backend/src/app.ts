import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { aiRouter } from "./routes/ai.js";
import { authRouter } from "./routes/auth.js";
import { configurationsRouter } from "./routes/configurations.js";
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
  app.use("/api", vehiclesRouter);
  app.use("/api", pricingRouter);
  app.use("/api", configurationsRouter);
  app.use("/api", aiRouter);
  app.use("/api", authRouter);
  app.use("/api", meRouter);
  app.use("/api", leadsRouter);
  app.use("/api", reservationsRouter);

  return app;
}

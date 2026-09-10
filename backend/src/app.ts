import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { aiRouter } from "./routes/ai.js";
import { authRouter } from "./routes/auth.js";
import { configurationsRouter } from "./routes/configurations.js";
import { healthRouter } from "./routes/health.js";
import { meRouter } from "./routes/me.js";
import { pricingRouter } from "./routes/pricing.js";
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
  app.use(express.json());
  app.use(cookieParser());

  app.use("/api", healthRouter);
  app.use("/api", vehiclesRouter);
  app.use("/api", pricingRouter);
  app.use("/api", configurationsRouter);
  app.use("/api", aiRouter);
  app.use("/api", authRouter);
  app.use("/api", meRouter);

  return app;
}
